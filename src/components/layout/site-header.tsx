import Link from "next/link";

const links = [
  ["Empresas", "/empresas"], ["Comparar", "/comparar"], ["Metodologia", "/metodologia"],
  ["Dados", "/dados"], ["Plataforma", "/plataforma"], ["Sobre", "/sobre"]
] as const;

export function SiteHeader() {
  return <header className="site-header"><div className="shell header-row">
    <Link href="/" className="brand"><span className="brand-mark">SECC</span><span>Evidência em contexto</span></Link>
    <nav className="nav" aria-label="Navegação principal">{links.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}{/* âncora pura (não Link): a Curadoria exige navegação completa para o Basic Auth
    disparar no clique — e nunca antes, via prefetch/fetch em página pública */}
<a className="admin-link" href="/admin">Curadoria →</a></nav>
  </div></header>;
}
