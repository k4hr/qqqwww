import { buildStaticSitemapXml, xmlResponse } from "@/lib/seo/sitemap-builder";

export const dynamic = "force-dynamic";

export async function GET() {
  return xmlResponse(await buildStaticSitemapXml());
}
