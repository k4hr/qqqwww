import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function AdminSimilarityRedirectPage({ searchParams }: Props) {
  const params = await searchParams;
  const q = params.q?.trim();
  redirect(q ? `/admin/catalog?similarityQ=${encodeURIComponent(q)}#similarity` : "/admin/catalog#similarity");
}
