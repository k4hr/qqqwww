import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container py-16 text-center">
      <h1 className="text-4xl font-bold mb-4">Страница не найдена</h1>
      <p className="text-neutral-600 mb-6">Такой карточки или раздела пока нет в базе REDFILM.</p>
      <Link href="/" className="bg-mario-green text-white font-bold px-6 py-3">На главную</Link>
    </div>
  );
}
