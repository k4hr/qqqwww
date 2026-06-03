import { ContentType } from "@prisma/client";
import { ListPage } from "@/lib/list-page";
export const dynamic = "force-dynamic";
export default function Page() { return <ListPage title="Фильмы" type={ContentType.MOVIE} />; }
