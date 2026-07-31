import { NextResponse } from "next/server";
import { getDiscoveryRecommendations, sanitizeIdList, normalizeDiscoveryFilters, normalizeMatchPreferences } from "@/lib/discovery/recommendations";
import { rerankWithAi } from "@/lib/discovery/ai-match";
import type { DiscoveryFilters, MatchPreferences } from "@/lib/discovery/types";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 48_000;
type MatchRequestBody = { excludeIds?:unknown; likedIds?:unknown; dislikedIds?:unknown; filters?:Partial<DiscoveryFilters>; preferences?:Partial<MatchPreferences>; seed?:unknown; intentText?:unknown; useAi?:unknown; sessionId?:unknown };
export async function POST(request:Request){
 const contentLength=Number(request.headers.get("content-length")??"0"); if(Number.isFinite(contentLength)&&contentLength>MAX_BODY_BYTES)return NextResponse.json({movies:[],message:"Слишком большой запрос"},{status:413});
 try { const text=await request.text(); if(text.length>MAX_BODY_BYTES)return NextResponse.json({movies:[],message:"Слишком большой запрос"},{status:413}); const body=JSON.parse(text||"{}") as MatchRequestBody;
  const excludeIds=sanitizeIdList(body.excludeIds,250), likedIds=sanitizeIdList(body.likedIds,80), dislikedIds=sanitizeIdList(body.dislikedIds,120); const seed=typeof body.seed==="string"?body.seed.slice(0,100):undefined;
  const filters=normalizeDiscoveryFilters(body.filters), preferences=normalizeMatchPreferences(body.preferences); const intentText=typeof body.intentText==="string"?body.intentText.trim().slice(0,600):"";
  const candidates=await getDiscoveryRecommendations({filters,excludeIds:[...excludeIds,...likedIds,...dislikedIds],likedIds,dislikedIds,preferences,seed,limit:body.useAi===true?60:24});
  if(body.useAi===true && intentText.length>=3){ const result=await rerankWithAi({candidates,intentText,filters,preferences,sessionId:typeof body.sessionId==="string"?body.sessionId.slice(0,120):null}); return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}}); }
  return NextResponse.json({movies:candidates.slice(0,24),mode:"LOCAL_FALLBACK",explanations:{}},{headers:{"Cache-Control":"private, no-store"}});
 } catch(error){console.error("[Match API] Failed",error);return NextResponse.json({movies:[],message:"Не удалось загрузить следующую партию"},{status:503});}
}
