import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSocialConfig } from "@/lib/social/config";
import { createR2PresignedUrl } from "@/lib/social/storage/r2";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) { const { id } = await params; const media = await prisma.socialMediaAsset.findUnique({ where: { id } }); if (!media || media.status === "DELETED") return NextResponse.json({ error: "Not found" }, { status: 404 }); return NextResponse.redirect(createR2PresignedUrl({ method: "GET", objectKey: media.objectKey, expiresIn: getSocialConfig().previewTtlSeconds })); }
