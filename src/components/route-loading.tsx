export function RouteLoading({ variant = "catalog" }: { variant?: "watch" | "catalog" | "match" | "library" }) {
  if (variant === "watch") {
    return (
      <div className="pb-7">
        <section className="relative min-h-[56svh] overflow-hidden bg-[#08080c]">
          <div className="absolute inset-0 skeleton" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,#050505_0%,rgba(5,5,5,.76)_32%,transparent_100%)]" />
          <div className="container relative z-10 flex min-h-[56svh] items-end pb-8 pt-20">
            <div className="grid w-full gap-5 sm:grid-cols-[130px_minmax(0,1fr)] lg:grid-cols-[210px_minmax(0,1fr)]">
              <div className="skeleton aspect-[2/3] rounded-3xl" />
              <div className="space-y-4">
                <div className="skeleton h-6 w-24 rounded-full" />
                <div className="skeleton h-14 max-w-3xl rounded-2xl" />
                <div className="skeleton h-5 max-w-2xl rounded" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
              </div>
            </div>
          </div>
        </section>
        <div className="container mt-6">
          <div className="skeleton aspect-video rounded-[26px]" />
          <LoadingCards />
        </div>
      </div>
    );
  }

  if (variant === "match") {
    return (
      <div className="container py-5 sm:py-7">
        <div className="skeleton min-h-[520px] rounded-[32px]" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="skeleton min-h-[560px] rounded-[28px]" />
          <LoadingCards count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <section className="glass-panel section-glow mb-6 rounded-[24px] p-5 sm:p-6">
        <div className="skeleton h-12 max-w-xl rounded-2xl" />
        <div className="skeleton mt-4 h-5 max-w-3xl rounded" />
      </section>
      <LoadingCards count={variant === "library" ? 8 : 12} />
    </div>
  );
}

function LoadingCards({ count = 12 }: { count?: number }) {
  return (
    <div className="movie-grid mt-6">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="mf-card overflow-hidden">
          <div className="skeleton aspect-[2/3]" />
          <div className="space-y-3 p-3">
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
