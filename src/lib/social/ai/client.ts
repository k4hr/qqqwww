import { prisma } from "@/lib/prisma";
import { getSocialConfig } from "@/lib/social/config";

export async function socialAiJson<T>(input: {
  operation: string;
  instructions: string;
  prompt: string;
  schemaName: string;
  schema: Record<string, unknown>;
  postId?: string;
  webSearch?: boolean;
}): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const config = getSocialConfig();
  const start = new Date();
  const todayUsage = await prisma.socialAiUsage.aggregate({
    where: { createdAt: { gte: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate())) } },
    _sum: { estimatedCostUsd: true },
  });
  if (Number(todayUsage._sum.estimatedCostUsd || 0) >= config.openAiDailyLimitUsd) throw new Error("Social OpenAI daily budget limit reached");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.openAiModel,
      instructions: input.instructions,
      input: input.prompt,
      tools: input.webSearch ? [{ type: "web_search" }] : undefined,
      text: { format: { type: "json_schema", name: input.schemaName, strict: true, schema: input.schema } },
    }),
  });
  const json = await response.json() as any;
  if (!response.ok) throw new Error(json?.error?.message || `OpenAI HTTP ${response.status}`);
  const text = json.output_text || json.output?.flatMap((item: any) => item.content || []).find((part: any) => part.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI returned no structured output");
  const usage = json.usage || {};
  await prisma.socialAiUsage.create({ data: { operation: input.operation, model: config.openAiModel, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, requestId: json.id, postId: input.postId, metadata: { durationMs: Date.now() - start.getTime() } } });
  return JSON.parse(text) as T;
}
