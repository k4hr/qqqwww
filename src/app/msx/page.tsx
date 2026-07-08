import type { Metadata } from "next";
import { TvFocusProvider } from "@/components/tv/tv-focus-provider";
import { TvCss, TvHero, TvSection, TvShell, TvTopBar } from "@/components/tv/tv-ui";
import { getTvHome } from "@/lib/tv";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "REDFILM TV — фильмы и сериалы для телевизора",
  description: "REDFILM TV — крупный интерфейс для Media Station X, Smart TV и управления пультом.",
  robots: { index: false, follow: true },
  alternates: { canonical: "/msx" },
};

export default async function MsxHomePage() {
  const home = await getTvHome();

  return (
    <TvShell>
      <TvCss />
      <TvFocusProvider />
      <TvTopBar />
      {home.hero ? <TvHero movie={home.hero} /> : <EmptyTvHome />}
      <div className="pb-12">
        {home.sections.map((section) => <TvSection key={section.id} title={section.title} movies={section.movies} />)}
      </div>
    </TvShell>
  );
}

function EmptyTvHome() {
  return (
    <section className="px-10 py-24">
      <div className="rounded-[34px] border border-white/10 bg-white/[.06] p-12">
        <p className="text-2xl font-bold text-white/60">REDFILM TV</p>
        <h1 className="mt-3 text-6xl font-black tracking-[-.06em]">Контент скоро появится</h1>
        <p className="mt-4 text-2xl text-white/70">Проверь импорт Vibix и публикацию карточек.</p>
      </div>
    </section>
  );
}
