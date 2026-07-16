import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { isPublicPreview } from "@/lib/runtime/public-preview";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "SECC — Evidência em contexto", template: "%s | SECC" },
  description: "Pesquisa acadêmica e informacional sobre empresas brasileiras em estresse e reestruturação."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publicPreview = isPublicPreview();
  return <html lang="pt-BR"><body><div className="demo-ribbon">{publicPreview ? "PRÉVIA PÚBLICA EM CONSTRUÇÃO · DADOS FICTÍCIOS" : "AMBIENTE LOCAL · BASE OPERACIONAL PRIVADA · PUBLICAÇÃO CONTROLADA"}</div><SiteHeader />{children}<footer className="footer"><div className="shell">Finalidade acadêmica e informacional. O conteúdo não constitui recomendação de crédito ou investimento.</div></footer></body></html>;
}
