"use client";

// Llamadas al contrato LotPassport firmadas por la wallet del usuario.
import { Contract, nativeToScVal, rpc, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import type { Milestone } from "./domain";
import { currentAddress, NETWORK_PASSPHRASE, signXdr } from "./wallet";

const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";
const CONTRACT_ID = process.env.NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID ?? "";

const VARIANT: Record<Milestone, string> = { acopio: "Acopio", embarque: "Embarque", llegada: "Llegada" };

function bytes32(hex: string): xdr.ScVal {
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("Se esperaba un hash SHA-256 en hexadecimal");
  return xdr.ScVal.scvBytes(Buffer.from(hex, "hex"));
}

type BeforeSubmit = (hash: string, expires: number) => Promise<void>;

async function invoke(address: string, method: string, args: xdr.ScVal[], beforeSubmit?: BeforeSubmit): Promise<string> {
  if (!CONTRACT_ID) throw new Error("LotPassport no está desplegado: falta NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID.");
  const server = new rpc.Server(RPC_URL);
  const account = await server.getAccount(address);
  const tx = new TransactionBuilder(account, { fee: "1000000", networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(CONTRACT_ID).call(method, ...args))
    .setTimeout(120)
    .build();
  const prepared = await server.prepareTransaction(tx);
  const signed = TransactionBuilder.fromXDR(await signXdr(prepared.toXDR(), { expectedAddress: address }), NETWORK_PASSPHRASE);
  if (beforeSubmit) {
    const hash = Array.from(signed.hash(), (byte) => byte.toString(16).padStart(2, "0")).join("");
    await beforeSubmit(hash, "timeBounds" in signed ? Number(signed.timeBounds?.maxTime ?? 0) : 0);
  }
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") throw new Error("La red rechazó la transacción de LotPassport.");
  for (let i = 0; i < 30; i++) {
    const res = await server.getTransaction(sent.hash);
    if (res.status === rpc.Api.GetTransactionStatus.SUCCESS) return sent.hash;
    if (res.status === rpc.Api.GetTransactionStatus.FAILED) throw new Error("LotPassport rechazó la operación.");
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("La transacción de LotPassport no se confirmó a tiempo.");
}

export async function createLotOnChain(
  lotId: string,
  passportRootHex: string,
  parcels: number,
  bags: number,
  options?: { expectedCooperative: string; beforeSubmit?: BeforeSubmit },
) {
  const coop = await currentAddress();
  if (options && coop !== options.expectedCooperative) throw new Error("Conecta la cuenta de la cooperativa que abrió el lote.");
  return invoke(coop, "create_lot", [
    nativeToScVal(coop, { type: "address" }),
    nativeToScVal(lotId, { type: "string" }),
    bytes32(passportRootHex),
    nativeToScVal(parcels, { type: "u32" }),
    nativeToScVal(bags, { type: "u32" }),
  ], options?.beforeSubmit);
}

export async function attestOnChain(lotId: string, milestone: Milestone, evidenceHashHex: string) {
  const issuer = await currentAddress();
  return invoke(issuer, "attest", [
    nativeToScVal(issuer, { type: "address" }),
    nativeToScVal(lotId, { type: "string" }),
    xdr.ScVal.scvVec([xdr.ScVal.scvSymbol(VARIANT[milestone])]),
    bytes32(evidenceHashHex),
  ]);
}
