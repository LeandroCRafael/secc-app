import { NextResponse, type NextRequest } from "next/server";

function unauthorized(message = "Autenticação necessária.") {
  return new NextResponse(message, {
    status: 401,
    headers: {
      "Cache-Control": "private, no-store",
      "WWW-Authenticate": 'Basic realm="SECC Interno", charset="UTF-8"',
    },
  });
}

export function proxy(request: NextRequest) {
  if (process.env.INTERNAL_DASHBOARD_ENABLED !== "true") return NextResponse.next();

  const expectedUser = process.env.INTERNAL_ACCESS_USER;
  const expectedPassword = process.env.INTERNAL_ACCESS_PASSWORD;
  if (!expectedUser || !expectedPassword) return new NextResponse("Acesso interno não configurado.", { status: 503 });

  // O desafio Basic (WWW-Authenticate) só pode ir para navegação real (Accept: text/html).
  // Prefetch e fetches RSC em páginas públicas recebem 401 silencioso — senão o navegador
  // abre o popup de login na home. Headers internos do Next não são confiáveis aqui
  // porque a borda da Vercel pode removê-los; o Accept é determinístico.
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) {
    const isNavigation = (request.headers.get("accept") ?? "").includes("text/html");
    if (!isNavigation) return new NextResponse(null, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    return unauthorized();
  }

  try {
    const [user, password] = atob(authorization.slice(6)).split(":", 2);
    if (user === expectedUser && password === expectedPassword) return NextResponse.next();
  } catch {
    return unauthorized();
  }

  return unauthorized("Credenciais inválidas.");
}

export const config = { matcher: ["/admin/:path*"] };
