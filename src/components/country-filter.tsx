import Link from "next/link";
import { COUNTRY_FILTER_OPTIONS, normalizeCatalogCountry } from "@/lib/catalog-filters";

type Props = {
  country?: string;
  preserve?: Record<string, string | undefined>;
};

function countryHref(value: string, preserve: Props["preserve"]) {
  const params = new URLSearchParams();
  for (const [key, item] of Object.entries(preserve ?? {})) {
    if (item) params.set(key, item);
  }
  params.set("country", value);
  return `?${params.toString()}`;
}

export function CountryFilter({ country, preserve }: Props) {
  const activeCountry = normalizeCatalogCountry(country);

  return (
    <div className="mt-5 min-w-0">
      <div className="mb-2 text-xs font-black uppercase tracking-[.14em] text-[#777781]">Страна</div>
      <nav className="country-filter flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Фильтр по стране">
        {COUNTRY_FILTER_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={countryHref(option.value, preserve)}
            aria-current={activeCountry === option.value ? "page" : undefined}
            className={`mf-pill min-h-11 shrink-0 ${activeCountry === option.value ? "active border-[#e50914] bg-[#e50914] text-white" : ""}`}
          >
            {option.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
