import { getData } from "country-list";

// PREVIEW_ONLY: ISO 3166-1 alpha-2 list. Country flags are served from bundled local assets.
const displayNames = new Intl.DisplayNames(["zh-CN"], { type: "region" });

export const countries = getData().map(({ code, name }) => ({
  code: code.toLowerCase(),
  english: name.replace(/ \(the\)$/, ""),
  chinese: displayNames.of(code) || name,
})).sort((a, b) => a.english.localeCompare(b.english));

export const countryByCode = Object.fromEntries(countries.map((country) => [country.code, country]));
export const flagUrl = (code) => {
  const normalized = String(code || "").toLowerCase();
  return countryByCode[normalized] ? `/assets/flags/${normalized}.svg` : "/assets/flags/unknown.svg";
};
