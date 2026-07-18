import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/site-header";
import { isPublicPreview } from "@/lib/runtime/public-preview";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "SECC — Evidência em contexto", template: "%s | SECC" },
  description: "Trajetórias financeiras, score experimental, fontes e qualidade de dados de empresas brasileiras em estresse e reestruturação.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publicPreview = isPublicPreview();
  return (
    <html lang="pt-BR">
      <body>
        <div className="demo-ribbon">{publicPreview ? "SNAPSHOT PÚBLICO SANITIZADO · SHOWCASE-2026.07" : "CURADORIA PROTEGIDA · BASE OPERACIONAL PRIVADA · PUBLICAÇÃO CONTROLADA"}</div>
        <SiteHeader />
        {children}
        <footer className="footer"><div className="shell">Finalidade acadêmica e informacional. O conteúdo e o score experimental não constituem rating, recomendação de crédito ou investimento.</div></footer>
      </body>
    </html>
  );
}
