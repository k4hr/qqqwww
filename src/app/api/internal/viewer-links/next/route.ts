import { NextResponse } from "next/server";
import {
  generateBucketLinks,
  sanitizeBucket,
  sanitizeContentTypes,
} from "@/lib/admin-link-generator";

export const dynamic = "force-dynamic";

type NextLinkBody = {
  bucket?: unknown;
  types?: unknown;
};

function authorized(request: Request) {
  const expected = process.env.REDFILM_VIEWER_BRIDGE_TOKEN?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: NextLinkBody;
  try {
    body = (await request.json()) as NextLinkBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const bucket = sanitizeBucket(body.bucket);
  if (!bucket) {
    return NextResponse.json({ error: "Неизвестный диапазон длительности" }, { status: 400 });
  }

  try {
    const types = sanitizeContentTypes(body.types);
    const items = await generateBucketLinks({ bucket, types, count: 1 });
    const item = items[0];

    if (!item) {
      return NextResponse.json(
        { error: "В выбранном диапазоне нет доступных ссылок" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      bucket,
      item,
    });
  } catch (error) {
    console.error("[ViewerLinks] Failed to select next link", error);
    return NextResponse.json({ error: "Не удалось выбрать следующую ссылку" }, { status: 500 });
  }
}
