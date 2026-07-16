import { readFile } from "node:fs/promises";
import { requireRole } from "@/lib/auth/server";
import { safeOutputPath } from "@/lib/excel/local-files";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
): Promise<Response> {
  await requireRole("admin");
  try {
    const { name } = await params;
    const file = await readFile(safeOutputPath(name));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Arquivo não encontrado.", { status: 404 });
  }
}
