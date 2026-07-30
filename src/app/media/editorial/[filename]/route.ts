import { readEditorialImageFile } from "@/lib/editorial/image-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { filename } = await params;
  const image = await readEditorialImageFile(filename);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.contentType,
      "Content-Length": String(image.buffer.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
