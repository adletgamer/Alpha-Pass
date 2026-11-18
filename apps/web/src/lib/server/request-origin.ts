export class InvalidOriginError extends Error {
  constructor() {
    super("Origen no permitido");
  }
}

/** Protección de origen para escrituras del navegador; no autentica al usuario. */
export function assertMutationOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) throw new InvalidOriginError();
  try {
    const url = new URL(origin);
    if (url.host !== host || url.protocol !== new URL(request.url).protocol) {
      throw new InvalidOriginError();
    }
  } catch {
    throw new InvalidOriginError();
  }
}
