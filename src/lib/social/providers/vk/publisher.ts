import { vkCall } from "./client";

export async function uploadVkWallPhoto(input: { token: string; groupId: string; fileUrl: string; fileName: string }) {
  const server = await vkCall<{ upload_url: string }>("photos.getWallUploadServer", input.token, { group_id: input.groupId });
  const file = await fetch(input.fileUrl).then(async (response) => {
    if (!response.ok) throw new Error(`Could not read R2 image: ${response.status}`);
    return new Blob([await response.arrayBuffer()], { type: response.headers.get("content-type") || "image/jpeg" });
  });
  const form = new FormData();
  form.append("photo", file, input.fileName);
  const uploaded = await fetch(server.upload_url, { method: "POST", body: form }).then((response) => response.json()) as { server: number; photo: string; hash: string };
  const saved = await vkCall<Array<{ id: number; owner_id: number; access_key?: string }>>("photos.saveWallPhoto", input.token, { group_id: input.groupId, server: uploaded.server, photo: uploaded.photo, hash: uploaded.hash });
  const photo = saved[0];
  if (!photo) throw new Error("VK did not save the uploaded photo");
  return `photo${photo.owner_id}_${photo.id}${photo.access_key ? `_${photo.access_key}` : ""}`;
}

export async function publishVkWallPost(input: { token: string; groupId: string; message: string; attachments?: string[]; publishDate?: Date; randomId: number }) {
  const ownerId = -Math.abs(Number(input.groupId));
  const postId = await vkCall<number>("wall.post", input.token, {
    owner_id: ownerId,
    from_group: 1,
    message: input.message,
    attachments: input.attachments?.join(",") || undefined,
    publish_date: input.publishDate ? Math.floor(input.publishDate.getTime() / 1000) : undefined,
    random_id: input.randomId,
  });
  return { postId: String(postId), externalUrl: `https://vk.com/wall${ownerId}_${postId}` };
}

export async function uploadVkVideo(input: { token: string; groupId: string; fileUrl: string; name: string; description: string }) {
  const saved = await vkCall<{ upload_url: string; video_id: number; owner_id: number; access_key?: string }>("video.save", input.token, {
    group_id: input.groupId,
    name: input.name.slice(0, 128),
    description: input.description,
    wallpost: 0,
  });
  const fileResponse = await fetch(input.fileUrl);
  if (!fileResponse.ok || !fileResponse.body) throw new Error(`Could not stream R2 video: ${fileResponse.status}`);
  const form = new FormData();
  form.append("video_file", new Blob([await fileResponse.arrayBuffer()], { type: fileResponse.headers.get("content-type") || "video/mp4" }), "clip.mp4");
  const uploadResponse = await fetch(saved.upload_url, { method: "POST", body: form });
  if (!uploadResponse.ok) throw new Error(`VK video upload failed: ${uploadResponse.status}`);
  await uploadResponse.text();
  return { videoId: String(saved.video_id), ownerId: saved.owner_id, attachment: `video${saved.owner_id}_${saved.video_id}${saved.access_key ? `_${saved.access_key}` : ""}` };
}
