export function RouteLoading({ variant = "catalog" }: { variant?: "watch" | "catalog" | "match" | "library" }) {
  if (variant === "watch") {
    return (
      <div className="pb-7">
        <section className="relative min-h-[500px] overflow-hidden bg-[#08080c]">
          <div className="absolute inset-0 skeleton" />
          <div className="absolute inset-0 bg-[linear-gradient(0deg,#050505_0%,rgba(5,5,5,.76)_32%,transparent_100%)]" />
          <div className="container relative z-10 flex min-h-[500px] items-end pb-8 pt-20">
            <div className="grid w-full gap-5 sm:grid-cols-[130px_minmax(0,1fr)] lg:grid-cols-[176px_minmax(0,1fr)]">
              <div className="skeleton aspect-[2/3] rounded-[14px]" />
              <div className="space-y-4">
                <div className="skeleton h-4 w-20 rounded" />
                <div className="skeleton h-12 max-w-2xl rounded-xl" />
                <div className="skeleton h-5 max-w-2xl rounded" />
                <div className="flex flex-wrap gap-3">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-4 w-16 rounded" />)}</div>
              </div>
            </div>
          </div>
        </section>
        <div className="container mt-6">
          <div className="skeleton aspect-video rounded-[14px]" />
          <LoadingCards />
        </div>
      </div>
    );
  }

  if (variant === "match") {
    return (
      <div className="container py-6 sm:py-8">
        <div className="border-b border-white/[.07] pb-8">
          <div className="skeleton h-4 w-28 rounded" />
          <div className="skeleton mt-4 h-12 max-w-xl rounded-xl" />
          <div className="skeleton mt-4 h-5 max-w-2xl rounded" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="skeleton min-h-[520px] rounded-[18px]" />
          <LoadingCards count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6">
      <section className="rf-catalog-intro mb-7">
        <div className="skeleton h-11 max-w-xl rounded-xl" />
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
        <div key={index} className="mf-card">
          <div className="skeleton aspect-[2/3] rounded-[12px]" />
          <div className="space-y-3 pt-3">
            <div className="skeleton h-4 rounded" />
            <div className="skeleton h-3 w-2/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
