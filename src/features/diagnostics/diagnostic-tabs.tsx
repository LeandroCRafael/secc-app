import Link from "next/link";

export function DiagnosticTabs({ active }: { active: "dashboard" | "master" | "comparison" | "score" }) {
  return (
    <nav className="diagnostic-tabs" aria-label="Visões do diagnóstico">
      <Link className={active === "dashboard" ? "active" : undefined} href="/admin">
        Dashboard
      </Link>
      <Link className={active === "master" ? "active" : undefined} href="/admin/empresas">
        Visão mestre
      </Link>
      <Link className={active === "comparison" ? "active" : undefined} href="/admin/comparar">
        Comparador
      </Link>
      <Link className={active === "score" ? "active" : undefined} href="/admin/score">
        Score experimental
      </Link>
    </nav>
  );
}
