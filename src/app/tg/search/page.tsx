import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function TgSearchRedirect({ searchParams }: Props) {
  const q = (await searchParams).q?.trim();
  redirect(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
}
