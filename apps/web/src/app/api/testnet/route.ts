// Preparar una wallet para probar el flujo en Stellar Testnet.
//   status:   saldos, trustline de USDC y rol de verificador
//   fund:     XLM de prueba con friendbot
//   usdc:     XDR sin firmar (trustline + compra de USDC de prueba con su propio XLM)
//   submit:   envía a Horizon ese XDR firmado por la wallet
//   verifier: registra la wallet como verificadora de prueba en LotPassport
import { assertSameOrigin, errorResponse } from "@/lib/server/env";
import {
  assertAddress,
  assertTestnet,
  buildGetUsdcTx,
  fundWithFriendbot,
  registerTestVerifier,
  submitClassic,
  walletStatus,
} from "@/lib/server/testnet";

// Límite simple por IP para no gastar las comisiones de la cuenta administradora.
const hits = new Map<string, number[]>();
function limited(request: Request, max: number) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > max;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertTestnet();
    const body = (await request.json()) as { action?: string; address?: string; signedXdr?: string };
    if (body.action === "submit") {
      if (typeof body.signedXdr !== "string") throw new Error("Falta la transacción firmada.");
      return Response.json(await submitClassic(body.signedXdr));
    }
    assertAddress(body.address);
    switch (body.action) {
      case "status":
        return Response.json(await walletStatus(body.address));
      case "fund":
        if (limited(request, 10)) return Response.json({ code: "limit", message: "Demasiadas solicitudes. Espera unos minutos." }, { status: 429 });
        return Response.json(await fundWithFriendbot(body.address));
      case "usdc":
        return Response.json({ unsignedXdr: await buildGetUsdcTx(body.address) });
      case "verifier": {
        if (limited(request, 4)) return Response.json({ code: "limit", message: "Demasiadas solicitudes. Espera unos minutos." }, { status: 429 });
        const status = await walletStatus(body.address);
        if (!status.exists) throw new Error("La cuenta todavía no existe en Testnet: pide XLM primero.");
        return Response.json(await registerTestVerifier(body.address));
      }
      default:
        return Response.json({ code: "invalid", message: "Acción desconocida" }, { status: 400 });
    }
  } catch (err) {
    return errorResponse(err, 400);
  }
}
