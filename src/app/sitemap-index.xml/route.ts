import { buildSitemapIndexXml, xmlResponse } from "@/lib/seo/sitemap-builder";

export const dynamic = "force-dynamic";

export async function GET() {
  return xmlResponse(await buildSitemapIndexXml());
}
