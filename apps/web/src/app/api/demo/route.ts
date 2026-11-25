// Demo guiada en Stellar Testnet con una sola wallet.
//   status         qué cuentas de la casa y qué emisora ACTA están configuradas
//   prepare        deja lista la wallet del usuario para su rol (como máximo una firma)
//   start          crea un lote de demo y evalúa sus parcelas con Whisp (FAO)
//   credential     ACTA emite la credencial W3C del lote (firma la emisora ACTA)
//   anchor         LotPassport.create_lot (firma la cooperativa)
//   escrow-deploy  crea el escrow de 3 hitos en Trustless Work (firma el importador)
//   escrow-fund    deposita los USDC de prueba (firma el importador)
//   attest         atestación de un hito en LotPassport (firma el verificador)
//   release        aprueba y libera el hito si LotPassport lo confirma (firma Alpha Pass)
//   submit         envía un XDR firmado por la wallet del usuario
// Cuando el paso es del rol del usuario, la respuesta trae { signer: "user", unsignedXdr }.
import { assertSameOrigin, errorResponse } from "@/lib/server/env";
import { TW, TrustlessWorkError } from "@/lib/server/trustless-work";
import { assertAddress, assertTestnet, buildGetUsdcTx, buildUsdcTrustlineTx, fundWithFriendbot, submitClassic, walletStatus } from "@/lib/server/testnet";
import { houseConfigured, houseKeypair, submitSoroban } from "@/lib/server/house";
import { actaIssuerConfigured } from "@/lib/server/acta-issuer";
import { WhispError } from "@/lib/server/whisp-assess";
import { TESTNET_ESCROW_AMOUNT } from "@/lib/sample-data";
import * as demo from "@/lib/server/demo";

const ROLES = ["cooperativa", "importador", "verificador"] as const;

// Límite por IP y acción: cada paso de la casa gasta comisiones y USDC de prueba.
const hits = new Map<string, number[]>();
function limited(request: Request, bucket: string, max: number) {
  const ip = `${bucket}:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"}`;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > max;
}

function parseRole(role: unknown): demo.DemoRole {
  if (!ROLES.includes(role as demo.DemoRole)) throw new demo.DemoError("Rol inválido.");
  return role as demo.DemoRole;
}

function assertNotHouse(address: string) {
  for (const role of ROLES) {
    if (houseConfigured(role) && houseKeypair(role).publicKey() === address) {
      throw new demo.DemoError("Esa wallet es una cuenta de la casa. Conecta tu propia wallet de Testnet.");
    }
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    assertTestnet();
    const body = (await request.json()) as Record<string, unknown>;
    const { action } = body;

    if (action === "status") {
      const house = Object.fromEntries(ROLES.map((r) => [r, houseConfigured(r) ? houseKeypair(r).publicKey() : null]));
      return Response.json({ house, acta: actaIssuerConfigured(), approver: process.env.ALPHA_APPROVER_PUBLIC ?? null });
    }

    if (action === "submit") {
      if (typeof body.signedXdr !== "string") throw new demo.DemoError("Falta la transacción firmada.");
      if (body.kind === "soroban") return Response.json({ hash: await submitSoroban(body.signedXdr) });
      if (body.kind === "escrow") {
        const sent = await TW.send(body.signedXdr);
        return Response.json({ hash: sent.txHash, contractId: sent.contractId });
      }
      if (body.kind === "classic") return Response.json(await submitClassic(body.signedXdr));
      throw new demo.DemoError("Tipo de transacción desconocido.");
    }

    const role = parseRole(body.role);
    assertAddress(body.address);
    const user = body.address;
    assertNotHouse(user);
    if (limited(request, "demo", 120)) {
      return Response.json({ code: "limit", message: "Demasiadas solicitudes de demo. Espera unos minutos." }, { status: 429 });
    }

    switch (action) {
      case "prepare": {
        await fundWithFriendbot(user);
        const status = await walletStatus(user);
        if (role === "cooperativa" && !status.hasUsdcTrustline) {
          return Response.json({ signer: "user", kind: "classic", unsignedXdr: await buildUsdcTrustlineTx(user), note: "Habilita la recepción de USDC para cobrar los hitos." });
        }
        if (role === "importador" && Number(status.usdc) < TESTNET_ESCROW_AMOUNT) {
          return Response.json({ signer: "user", kind: "classic", unsignedXdr: await buildGetUsdcTx(user), note: "Cambia XLM de prueba por 200 USDC de prueba para fondear el escrow." });
        }
        if (role === "verificador") await demo.prepareVerifier(user);
        return Response.json({ signer: "house", ready: true });
      }
      case "start":
        if (limited(request, "demo-start", 15)) {
          return Response.json({ code: "limit", message: "Demasiados lotes de demo seguidos. Espera unos minutos." }, { status: 429 });
        }
        return Response.json({ lotId: demo.newDemoLotId(), ...(await demo.assess()) });
      case "credential":
        return Response.json(await demo.credential(body.lotId, body.risks, role, user));
      case "anchor":
        return Response.json(await demo.anchor(body.lotId, body.risks, role, user));
      case "escrow-deploy":
        return Response.json(await demo.escrowDeploy(body.lotId, role, user));
      case "escrow-fund":
        return Response.json(await demo.escrowFund(body.lotId, body.contractId, role, user));
      case "attest":
        return Response.json(await demo.attest(body.lotId, body.milestone, role, user));
      case "release":
        return Response.json(await demo.release(body.lotId, body.contractId, body.milestone));
      default:
        return Response.json({ code: "invalid", message: "Acción desconocida" }, { status: 400 });
    }
  } catch (err) {
    if (err instanceof demo.DemoError) return Response.json({ code: "demo", message: err.message }, { status: err.status });
    if (err instanceof TrustlessWorkError) {
      const detail = (err.body as { message?: string } | null)?.message;
      return Response.json({ code: "trustless_work", message: detail ? `Trustless Work: ${detail}` : err.message }, { status: err.status });
    }
    if (err instanceof WhispError) return Response.json({ code: "whisp", message: err.message }, { status: err.status });
    return errorResponse(err, 400);
  }
}
