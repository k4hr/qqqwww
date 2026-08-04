import { NextResponse } from "next/server";
import {
  generateBalancedLinks,
  generateBucketLinks,
  sanitizeBucket,
  sanitizeContentTypes,
  sanitizeCount,
} from "@/lib/admin-link-generator";

export const dynamic = "force-dynamic";

type GenerateBody = {
  mode?: unknown;
  bucket?: unknown;
  count?: unknown;
  types?: unknown;
};

export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON запроса" }, { status: 400 });
  }

  try {
    const types = sanitizeContentTypes(body.types);

    if (body.mode === "mixed") {
      const count = sanitizeCount(body.count, 40);
      const items = await generateBalancedLinks({ types, total: count });
      return NextResponse.json({ mode: "mixed", count: items.length, items });
    }

    const bucket = sanitizeBucket(body.bucket);
    if (!bucket) return NextResponse.json({ error: "Неизвестный диапазон длительности" }, { status: 400 });

    const count = sanitizeCount(body.count, 10);
    const items = await generateBucketLinks({ bucket, types, count });
    return NextResponse.json({ mode: "bucket", bucket, count: items.length, items });
  } catch (error) {
    console.error("[LinkGenerator] Failed to generate links", error);
    return NextResponse.json({ error: "Не удалось сгенерировать ссылки" }, { status: 500 });
  }
}
