import crypto from "node:crypto";
import { socialAiJson } from "./client";

const humanRules = `Пиши по-русски живо и точно, как сильный редактор кино-паблика. Не используй канцелярит, пустые AI-фразы и кликбейт без содержания. Не выдумывай факты. Фактические утверждения допустимы только из переданных источников. Если источника нет — пометь как неподтвержденное и не включай в итоговый пост.`;

type IdeasResult = { ideas: Array<{ topic: string; category: string; hook: string; potentialScore: number }> };
type ResearchResult = {
  summary: string;
  sources: Array<{ url: string; title: string; domain: string; excerpt: string; reliabilityScore: number }>;
  facts: Array<{ claim: string; sourceUrl: string; confidence: number }>;
};
type PostResult = { title: string; hook: string; body: string; hashtags: string[]; imageQueries: string[]; unsupportedClaims: string[] };

export async function generateSocialIdeas(input: { title: string; year?: number; context?: string }) {
  return socialAiJson<IdeasResult>({
    operation: "GENERATE_IDEAS",
    instructions: humanRules,
    schemaName: "social_ideas",
    prompt: `Создай 12 неповторяющихся идей публикаций о «${input.title}»${input.year ? ` (${input.year})` : ""}. Контекст: ${input.context || "нет"}.`,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ideas: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              topic: { type: "string" },
              category: { type: "string" },
              hook: { type: "string" },
              potentialScore: { type: "number" },
            },
            required: ["topic", "category", "hook", "potentialScore"],
          },
        },
      },
      required: ["ideas"],
    },
  });
}

export async function researchSocialTopic(topic: string) {
  return socialAiJson<ResearchResult>({
    operation: "RESEARCH_TOPIC",
    instructions: `${humanRules} Используй веб-поиск. Для каждого факта укажи конкретный URL источника. Форумы могут быть источником идеи, но не единственным подтверждением факта.`,
    schemaName: "social_research",
    webSearch: true,
    prompt: `Исследуй тему для публикации REDFILM: ${topic}. Найди проверяемые источники, предпочтительно официальные интервью, студии и авторитетные издания.`,
    schema: { type: "object", additionalProperties: false, properties: { summary: { type: "string" }, sources: { type: "array", items: { type: "object", additionalProperties: false, properties: { url: { type: "string" }, title: { type: "string" }, domain: { type: "string" }, excerpt: { type: "string" }, reliabilityScore: { type: "number" } }, required: ["url", "title", "domain", "excerpt", "reliabilityScore"] } }, facts: { type: "array", items: { type: "object", additionalProperties: false, properties: { claim: { type: "string" }, sourceUrl: { type: "string" }, confidence: { type: "number" } }, required: ["claim", "sourceUrl", "confidence"] } } }, required: ["summary", "sources", "facts"] },
  });
}

export async function writeSocialPost(input: { topic: string; sources: Array<{ url: string; excerpt: string }>; facts: Array<{ claim: string; confidence: number }> }) {
  return socialAiJson<PostResult>({
    operation: "GENERATE_POST",
    instructions: humanRules,
    schemaName: "social_post",
    prompt: `Тема: ${input.topic}\nПодтвержденные факты: ${JSON.stringify(input.facts)}\nИсточники: ${JSON.stringify(input.sources)}\nСоздай пост в стиле сильного кино-паблика. В конце задай естественный вопрос для комментариев.`,
    schema: { type: "object", additionalProperties: false, properties: { title: { type: "string" }, hook: { type: "string" }, body: { type: "string" }, hashtags: { type: "array", items: { type: "string" }, maxItems: 10 }, imageQueries: { type: "array", items: { type: "string" }, maxItems: 10 }, unsupportedClaims: { type: "array", items: { type: "string" } } }, required: ["title", "hook", "body", "hashtags", "imageQueries", "unsupportedClaims"] },
  });
}

export function ideaHash(topic: string) { return crypto.createHash("sha256").update(topic.trim().toLowerCase()).digest("hex"); }
