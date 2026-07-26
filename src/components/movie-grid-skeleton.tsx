export function MovieGridSkeleton({ count = 6, panel = false }: { count?: number; panel?: boolean }) {
  const grid = <div className="movie-grid">{Array.from({ length: count }, (_, index) => <div key={index} className="mf-card overflow-hidden"><div className="skeleton aspect-[2/3]" /><div className="space-y-2 p-3"><div className="skeleton h-4 w-4/5 rounded" /><div className="skeleton h-4 w-1/2 rounded" /></div></div>)}</div>;
  return panel ? <section className="rf-section"><div className="skeleton mb-5 h-7 w-52 rounded-lg" />{grid}</section> : grid;
}
