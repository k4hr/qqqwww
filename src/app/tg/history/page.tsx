<<<<<<< HEAD
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TgHistoryRedirect() {
  redirect("/history");
=======
import { TgLibraryList } from "@/components/tg/tg-library-list";

export const dynamic = "force-dynamic";

export default function TgHistoryPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-black">История просмотра</h1>
      <TgLibraryList type="history" />
    </div>
  );
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
}
