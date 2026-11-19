import type { AssetCode } from "./domain";
import type { Checkpoint, SharedOperation } from "./operation";

interface EscrowDependencies {
  prepare(action: object): Promise<{ unsignedXdr: string; contractId?: string; ticket?: string }>;
  sign(unsigned: string): Promise<{ signed: string; hash: string; expires: number }>;
  submit(signed: string): Promise<{ contractId?: string }>;
  checkpoint(step: Checkpoint): Promise<void>;
  refresh(): Promise<SharedOperation>;
}

export async function resumeEscrow(
  view: SharedOperation,
  input: { buyer: string; asset: AssetCode; amount: number },
  io: EscrowDependencies,
) {
  const prior = view.progress.escrow;
  if (prior && prior.buyer !== input.buyer) throw new Error("Conecta la cuenta del importador que inició el escrow.");
  if (view.lot.escrow?.funded) return;
  if (view.pendingDeploy) throw new Error("La creación ya se envió. Actualiza el estado antes de volver a intentarlo.");
  if (view.pendingFund) throw new Error("El fondeo ya se envió. Actualiza el estado antes de volver a intentarlo.");
  let contractId = prior?.contractId;
  const amount = prior?.amount ?? input.amount;
  const asset = prior?.asset ?? input.asset;
  const signer = input.buyer;
  if (!contractId) {
    const deploy = await io.prepare({ action: "deploy", signer, lotId: view.lot.id, asset, amount });
    const signed = await io.sign(deploy.unsignedXdr);
    await io.checkpoint({ type: "deploy", ticket: deploy.ticket, escrow: { buyer: signer, asset, amount, deployHash: signed.hash, deployExpires: signed.expires } });
    const result = await io.submit(signed.signed);
    contractId = result.contractId ?? deploy.contractId ?? (await io.refresh()).progress.escrow?.contractId;
    if (!contractId) throw new Error("La creación se envió. Actualiza el estado para recuperar el contrato.");
  }
  await io.checkpoint({ type: "deployed", contractId });
  const fund = await io.prepare({ action: "fund", lotId: view.lot.id, contractId, signer, amount });
  const signed = await io.sign(fund.unsignedXdr);
  await io.checkpoint({ type: "fund", ticket: fund.ticket, hash: signed.hash, expires: signed.expires });
  await io.submit(signed.signed);
}
