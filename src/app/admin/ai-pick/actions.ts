"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
export async function updateAiPickConfig(formData:FormData){const enabled=formData.get("enabled")==="on";const model=String(formData.get("model")||"gpt-4.1-mini").trim().slice(0,80);const dailyBudgetUsd=Math.max(0,Math.min(1000,Number(formData.get("dailyBudgetUsd")||5)));const maxCandidates=Math.max(12,Math.min(100,Number(formData.get("maxCandidates")||60)));const recommendations=Math.max(4,Math.min(24,Number(formData.get("recommendations")||24)));await prisma.aiMatchConfig.upsert({where:{id:"default"},create:{id:"default",enabled,model,dailyBudgetUsd,maxCandidates,recommendations},update:{enabled,model,dailyBudgetUsd,maxCandidates,recommendations}});revalidatePath("/admin/ai-pick")}
