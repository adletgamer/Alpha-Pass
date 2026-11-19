// Pasaporte público leído directamente de LotPassport (Testnet). Sin claves.
import { errorResponse } from "@/lib/server/env";
import { readLotOnChain } from "@/lib/server/stellar";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!/^[A-Za-z0-9-]{3,40}$/.test(id)) return Response.json({ code: "invalid", message: "ID de lote inválido" }, { status: 400 });
    const lot = await readLotOnChain(id);
    if (!lot) return Response.json({ code: "not_found", message: "Ese lote no está en LotPassport." }, { status: 404 });
    return Response.json(lot, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=60" } });
  } catch (err) {
    return errorResponse(err, 502);
  }
}
