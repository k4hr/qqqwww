import { MovieGridSkeleton } from "@/components/movie-grid-skeleton";

export default function Loading() {
  return <div className="container py-6"><div className="skeleton h-[min(62vh,620px)] rounded-[30px]" /><MovieGridSkeleton count={12} panel /></div>;
}
