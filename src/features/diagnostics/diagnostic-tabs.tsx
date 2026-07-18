import Link from "next/link";

export function DiagnosticTabs({ active }: { active: "dashboard" | "master" | "comparison" }) {
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
    </nav>
  );
}
