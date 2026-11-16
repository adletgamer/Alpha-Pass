import "server-only";
import {
  Account,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { serverEnv } from "./env";
import type { Milestone } from "../domain";

const PASSPHRASE = serverEnv.network === "mainnet" ? Networks.PUBLIC : Networks.TESTNET;

/** Variante del enum Milestone de LotPassport (contracttype unit enum = vec[symbol]). */
const MILESTONE_VARIANT: Record<Milestone, string> = {
  acopio: "Acopio",
  embarque: "Embarque",
  llegada: "Llegada",
};

function milestoneScVal(m: Milestone): xdr.ScVal {
  return xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(MILESTONE_VARIANT[m])]);
}

/** Lee LotPassport.is_attested(lot_id, milestone) simulando la llamada (sin firmar ni pagar). */
export async function isAttestedOnChain(lotId: string, milestone: Milestone): Promise<boolean> {
  const server = new rpc.Server(serverEnv.rpcUrl);
  const contract = new Contract(serverEnv.lotPassportId());
  // Cuenta ficticia: la simulación de una lectura no necesita una cuenta real.
  const source = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase: PASSPHRASE })
    .addOperation(contract.call("is_attested", nativeToScVal(lotId, { type: "string" }), milestoneScVal(milestone)))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error(`LotPassport: ${sim.error}`);
  const ret = sim.result?.retval;
  return ret ? Boolean(scValToNative(ret)) : false;
}

/** Firma con la cuenta de servicio (aprobadora) un XDR devuelto por Trustless Work. */
export function signWithApprover(unsignedXdr: string): string {
  const kp = Keypair.fromSecret(serverEnv.roles().approverSecret);
  const tx = TransactionBuilder.fromXDR(unsignedXdr, PASSPHRASE);
  tx.sign(kp);
  return tx.toXDR();
}
