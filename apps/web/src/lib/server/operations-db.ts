import "server-only";
import postgres from "postgres";
import type { OperationProgress } from "../operation";
import type { Milestone } from "../domain";
import type { AccessHashes } from "./operation-state";
import { MissingEnvError } from "./env";

export interface OperationRow {
  lot_id: string;
  cooperative: string;
  access_hashes: AccessHashes;
  state: OperationProgress;
  revision: number;
}

let client: ReturnType<typeof postgres> | undefined;
export function operationsConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function connection() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new MissingEnvError("DATABASE_URL");
  return client ??= postgres(url, { max: 3, prepare: false, connect_timeout: 8, idle_timeout: 20 });
}

export async function readOperation(id: string): Promise<OperationRow | undefined> {
  const sql = connection();
  const [row] = await sql<OperationRow[]>`SELECT lot_id, cooperative, access_hashes, state, revision FROM alpha_demo_operations WHERE lot_id = ${id}`;
  return row;
}

export async function createOperation(id: string, cooperative: string, hashes: AccessHashes, state: OperationProgress) {
  const sql = connection();
  await sql`INSERT INTO alpha_demo_operations (lot_id, cooperative, access_hashes, state)
    VALUES (${id}, ${cooperative}, ${JSON.stringify(hashes)}::text::jsonb, ${JSON.stringify(state)}::text::jsonb)
    ON CONFLICT (lot_id) DO NOTHING`;
}

export async function updateOperation(row: OperationRow, state: OperationProgress) {
  const sql = connection();
  const result = await sql`UPDATE alpha_demo_operations
    SET state = ${JSON.stringify(state)}::text::jsonb, revision = revision + 1, updated_at = now()
    WHERE lot_id = ${row.lot_id} AND revision = ${row.revision}`;
  return result.count === 1;
}

export async function recordMilestoneReceipt(id: string, kind: "approvalHashes" | "releaseHashes", milestone: Milestone, hash: string) {
  const sql = connection();
  await sql`UPDATE alpha_demo_operations SET
    state = jsonb_set(state, ARRAY[${kind}]::text[], COALESCE(state -> ${kind}::text, '{}'::jsonb) || ${JSON.stringify({ [milestone]: hash })}::text::jsonb),
    revision = revision + 1, updated_at = now()
    WHERE lot_id = ${id}`;
}
