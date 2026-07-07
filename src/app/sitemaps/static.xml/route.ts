import { buildStaticSitemapXml, xmlResponse } from "@/lib/seo/sitemap-builder";


export const revalidate = 3600;

export async function GET() {
  return xmlResponse(await buildStaticSitemapXml());
}
