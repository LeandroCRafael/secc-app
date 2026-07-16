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

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return unauthorized();

  try {
    const [user, password] = atob(authorization.slice(6)).split(":", 2);
    if (user === expectedUser && password === expectedPassword) return NextResponse.next();
  } catch {
    return unauthorized();
  }

  return unauthorized("Credenciais inválidas.");
}

export const config = { matcher: ["/admin/:path*"] };
