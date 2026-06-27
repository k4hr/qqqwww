<<<<<<< HEAD
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function TgFavoritesRedirect() {
  redirect("/favorites");
=======
import { TgLibraryList } from "@/components/tg/tg-library-list";

export const dynamic = "force-dynamic";

export default function TgFavoritesPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-black">Избранное</h1>
      <TgLibraryList type="favorites" />
    </div>
  );
>>>>>>> f1dfcac89a507e51aea244136d8ffd51e6b84be5
}
