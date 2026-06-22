import Link from "next/link";
import { disableAllVibixAds, saveVibixAdSettings } from "./actions";
import {
  VIBIX_BANNER_SIZES,
  VIBIX_BANNER_SLOT_DEFINITIONS,
  VIBIX_FLYROLL_POSITIONS,
  VIBIX_FLYROLL_SLOTS,
  ensureVibixAdSettings,
  getEnabledVibixAdTypes,
  getVibixAdSettings,
  getVibixBannerSlot,
} from "@/lib/vibix-ads";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ saved?: string; disabled?: string }>;
};

export default async function AdminAdsPage({ searchParams }: Props) {
  const params = await searchParams;
  await ensureVibixAdSettings();
  const settings = await getVibixAdSettings();
  const enabledTypes = getEnabledVibixAdTypes(settings);
  const dataAddTypes = enabledTypes.join(",") || "—";

  return (
    <div className="container admin-shell py-6">
      <Link href="/admin" className="text-sm text-neutral-500 hover:text-[#e50914]">← Назад в админку</Link>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#222]">Реклама Vibix</h1>
          <p className="mt-2 max-w-4xl text-neutral-600">Управление реальными форматами Vibix: sticker, pcsticker, banners, brand и flyroll. Галочки сразу управляют тем, что попадёт в data-add_types.</p>
        </div>
        <form action={disableAllVibixAds}>
          <button type="submit" className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 font-black text-red-700 hover:bg-red-100">Отключить всю рекламу</button>
        </form>
      </div>

      {params.saved ? <div className="mt-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 font-bold text-green-800">Настройки рекламы сохранены.</div> : null}
      {params.disabled ? <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 font-bold text-amber-800">Вся реклама Vibix отключена.</div> : null}

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <StatusCard title="Общий статус" value={settings.enabled ? "Включена" : "Выключена"} tone={settings.enabled ? "green" : "red"} />
        <StatusCard title="data-add_types" value={dataAddTypes} tone="dark" />
        <StatusCard title="Publisher ID" value={settings.publisherId} tone="dark" />
      </div>

      <form action={saveVibixAdSettings} className="admin-panel mt-6 p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
            <h2 className="text-xl font-black text-[#222]">Основной скрипт</h2>
            <p className="mt-2 text-sm text-neutral-600">Если общий переключатель выключен, компонент вообще не вставляет Vibix script и не рендерит рекламные ins-блоки.</p>
            <div className="mt-5 grid gap-4">
              <label className="flex items-center gap-3 rounded-xl bg-[#f6f6f6] px-4 py-3 font-bold text-[#222]"><input name="enabled" type="checkbox" defaultChecked={settings.enabled} /> Включить рекламу Vibix на сайте</label>
              <label className="grid gap-1 text-sm font-bold text-[#333]">Publisher ID
                <input name="publisherId" defaultValue={settings.publisherId} className="h-11 rounded-xl border border-[#ddd] bg-white px-3 text-[#222] outline-none focus:border-[#e50914]" />
              </label>
              <label className="grid gap-1 text-sm font-bold text-[#333]">Script URL
                <input name="scriptUrl" defaultValue={settings.scriptUrl} className="h-11 rounded-xl border border-[#ddd] bg-white px-3 text-[#222] outline-none focus:border-[#e50914]" />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5">
            <h2 className="text-xl font-black text-[#222]">Форматы data-add_types</h2>
            <p className="mt-2 text-sm text-neutral-600">Это ровно те форматы, которые Vibix описывает в настройках. Включённые форматы собираются в data-add_types.</p>
            <div className="mt-5 grid gap-3">
              <FormatCheckbox name="stickerEnabled" checked={settings.stickerEnabled} code="sticker" title="Mobile Catfish" description="Анимированный креатив в нижней части сайта на мобильном устройстве." />
              <FormatCheckbox name="pcStickerEnabled" checked={settings.pcStickerEnabled} code="pcsticker" title="PC Catfish" description="Анимированный креатив в нижней части сайта на ПК." />
              <FormatCheckbox name="bannersEnabled" checked={settings.bannersEnabled} code="banners" title="Баннеры" description="Баннеры размеров 300x250, 300x600, 680x200, 680x250, 728x90." />
              <FormatCheckbox name="brandEnabled" checked={settings.brandEnabled} code="brand" title="Brand background" description="Брендирование фона сайта. Может ломать адаптацию дизайна, включать осторожно." warning />
              <FormatCheckbox name="flyrollEnabled" checked={settings.flyrollEnabled} code="flyroll" title="Fly-roll" description="Автоматически вставляемый рекламный ролик." />
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-2xl border border-[#e5e5e5] bg-white p-5">
          <h2 className="text-xl font-black text-[#222]">Fly-roll</h2>
          <p className="mt-2 text-sm text-neutral-600">Позиция попадает в data-position. Ручной ins data-pm-flyroll можно поставить над или под плеером, либо оставить автоматическую фиксацию.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1 text-sm font-bold text-[#333]">Позиция
              <select name="flyrollPosition" defaultValue={settings.flyrollPosition} className="h-11 rounded-xl border border-[#ddd] bg-white px-3 text-[#222] outline-none focus:border-[#e50914]">
                {VIBIX_FLYROLL_POSITIONS.map((position) => <option key={position.value} value={position.value}>{position.label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-bold text-[#333]">Ручное место вставки
              <select name="flyrollManualSlot" defaultValue={settings.flyrollManualSlot} className="h-11 rounded-xl border border-[#ddd] bg-white px-3 text-[#222] outline-none focus:border-[#e50914]">
                {VIBIX_FLYROLL_SLOTS.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-[#e5e5e5] bg-white p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-xl font-black text-[#222]">Баннеры Vibix</h2>
              <p className="mt-2 text-sm text-neutral-600">Работают только если включён формат banners. В слот рендерится ins data-pm-b="размер".</p>
            </div>
            <div className="rounded-xl bg-[#f6f6f6] px-4 py-2 text-xs font-bold text-neutral-600">Доступные размеры: {VIBIX_BANNER_SIZES.join(", ")}</div>
          </div>

          <div className="mt-5 grid gap-4">
            {VIBIX_BANNER_SLOT_DEFINITIONS.map((definition) => {
              const slot = getVibixBannerSlot(settings, definition.key);
              return (
                <div key={definition.key} className="rounded-2xl border border-[#eee] bg-[#fafafa] p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="font-black text-[#222]">{definition.title}</div>
                      <div className="mt-1 text-sm text-neutral-600">{definition.description}</div>
                      <code className="mt-2 inline-block rounded-lg bg-white px-2 py-1 text-xs text-[#e50914]">slot: {definition.key}</code>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm font-bold text-[#333]">
                      <label className="flex items-center gap-2"><input name={`${definition.key}_enabled`} type="checkbox" defaultChecked={slot.enabled} /> Включить</label>
                      <label className="flex items-center gap-2"><input name={`${definition.key}_desktop`} type="checkbox" defaultChecked={slot.desktop} /> ПК</label>
                      <label className="flex items-center gap-2"><input name={`${definition.key}_mobile`} type="checkbox" defaultChecked={slot.mobile} /> Мобилка</label>
                    </div>
                  </div>
                  <label className="mt-4 grid gap-1 text-sm font-bold text-[#333] md:max-w-xs">Размер баннера
                    <select name={`${definition.key}_size`} defaultValue={slot.size} className="h-11 rounded-xl border border-[#ddd] bg-white px-3 text-[#222] outline-none focus:border-[#e50914]">
                      {VIBIX_BANNER_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </label>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="submit" className="rounded-xl bg-[#e50914] px-6 py-3 font-black text-white hover:bg-[#c90710]">Сохранить настройки рекламы</button>
          <Link href="/" className="rounded-xl border border-[#ddd] bg-white px-6 py-3 font-black text-[#222] hover:bg-[#f7f7f7]">Открыть главную</Link>
        </div>
      </form>
    </div>
  );
}

function StatusCard({ title, value, tone }: { title: string; value: string; tone: "green" | "red" | "dark" }) {
  const color = tone === "green" ? "text-green-700" : tone === "red" ? "text-red-700" : "text-[#222]";
  return <div className="admin-panel p-4"><div className="text-sm text-neutral-500">{title}</div><div className={`mt-1 break-words text-2xl font-black ${color}`}>{value}</div></div>;
}

function FormatCheckbox({ name, checked, code, title, description, warning }: { name: string; checked: boolean; code: string; title: string; description: string; warning?: boolean }) {
  return (
    <label className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${warning ? "border-amber-200 bg-amber-50" : "border-[#eee] bg-[#fafafa]"}`}>
      <input name={name} type="checkbox" defaultChecked={checked} className="mt-1" />
      <span className="min-w-0">
        <span className="block font-black text-[#222]"><code className="rounded bg-white px-1.5 py-0.5 text-[#e50914]">{code}</code> — {title}</span>
        <span className="mt-1 block text-sm font-normal text-neutral-600">{description}</span>
      </span>
    </label>
  );
}
