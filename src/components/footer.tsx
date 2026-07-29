import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-white/[.07] text-white">
      <div className="container grid gap-8 py-10 md:grid-cols-[minmax(260px,1.2fr)_minmax(320px,1fr)_minmax(220px,.8fr)] md:items-start">
        <div className="max-w-md">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center text-lg font-semibold tracking-[-0.025em]"
          >
            <span><span className="text-[#f02b42]">RED</span>FILM</span>
          </Link>

          <p className="mt-3 text-sm leading-relaxed text-[#74757d]">
            Каталог фильмов и сериалов с описаниями, рейтингами и новыми подборками.
          </p>
        </div>

        <nav className="grid grid-cols-2 gap-x-5 text-sm font-medium text-[#8c8e96]" aria-label="Разделы сайта">
          <Link className="inline-flex min-h-11 items-center px-2 hover:text-white" href="/films">
            Фильмы
          </Link>
          <Link className="inline-flex min-h-11 items-center px-2 hover:text-white" href="/series">
            Сериалы
          </Link>
          <Link className="inline-flex min-h-11 items-center px-2 hover:text-white" href="/latest">
            Последнее
          </Link>
          <Link className="inline-flex min-h-11 items-center px-2 hover:text-white" href="/top">
            ТОП
          </Link>
          <Link className="inline-flex min-h-11 items-center px-2 hover:text-white" href="/favorites">
            Избранное
          </Link>
          <Link className="inline-flex min-h-11 items-center px-2 hover:text-white" href="/history">
            Недавно смотрели
          </Link>
          <Link className="inline-flex min-h-11 items-center px-2 hover:text-white" href="/privacy">
            Конфиденциальность
          </Link>
          <Link className="inline-flex min-h-11 items-center px-2 hover:text-white" href="/terms">
            Условия использования
          </Link>
        </nav>

        <div className="text-sm text-[#74757d] md:text-right">
          <p>© {new Date().getFullYear()} REDFILM</p>

          <a
            href="https://t.me/seimngr"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 items-center leading-relaxed text-[#74757d] transition-colors hover:text-white"
          >
            Сотрудничество и поддержка в Telegram
          </a>
        </div>
      </div>
    </footer>
  );
}
