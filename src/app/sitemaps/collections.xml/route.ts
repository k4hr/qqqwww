import { buildCollectionSitemapXml, xmlResponse } from "@/lib/seo/sitemap-builder";

export const dynamic = "force-dynamic";

export async function GET() {
  return xmlResponse(await buildCollectionSitemapXml());
}
