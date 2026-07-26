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
    <div className="min-w-0">
      <div className="mb-2 text-[11px] font-medium text-[#74757d]">Страна</div>
      <nav className="country-filter rf-filter-row max-w-full" aria-label="Фильтр по стране">
        {COUNTRY_FILTER_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={countryHref(option.value, preserve)}
            aria-current={activeCountry === option.value ? "page" : undefined}
            className={`${activeCountry === option.value ? "rf-filter rf-filter-active" : "rf-filter"} shrink-0`}
          >
            {option.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
