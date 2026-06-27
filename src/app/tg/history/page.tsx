import { TgLibraryList } from "@/components/tg/tg-library-list";

export const dynamic = "force-dynamic";

export default function TgHistoryPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-black">История просмотра</h1>
      <TgLibraryList type="history" />
    </div>
  );
}
