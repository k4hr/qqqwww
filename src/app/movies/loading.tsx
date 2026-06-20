import { MovieGridSkeleton } from "@/components/movie-grid-skeleton";

export default function MoviesLoading() {
  return <div className="container py-6"><div className="skeleton mb-6 h-48 rounded-[24px]" /><MovieGridSkeleton count={12} /></div>;
}
