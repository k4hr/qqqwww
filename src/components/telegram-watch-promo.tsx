const TELEGRAM_BOT_URL = "https://t.me/redfilm_cinemabot";

export function TelegramWatchPromo() {
  return (
    <aside className="telegram-watch-promo rf-telegram-promo mt-4 px-1 py-3 sm:mt-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/[.045] text-[#c5c6cc]" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" focusable="false">
              <path d="M20.7 4.3c.28-.13.59.1.52.41l-2.73 13.08c-.08.38-.53.55-.85.32l-4.23-3.1-2.16 2.1c-.24.23-.65.12-.74-.2l-.98-3.52-3.94-1.27c-.41-.13-.45-.7-.06-.9L20.7 4.3Zm-3.16 3.3-8.2 5.02.72 2.59.5-1.58c.06-.2.2-.37.38-.49l6.6-5.54Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold leading-tight text-white sm:text-base">REDFILM в Telegram</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-[#8f9098] sm:text-sm">Открывайте фильмы и сериалы с телефона без лишних переходов.</p>
          </div>
        </div>
        <a
          href={TELEGRAM_BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Открыть REDFILM в Telegram"
          className="mf-btn shrink-0"
        >
          Открыть в Telegram
        </a>
      </div>
    </aside>
  );
}
