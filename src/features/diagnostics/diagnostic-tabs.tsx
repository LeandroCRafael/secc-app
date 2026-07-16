import Link from "next/link";

export function DiagnosticTabs({ active }: { active: "dashboard" | "master" }) {
  return (
    <nav className="diagnostic-tabs" aria-label="Visões do diagnóstico">
      <Link className={active === "dashboard" ? "active" : undefined} href="/admin">
        Dashboard
      </Link>
      <Link className={active === "master" ? "active" : undefined} href="/admin/empresas">
        Visão mestre
      </Link>
    </nav>
  );
}
