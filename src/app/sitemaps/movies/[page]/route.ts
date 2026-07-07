import { buildMovieSitemapXml, xmlResponse } from "@/lib/seo/sitemap-builder";


export const revalidate = 3600;

type Props = { params: Promise<{ page: string }> };

export async function GET(_request: Request, { params }: Props) {
  const page = Math.max(1, Number.parseInt((await params).page, 10) || 1);
  return xmlResponse(await buildMovieSitemapXml("movies", page));
}
