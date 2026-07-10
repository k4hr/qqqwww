import { partnerLogin } from "@/app/partner/actions";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PartnerLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  const error = first(params.error);
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-10">
      <section className="mf-panel w-full max-w-md p-6">
        <h1 className="text-3xl font-black text-white">Кабинет партнёра</h1>
        <p className="mt-2 text-[#a1a1aa]">Вход для блогеров и авторов подборок REDFILM.</p>
        {error ? <div className="mt-4 rounded-xl border border-[#e50914]/40 bg-[#e50914]/10 p-3 text-sm text-white">{error === "rate" ? "Слишком много попыток входа. Попробуйте позже." : "Неверный логин или пароль."}</div> : null}
        <form action={partnerLogin} className="mt-5 grid gap-3">
          <label className="grid gap-1 text-sm font-bold text-white">Логин<input name="login" required className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white outline-none focus:border-[#e50914]" /></label>
          <label className="grid gap-1 text-sm font-bold text-white">Пароль<input name="password" type="password" required className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-white outline-none focus:border-[#e50914]" /></label>
          <button className="rounded-xl bg-[#e50914] px-4 py-3 font-black text-white">Войти</button>
        </form>
      </section>
    </div>
  );
}
