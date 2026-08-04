import { NextResponse } from "next/server";
import {
  generateBucketLinks,
  generateMixedLinks,
  LinkGeneratorAvailabilityError,
  sanitizeBucket,
  sanitizeContentTypes,
  sanitizeCount,
  sanitizeMixedBucketCounts,
} from "@/lib/admin-link-generator";
import { LINK_GENERATOR_BUCKETS } from "@/lib/link-generator-types";

export const dynamic = "force-dynamic";

type GenerateBody = {
  mode?: unknown;
  bucket?: unknown;
  bucketCounts?: unknown;
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
      const bucketCounts = sanitizeMixedBucketCounts(body.bucketCounts);
      const total = LINK_GENERATOR_BUCKETS.reduce((sum, bucket) => sum + bucketCounts[bucket], 0);

      if (total !== 40) {
        return NextResponse.json(
          { error: `Для смешанного набора сумма четырёх диапазонов должна быть равна 40. Сейчас: ${total}.` },
          { status: 400 },
        );
      }

      const items = await generateMixedLinks({ types, bucketCounts });
      return NextResponse.json({ mode: "mixed", count: items.length, bucketCounts, items });
    }

    const bucket = sanitizeBucket(body.bucket);
    if (!bucket) return NextResponse.json({ error: "Неизвестный диапазон длительности" }, { status: 400 });

    const count = sanitizeCount(body.count, 10);
    const items = await generateBucketLinks({ bucket, types, count });
    return NextResponse.json({ mode: "bucket", bucket, count: items.length, items });
  } catch (error) {
    if (error instanceof LinkGeneratorAvailabilityError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("[LinkGenerator] Failed to generate links", error);
    return NextResponse.json({ error: "Не удалось сгенерировать ссылки" }, { status: 500 });
  }
}
