import rawShowcase from "../../../data/public/showcase.json";

export type PublicCompany = (typeof rawShowcase.companies)[number];

export const publicShowcase = rawShowcase;

export function getPublicCompany(slug: string) {
  return publicShowcase.companies.find((company) => company.slug === slug);
}

export function formatMillions(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + " mi";
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + "%";
}

export function formatMultiple(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + "x";
}
