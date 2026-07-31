import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { DiscoveryFilters, DiscoveryMovie, MatchPreferences } from "@/lib/discovery/types";

export type AiMatchExplanation = { reason: string; matchedPreferences: string[]; caution: string };
export type AiMatchResult = { movies: DiscoveryMovie[]; explanations: Record<string, AiMatchExplanation>; mode: "AI" | "LOCAL_FALLBACK"; fallbackReason?: string };

type StructuredResponse = { recommendations: Array<{ movieId: string; score: number; reason: string; matchedPreferences: string[]; caution: string }> };

const schema = {
  type: "object", additionalProperties: false, required: ["recommendations"],
  properties: { recommendations: { type: "array", maxItems: 24, items: { type: "object", additionalProperties: false,
    required: ["movieId", "score", "reason", "matchedPreferences", "caution"], properties: {
      movieId: { type: "string" }, score: { type: "number", minimum: 0, maximum: 100 },
      reason: { type: "string", maxLength: 260 }, matchedPreferences: { type: "array", maxItems: 5, items: { type: "string", maxLength: 60 } },
      caution: { type: "string", maxLength: 160 },
    } } } }
} as const;

function outputText(json: any) {
  return json?.output_text || json?.output?.flatMap((item: any) => item.content || []).find((part: any) => part.type === "output_text")?.text;
}

async function config() {
  return prisma.aiMatchConfig.upsert({ where: { id: "default" }, update: {}, create: { id: "default" } });
}

function sessionHash(value?: string | null) {
  return value ? createHash("sha256").update(value).digest("hex").slice(0, 24) : null;
}

async function logUsage(data: Parameters<typeof prisma.aiMatchUsage.create>[0]["data"]) {
  try { await prisma.aiMatchUsage.create({ data }); } catch (error) { console.error("[AI Match] usage log failed", error); }
}

export async function rerankWithAi(input: {
  candidates: DiscoveryMovie[]; intentText: string; filters: DiscoveryFilters; preferences: Partial<MatchPreferences>; sessionId?: string | null;
}): Promise<AiMatchResult> {
  const started = Date.now();
  const cfg = await config();
  const local = input.candidates.slice(0, cfg.recommendations);
  const fallback = async (reason: string): Promise<AiMatchResult> => {
    await logUsage({ mode: "LOCAL_FALLBACK", model: cfg.model, candidateCount: input.candidates.length, resultCount: local.length, intentLength: input.intentText.length, durationMs: Date.now()-started, fallbackReason: reason, sessionIdHash: sessionHash(input.sessionId) });
    return { movies: local, explanations: {}, mode: "LOCAL_FALLBACK", fallbackReason: reason };
  };
  if (!cfg.enabled) return fallback("disabled");
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return fallback("missing_api_key");
  const hash = sessionHash(input.sessionId);
  if (hash) {
    const hourly = await prisma.aiMatchUsage.count({ where: { sessionIdHash: hash, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
    if (hourly >= 30) return fallback("rate_limit");
  }
  const since = new Date(); since.setUTCHours(0,0,0,0);
  const spent = await prisma.aiMatchUsage.aggregate({ where: { createdAt: { gte: since } }, _sum: { estimatedCostUsd: true } });
  if (Number(spent._sum.estimatedCostUsd || 0) >= cfg.dailyBudgetUsd) return fallback("daily_budget");
  const candidates = input.candidates.slice(0, Math.max(12, Math.min(100, cfg.maxCandidates)));
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), Math.max(3000, cfg.timeoutMs));
  try {
    const prompt = JSON.stringify({
      viewerIntent: input.intentText.slice(0, 600), filters: input.filters,
      learnedPreferences: input.preferences,
      candidates: candidates.map(m => ({ id:m.id,title:m.titleRu,year:m.year,type:m.type,genres:m.genres,country:m.country,duration:m.duration,rating:m.kpRating ?? m.imdbRating,description:m.description.slice(0,420),director:m.director }))
    });
    const response = await fetch("https://api.openai.com/v1/responses", { method:"POST", signal:controller.signal,
      headers:{ Authorization:`Bearer ${apiKey}`, "Content-Type":"application/json" },
      body:JSON.stringify({ model:cfg.model,
        instructions:"Ты — рекомендательная система REDFILM. Ранжируй ТОЛЬКО кандидатов из JSON. Учитывай явное пожелание, фильтры и накопленные предпочтения. Возвращай разнообразный набор. Не выдумывай movieId. Причины пиши по-русски, конкретно и без рекламных штампов.",
        input:prompt, text:{ format:{ type:"json_schema", name:"redfilm_ai_match", strict:true, schema } } }) });
    const json:any = await response.json();
    if (!response.ok) return fallback(`openai_http_${response.status}`);
    const text=outputText(json); if(!text) return fallback("empty_output");
    const parsed=JSON.parse(text) as StructuredResponse;
    const byId=new Map(candidates.map(m=>[m.id,m])); const seen=new Set<string>(); const explanations:Record<string,AiMatchExplanation>={}; const ranked:DiscoveryMovie[]=[];
    for(const item of parsed.recommendations || []) { const movie=byId.get(item.movieId); if(!movie || seen.has(movie.id)) continue; seen.add(movie.id); ranked.push({...movie, explanation:item.reason.slice(0,260)}); explanations[movie.id]={reason:item.reason.slice(0,260),matchedPreferences:(item.matchedPreferences||[]).slice(0,5),caution:(item.caution||"").slice(0,160)}; }
    for(const movie of candidates) if(ranked.length<cfg.recommendations && !seen.has(movie.id)) ranked.push(movie);
    const usage=json.usage||{}; const inputTokens=Number(usage.input_tokens||0); const outputTokens=Number(usage.output_tokens||0);
    const cost=(inputTokens/1_000_000)*cfg.inputPricePerM+(outputTokens/1_000_000)*cfg.outputPricePerM;
    await logUsage({ mode:"AI", model:cfg.model, requestId:json.id, inputTokens, outputTokens, estimatedCostUsd:cost, durationMs:Date.now()-started, candidateCount:candidates.length, resultCount:ranked.length, intentLength:input.intentText.length, sessionIdHash:sessionHash(input.sessionId) });
    return { movies:ranked.slice(0,cfg.recommendations), explanations, mode:"AI" };
  } catch(error) { return fallback(error instanceof Error && error.name==="AbortError" ? "timeout" : "invalid_response"); }
  finally { clearTimeout(timer); }
}
