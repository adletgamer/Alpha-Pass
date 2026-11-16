// Proxy hacia la API de ACTA: el navegador usa el SDK oficial apuntando a
// /api/acta y este servidor agrega la clave X-ACTA-Key, que nunca llega al cliente.
import { assertSameOrigin, errorResponse, serverEnv } from "@/lib/server/env";

async function forward(request: Request, path: string[]) {
  try {
    assertSameOrigin(request);
    const { url, key } = serverEnv.acta();
    const search = new URL(request.url).search;
    const target = `${url}/${path.map(encodeURIComponent).join("/")}${search}`;
    const init: RequestInit = {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        Accept: "application/json",
        "X-ACTA-Key": key,
      },
    };
    if (request.method !== "GET" && request.method !== "HEAD") init.body = await request.text();
    const res = await fetch(target, init);
    return new Response(await res.text(), {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    return errorResponse(err, 502);
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, { params }: Ctx) {
  return forward(request, (await params).path);
}
export async function POST(request: Request, { params }: Ctx) {
  return forward(request, (await params).path);
}
export async function PUT(request: Request, { params }: Ctx) {
  return forward(request, (await params).path);
}
export async function DELETE(request: Request, { params }: Ctx) {
  return forward(request, (await params).path);
}
