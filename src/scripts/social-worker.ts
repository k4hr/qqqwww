import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { prisma } from "@/lib/prisma";
import { getSocialConfig } from "@/lib/social/config";
import { getVkCredentials } from "@/lib/social/integration";
import { leaseNextSocialJob, retryDelayMs } from "@/lib/social/queue";
import { createR2PresignedUrl, deleteR2Object } from "@/lib/social/storage/r2";
import { publishVkWallPost, uploadVkVideo, uploadVkWallPhoto } from "@/lib/social/providers/vk/publisher";
import { vkCall } from "@/lib/social/providers/vk/client";

const workerId = `${os.hostname()}:${process.pid}:${crypto.randomUUID().slice(0, 8)}`;
const config = getSocialConfig();
let stopped = false;
process.on("SIGTERM", () => { stopped = true; }); process.on("SIGINT", () => { stopped = true; });

async function ffprobe(mediaId: string, objectKey: string) {
  const url = createR2PresignedUrl({ method: "GET", objectKey, expiresIn: 900 });
  const filePath = path.join(os.tmpdir(), `redfilm-${mediaId}.mp4`);
  const response = await fetch(url); if (!response.ok) throw new Error(`R2 video download failed: ${response.status}`);
  await fs.writeFile(filePath, Buffer.from(await response.arrayBuffer()));
  const output = await new Promise<string>((resolve, reject) => { const proc = spawn("ffprobe", ["-v","error","-print_format","json","-show_format","-show_streams",filePath]); let out="",err=""; proc.stdout.on("data",d=>out+=d); proc.stderr.on("data",d=>err+=d); proc.on("close",code=>code===0?resolve(out):reject(new Error(err||`ffprobe ${code}`))); });
  await fs.unlink(filePath).catch(()=>{});
  const data = JSON.parse(output); const video = data.streams?.find((s:any)=>s.codec_type==="video"); const audio = data.streams?.find((s:any)=>s.codec_type==="audio");
  const fpsRaw=String(video?.avg_frame_rate||"0/1").split("/").map(Number); const fps=fpsRaw[1]?fpsRaw[0]/fpsRaw[1]:0;
  await prisma.socialMediaAsset.update({where:{id:mediaId},data:{width:video?.width,height:video?.height,durationMs:Math.round(Number(data.format?.duration||0)*1000),fps,videoCodec:video?.codec_name,audioCodec:audio?.codec_name||null,sha256:crypto.createHash("sha256").update(JSON.stringify({size:data.format?.size,duration:data.format?.duration,bitRate:data.format?.bit_rate})).digest("hex"),metadata:data}});
  if (!video || video.codec_name !== "h264") throw new Error("VK clip requires H.264 video");
  if (!audio) throw new Error("Video has no audio stream");
  return data;
}

function postMessage(post: NonNullable<Awaited<ReturnType<typeof leaseNextSocialJob>>>["post"]) {
  if (!post) return "";
  const hashtags = post.hashtags.map((tag) => `#${tag.replace(/^#/, "")}`).join(" ");
  const link = post.utmCode && post.movieId ? `\n\nhttps://redfilm.win/go/social/${post.utmCode}` : "";
  return [post.hook, post.body, hashtags].filter(Boolean).join("\n\n") + link;
}

async function processJob(job: NonNullable<Awaited<ReturnType<typeof leaseNextSocialJob>>>) {
  await prisma.socialPublishJob.update({where:{id:job.id},data:{status:"RUNNING",heartbeatAt:new Date(),attemptCount:{increment:1}}});
  const attemptNumber=job.attemptCount+1;
  const attempt=await prisma.socialPublishAttempt.create({data:{jobId:job.id,attemptNumber,status:"RUNNING",requestType:job.type}});
  try {
    let result: unknown = {};
    if (job.type === "PUBLISH_VK_POST") {
      if (!job.post) throw new Error("Post not found");
      if (job.post.externalPostId) { result={alreadyPublished:true,externalPostId:job.post.externalPostId}; }
      else {
        const {token,groupId}=await getVkCredentials(); const attachments:string[]=[];
        for (const item of job.post.media) { if (item.mediaAsset.kind!=="IMAGE") continue; const fileUrl=createR2PresignedUrl({method:"GET",objectKey:item.mediaAsset.objectKey,expiresIn:900}); attachments.push(await uploadVkWallPhoto({token,groupId,fileUrl,fileName:item.mediaAsset.fileName})); }
        const published=await publishVkWallPost({token,groupId,message:postMessage(job.post),attachments,randomId:Math.abs(parseInt(crypto.createHash("sha256").update(job.id).digest("hex").slice(0,7),16))});
        await prisma.socialPost.update({where:{id:job.post.id},data:{status:"PUBLISHED",publishedAt:new Date(),externalPostId:published.postId,externalUrl:published.externalUrl,immutableSnapshot:{title:job.post.title,body:job.post.body,hook:job.post.hook,hashtags:job.post.hashtags,attachments}}}); result=published;
      }
    } else if (job.type === "UPLOAD_VK_CLIP") {
      if (!job.post) throw new Error("Clip post not found"); const media=job.post.media.find((m)=>m.role==="CLIP")?.mediaAsset; if(!media) throw new Error("Clip MP4 is missing");
      if (!media.durationMs) await ffprobe(media.id,media.objectKey);
      const {token,groupId}=await getVkCredentials(); const fileUrl=createR2PresignedUrl({method:"GET",objectKey:media.objectKey,expiresIn:1800});
      const video=await uploadVkVideo({token,groupId,fileUrl,name:job.post.title||"REDFILM",description:postMessage(job.post)});
      const wall=await publishVkWallPost({token,groupId,message:postMessage(job.post),attachments:[video.attachment],randomId:Math.abs(parseInt(crypto.createHash("sha256").update(job.id).digest("hex").slice(0,7),16))});
      await prisma.socialPost.update({where:{id:job.post.id},data:{status:"PUBLISHED",publishedAt:new Date(),externalVideoId:video.videoId,externalPostId:wall.postId,externalUrl:wall.externalUrl,immutableSnapshot:{transport:"VK_VIDEO_WALL_ATTACHMENT",video}}}); result={video,wall};
    } else if (job.type === "COLLECT_METRICS") {
      if (!job.post?.externalPostId) throw new Error("Published VK post ID is missing"); const {token,groupId}=await getVkCredentials(); const ownerId=-Math.abs(Number(groupId)); const rows=await vkCall<any[]>("wall.getById",token,{posts:`${ownerId}_${job.post.externalPostId}`}); const row=rows[0]; if(row) await prisma.socialMetricSnapshot.create({data:{postId:job.post.id,views:row.views?.count,likes:row.likes?.count,comments:row.comments?.count,reposts:row.reposts?.count,raw:row}}); result=row;
    } else if (job.type === "CLEAN_TEMP_OBJECTS") {
      const expired=await prisma.socialMediaAsset.findMany({where:{status:"PENDING_UPLOAD",uploadExpiresAt:{lt:new Date()}},take:100}); for(const media of expired){await deleteR2Object(media.objectKey).catch(()=>{});await prisma.socialMediaAsset.update({where:{id:media.id},data:{status:"DELETED",deletedAt:new Date()}});} result={deleted:expired.length};
    } else { result={skipped:true,reason:"Job type is handled by admin action or future provider"}; }
    await prisma.$transaction([prisma.socialPublishAttempt.update({where:{id:attempt.id},data:{status:"SUCCEEDED",finishedAt:new Date(),externalResponse:result as never}}),prisma.socialPublishJob.update({where:{id:job.id},data:{status:"SUCCEEDED",result:result as never,lockedAt:null,lockedBy:null,leaseExpiresAt:null,heartbeatAt:new Date(),lastError:null}})]);
  } catch(error) {
    const message=error instanceof Error?error.message:String(error); const final=attemptNumber>=job.maxAttempts;
    await prisma.$transaction([prisma.socialPublishAttempt.update({where:{id:attempt.id},data:{status:final?"FAILED":"RETRY",finishedAt:new Date(),errorMessage:message}}),prisma.socialPublishJob.update({where:{id:job.id},data:{status:final?"FAILED":"RETRY",nextAttemptAt:final?null:new Date(Date.now()+retryDelayMs(attemptNumber)),lastError:message,lockedAt:null,lockedBy:null,leaseExpiresAt:null}}),...(job.postId?[prisma.socialPost.update({where:{id:job.postId},data:{status:final?"FAILED":job.post?.status||"SCHEDULED",lastError:message}})]:[])]);
  }
}

async function main(){console.log(`[SocialWorker] Started ${workerId}`); while(!stopped){const job=await leaseNextSocialJob(workerId,config.leaseSeconds); if(job) await processJob(job); else await new Promise(r=>setTimeout(r,config.workerPollMs));} console.log("[SocialWorker] Stopped"); await prisma.$disconnect();}
main().catch((error)=>{console.error("[SocialWorker] Fatal",error);process.exit(1);});
