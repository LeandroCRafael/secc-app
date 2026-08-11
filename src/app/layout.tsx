import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";
import { SiteHeader } from "@/components/layout/site-header";
import { isPublicPreview } from "@/lib/runtime/public-preview";
import "@/styles/globals.css";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jbmono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "SECC — Evidência em contexto", template: "%s | SECC" },
  description: "Trajetórias financeiras, score experimental, fontes e qualidade de dados de empresas brasileiras em estresse e reestruturação.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publicPreview = isPublicPreview();
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${jetBrainsMono.variable}`}>
      <body>
        <div className="demo-ribbon">{publicPreview ? "Snapshot público sanitizado · showcase-2026.07" : "Curadoria protegida · base operacional privada · publicação controlada"}</div>
        <SiteHeader />
        {children}
        <footer className="footer"><div className="shell">Finalidade acadêmica e informacional. O conteúdo e o score experimental não constituem rating, recomendação de crédito ou investimento.</div></footer>
      </body>
    </html>
  );
}
