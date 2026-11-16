import "server-only";

// Lectura de secretos en el servidor. Nunca importar desde un componente cliente.

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new MissingEnvError(name);
  return v.trim();
}

export class MissingEnvError extends Error {
  constructor(public readonly variable: string) {
    super(`Falta la variable de entorno ${variable}. Ver apps/web/.env.example.`);
  }
}

export const serverEnv = {
  network: process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet",
  rpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org",
  lotPassportId: () => req("NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID"),
  trustlessWork: () => ({
    url: process.env.TRUSTLESS_WORK_API_URL?.trim() || "https://beta.api.trustlesswork.com",
    key: req("TRUSTLESS_WORK_API_KEY"),
  }),
  acta: () => ({
    url: process.env.ACTA_API_URL?.trim() || "https://sandbox-api.acta.build",
    key: req("ACTA_API_KEY"),
  }),
  whisp: () => ({
    url: process.env.WHISP_API_URL?.trim() || "https://whisp.openforis.org",
    key: req("WHISP_API_KEY"),
  }),
  roles: () => ({
    approverSecret: req("ALPHA_APPROVER_SECRET"),
    approver: req("ALPHA_APPROVER_PUBLIC"),
    admin: req("ALPHA_ADMIN_PUBLIC"),
    disputeResolver: req("ALPHA_DISPUTE_RESOLVER_PUBLIC"),
    platform: req("ALPHA_PLATFORM_PUBLIC"),
  }),
};

export function errorResponse(err: unknown, fallbackStatus = 500) {
  if (err instanceof MissingEnvError) {
    return Response.json({ code: "not_configured", message: err.message }, { status: 503 });
  }
  const message = err instanceof Error ? err.message : "Error inesperado";
  return Response.json({ code: "error", message }, { status: fallbackStatus });
}

/** Rechaza llamadas que no vienen de la propia app (evita usar el proxy como relay abierto). */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    throw new Error("Origen no permitido");
  }
}
