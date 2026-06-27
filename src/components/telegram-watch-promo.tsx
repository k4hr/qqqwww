const TELEGRAM_BOT_URL = "https://t.me/redfilm_cinemabot";

export function TelegramWatchPromo() {
  return (
    <aside className="telegram-watch-promo mt-4 rounded-[20px] border border-white/10 bg-[#0b0b10]/80 px-4 py-3 shadow-[0_18px_44px_rgba(0,0,0,.32),0_0_24px_rgba(229,9,20,.08)] backdrop-blur-md sm:mt-5 sm:px-5 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#e50914,#ff3340)] text-white shadow-[0_0_22px_rgba(229,9,20,.28)]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" focusable="false">
              <path d="M20.7 4.3c.28-.13.59.1.52.41l-2.73 13.08c-.08.38-.53.55-.85.32l-4.23-3.1-2.16 2.1c-.24.23-.65.12-.74-.2l-.98-3.52-3.94-1.27c-.41-.13-.45-.7-.06-.9L20.7 4.3Zm-3.16 3.3-8.2 5.02.72 2.59.5-1.58c.06-.2.2-.37.38-.49l6.6-5.54Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-black leading-tight text-white sm:text-lg">Смотрите REDFILM в Telegram</h3>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#b9b9c0]">Открывайте фильмы и сериалы прямо в Telegram — удобно с телефона, без лишних переходов.</p>
          </div>
        </div>
        <a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Открыть REDFILM в Telegram"
          className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#e50914] px-4 py-2.5 text-sm font-black text-white shadow-[0_12px_28px_rgba(229,9,20,.28)] transition hover:bg-[#ff1824] sm:min-w-[168px]"
        >
          Открыть в Telegram
        </a>
      </div>
    </aside>
  );
}
