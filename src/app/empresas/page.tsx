import Link from "next/link";
import { demoCompanies } from "@/features/demo/data";

export const metadata = { title: "Empresas" };
export default function CompaniesPage() { return <main className="shell page"><p className="eyebrow">Portfólio demonstrativo</p><h1>Empresas e eventos em contexto.</h1><p className="lede">Os três registros abaixo são fictícios e existem apenas para validar navegação, estados e contratos.</p><section className="section grid three">{demoCompanies.map((company) => <article className="card" key={company.id}><span className="status">Demo</span><h3 style={{marginTop: 16}}>{company.name}</h3><p>{company.sector} · evento em {company.eventYear}</p><Link className="button secondary" href={`/empresas/${company.slug}`}>Ver Empresa 360</Link></article>)}</section></main>; }
