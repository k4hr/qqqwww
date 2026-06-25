import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await params;
  return {
    title: "Страница не найдена — REDFILM",
    robots: { index: false, follow: false },
  };
}

export default async function PersonPage({ params }: Props) {
  await params;
  notFound();
}
