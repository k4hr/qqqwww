import { buildCollectionSitemapXml, xmlResponse } from "@/lib/seo/sitemap-builder";


export const revalidate = 3600;

export async function GET() {
  return xmlResponse(await buildCollectionSitemapXml());
}
