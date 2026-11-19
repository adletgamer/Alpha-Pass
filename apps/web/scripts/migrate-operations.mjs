import { readFile } from "node:fs/promises";
import postgres from "postgres";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("Configura DATABASE_URL_UNPOOLED o DATABASE_URL.");

const sql = postgres(url, { max: 1, prepare: false });
try {
  await sql.unsafe(await readFile(new URL("../migrations/001_shared_operations.sql", import.meta.url), "utf8"));
  console.log("Migración de operaciones compartidas aplicada.");
} finally {
  await sql.end();
}
