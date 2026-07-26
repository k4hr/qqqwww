import { notFound, permanentRedirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { MovieCard } from "@/components/movie-card";
import { getCollection } from "@/lib/collections";
import { vibixPublicMovieWhere } from "@/lib/movie-access";
import { buildDefaultCatalogCountryWhere } from "@/lib/catalog-filters";
import { timedMovieQuery } from "@/lib/query-performance";
import { getSeoTopic, seoTopics, topicWhere } from "@/lib/seo-pages";
import { JsonLd } from "@/components/json-ld";
import { genrePath, siteUrl, watchPath } from "@/lib/seo-links";
import { trendCategorySlug, trendCategoryTitle } from "@/lib/trend-sources";
import { whereForSeoLanding } from "@/lib/seo/keyword-engine";
import { getFranchiseConfig, sortMoviesByFranchiseOrder } from "@/lib/seo/franchise-orders";
import { readAiSeoDraft } from "@/lib/seo/ai-builder";
import { baseRedirectForCollectionSlug } from "@/lib/seo/base-redirects";
import { getCreatorHubMetadata, renderCreatorHubPage } from "@/lib/collaboration/public-pages";


export const revalidate = 1800;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const creatorMetadata = await getCreatorHubMetadata(slug);
  if (creatorMetadata) return creatorMetadata;
  const topic = getSeoTopic(slug);
  if (topic) return { title: `${topic[1]} смотреть онлайн — REDFILM`, description: `${topic[1]}: тематическая подборка доступных фильмов и сериалов с рейтингами и описаниями.`, alternates: { canonical: `/collections/${slug}` } };
  const collection = getCollection(slug);
  if (collection) {
    return {
      title: collection.title,
      description: collection.description,
      alternates: { canonical: `/collections/${slug}` },
    };
  }

  const landing = await prisma.seoLandingPage.findFirst({ where: { slug, status: "ACTIVE", isIndexable: true } }).catch(() => null);
  if (landing) return { title: landing.title, description: landing.description, alternates: { canonical: `/collections/${slug}` } };

  const trendCategories = await prisma.trendCandidate.findMany({ where: { status: "AVAILABLE", movieId: { not: null } }, select: { sourceCategory: true }, distinct: ["sourceCategory"], take: 200 });
  const category = trendCategories.find((item) => trendCategorySlug(item.sourceCategory) === slug)?.sourceCategory;
  if (!category) return {};
  const name = trendCategoryTitle(category);
  return { title: `${name} смотреть онлайн — REDFILM`, description: `Автоматическая подборка REDFILM: ${name}.`, alternates: { canonical: `/collections/${slug}` } };
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const creatorPage = await renderCreatorHubPage(slug);
  if (creatorPage) return creatorPage;
  const baseRedirect = baseRedirectForCollectionSlug(slug);
  if (baseRedirect) permanentRedirect(baseRedirect);

  const collection = getCollection(slug);
  const topic = getSeoTopic(slug);
  const seoLanding = !collection && !topic ? await prisma.seoLandingPage.findUnique({ where: { slug } }).catch(() => null) : null;
  if (seoLanding?.type === "BASE" || seoLanding?.status === "REDIRECT") {
    if (slug.startsWith("serial")) permanentRedirect("/series");
    if (slug.startsWith("mult")) permanentRedirect("/cartoons");
    if (slug.startsWith("anime")) permanentRedirect("/anime");
    permanentRedirect("/films");
  }
  const landing = seoLanding?.status === "ACTIVE" && seoLanding.isIndexable ? seoLanding : null;
  if (seoLanding && !landing) notFound();
  const franchiseConfig = landing ? getFranchiseConfig(slug) : null;
  const aiDraft = landing ? readAiSeoDraft(landing.aiDraftJson) : null;
  const landingFilter = landing ? whereForSeoLanding(franchiseConfig ? { targetType: landing.type, targetSlug: slug } : landing.filterJson) : null;
  const topicFilter = topicWhere(slug);
  const trendCategories = await prisma.trendCandidate.findMany({ where: { status: "AVAILABLE", movieId: { not: null } }, select: { sourceCategory: true }, distinct: ["sourceCategory"], take: 200 });
  const trendCategory = trendCategories.find((item) => trendCategorySlug(item.sourceCategory) === slug)?.sourceCategory;
  const trendCandidates = trendCategory ? await prisma.trendCandidate.findMany({ where: { status: "AVAILABLE", sourceCategory: trendCategory, movieId: { not: null } }, select: { movieId: true }, take: 100 }) : [];
  const trendMovieIds = Array.from(new Set(trendCandidates.flatMap((item) => item.movieId ? [item.movieId] : [])));
  if (!collection && !landing && (!topic || !topicFilter) && !trendMovieIds.length) notFound();

  let movies = await timedMovieQuery(`collection ${slug}`, () => prisma.movie.findMany({
    where: { AND: [vibixPublicMovieWhere, buildDefaultCatalogCountryWhere(), trendMovieIds.length ? { id: { in: trendMovieIds }, isHomeEligible: true } : landingFilter ?? topicFilter ?? collection!.where] },
    orderBy: franchiseConfig ? [{ year: "asc" }, { topScore: "desc" }] : collection?.orderBy ?? (trendCategory ? [{ homeScore: "desc" }, { trendScore: "desc" }] : [{ popularScore: "desc" }, { kpRating: "desc" }, { createdAt: "desc" }]),
    include: { genres: { include: { genre: true } } },
    take: franchiseConfig ? 96 : 48,
  }));
  if (franchiseConfig) movies = sortMoviesByFranchiseOrder(slug, movies).slice(0, 48);
  if (!movies.length) notFound();
  if (topic && !trendCategory && movies.length < 8) notFound();
  if (landing && movies.length < landing.minItems) notFound();
  if (trendCategory && !movies.length) notFound();
  const trendName = trendCategory ? trendCategoryTitle(trendCategory) : undefined;
  const h1 = landing?.h1 ?? topic?.[1] ?? collection?.h1 ?? `Подборка ${trendName}`;
  const description = aiDraft?.introText || landing?.introText || (topic ? `${topic[1]} собраны по названиям, описаниям и жанровым признакам. В подборку попадают только доступные для просмотра карточки REDFILM.` : collection?.description ?? `Автоматическая подборка REDFILM по категории ${trendName}. Позиции прошли проверку качества и доступны для просмотра.`);
  const movieBySlug = new Map(movies.map((movie) => [movie.slug, movie]));
  const genres = [...new Map(movies.flatMap((movie) => movie.genres.map((item) => [item.genre.slug, item.genre] as const))).values()].slice(0, 8);
  const relatedTopics = seoTopics.filter((item) => item[0] !== slug).slice(0, 6);

  return (
    <div className="container py-6">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "CollectionPage", name: h1, url: siteUrl(`/collections/${slug}`), mainEntity: { "@type": "ItemList", itemListElement: movies.map((movie, index) => ({ "@type": "ListItem", position: index + 1, name: movie.titleRu, url: siteUrl(watchPath(movie)), image: movie.posterUrl || undefined })) } }} />
      <section className="rf-catalog-intro mb-7">
        <div className="rf-section-eyebrow mb-3">Подборка REDFILM</div>
        <h1 className="rf-page-title">{h1}</h1>
        <p className="rf-copy mt-4 max-w-3xl">{description}</p>
      </section>

      <div className="movie-grid">
        {movies.map((movie) => <MovieCard key={movie.slug} movie={movie} />)}
      </div>
      {franchiseConfig ? <section className="rf-section border-t border-white/[.07] pt-6"><h2 className="rf-section-title">Как смотреть по порядку</h2><p className="rf-copy mt-3 max-w-4xl">На странице сначала показываются фильмы, найденные в каталоге REDFILM, а порядок строится по хронологии и известным веткам киновселенной. Если какой-то части нет в каталоге, она не выводится пустой карточкой.</p></section> : null}

      {aiDraft?.sections?.length ? <section className="rf-section space-y-8 border-t border-white/[.07] pt-6">{aiDraft.sections.map((section) => {
        const sectionMovies = section.movieSlugs.map((movieSlug) => movieBySlug.get(movieSlug)).filter(Boolean).slice(0, 12);
        return <div key={section.title}><h2 className="rf-section-title">{section.title}</h2><p className="rf-copy mt-3 max-w-4xl">{section.body}</p>{sectionMovies.length ? <div className="movie-grid mt-5">{sectionMovies.map((movie) => movie ? <MovieCard key={`${section.title}-${movie.slug}`} movie={movie} /> : null)}</div> : null}</div>;
      })}</section> : null}

      {aiDraft?.faq?.length ? <section className="rf-section border-t border-white/[.07] pt-6"><h2 className="rf-section-title">Вопросы и ответы</h2><div className="mt-4 divide-y divide-white/[.07]">{aiDraft.faq.map((item) => <div key={item.question} className="py-4"><h3 className="font-semibold text-white">{item.question}</h3><p className="rf-copy mt-2">{item.answer}</p></div>)}</div></section> : null}

      <section className="rf-section border-t border-white/[.07] pt-6"><h2 className="rf-section-title">Почему эти фильмы в подборке</h2><p className="rf-copy mt-3 max-w-4xl">Картины объединены общей темой, жанровыми признаками и ключевыми мотивами. В списке остаются только доступные для просмотра позиции каталога.</p><h3 className="mt-6 font-semibold text-white">Смотрите также</h3><div className="rf-filter-row mt-3">{aiDraft?.internalLinks?.map((item) => <Link key={item.url} href={item.url} className="rf-filter">{item.label}</Link>)}{franchiseConfig?.relatedLinks.map((item) => <Link key={item.href} href={item.href} className="rf-filter">{item.label}</Link>)}{relatedTopics.map((item) => <Link key={item[0]} href={`/collections/${item[0]}`} className="rf-filter">{item[1]}</Link>)}{genres.map((genre) => <Link key={genre.slug} href={genrePath(genre)} className="rf-filter">{genre.name}</Link>)}</div></section>
    </div>
  );
}
