import { requireRole } from "@/lib/auth/server";

const header = "ano;variavel;valor;unidade;disponibilidade;organizacao_fonte;titulo_fonte;url_fonte;data_referencia;observacao\r\n";

export async function GET(): Promise<Response> {
  await requireRole("admin");
  return new Response(`\uFEFF${header}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modelo-importacao-secc.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
