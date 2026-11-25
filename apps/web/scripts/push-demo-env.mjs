// Copia a Vercel las variables de servidor que necesita la demo guiada, leyéndolas
// de .env.local. Los valores pasan directo de este archivo a la CLI de Vercel:
// no se imprimen.
//
// Uso (desde apps/web, una sola vez por equipo):
//   npx vercel login
//   npx vercel link
//   npm run demo:vercel-env            (production y preview)
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

// La CLI de Vercel usa la carpeta donde se hizo `vercel link` (aquí o en la raíz del repo).
function linkedDir() {
  for (let dir = resolve("."); ; dir = dirname(dir)) {
    if (existsSync(join(dir, ".vercel", "project.json"))) return dir;
    if (dirname(dir) === dir) throw new Error("No encontré .vercel: ejecuta npx vercel link primero.");
  }
}
const VERCEL_CWD = linkedDir();

const NAMES = [
  "ALPHA_DEMO_COOP_SECRET", "ALPHA_DEMO_COOP_PUBLIC",
  "ALPHA_DEMO_BUYER_SECRET", "ALPHA_DEMO_BUYER_PUBLIC",
  "ALPHA_DEMO_VERIFIER_SECRET", "ALPHA_DEMO_VERIFIER_PUBLIC",
  "ALPHA_ACTA_ISSUER_SECRET", "ALPHA_ACTA_ISSUER_IDENTITY",
  "ACTA_API_KEY",
];
const ENVIRONMENTS = (process.argv[2] ?? "production,preview").split(",");

const values = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const match = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (match) values[match[1]] = match[2].trim().replace(/^'(.*)'$/s, "$1");
}

let failed = 0;
for (const name of NAMES) {
  if ((process.env.SKIP ?? "").split(",").includes(name)) continue;
  const value = values[name];
  if (!value) {
    console.log(`·  ${name}: vacía en .env.local, se omite`);
    continue;
  }
  for (const env of ENVIRONMENTS) {
    // Preview exige --value (para todas las ramas); production acepta el valor por stdin.
    // La rama vacía ("") significa todas las ramas de Preview.
    const win = process.platform === "win32";
    const args = ["vercel", "env", "add", name, env, ...(env === "preview" ? [win ? '""' : ""] : []), "--force", "--sensitive", "--yes"];
    if (env === "preview") args.push("--value", win ? JSON.stringify(value) : value);
    const res = spawnSync("npx", args, {
      input: env === "preview" ? undefined : value, shell: process.platform === "win32", encoding: "utf8", cwd: VERCEL_CWD,
    });
    const ok = res.status === 0;
    if (!ok) failed++;
    console.log(`${ok ? "OK" : "FALLÓ"} ${name} → ${env}${ok ? "" : ` · ${(res.stderr || res.stdout).split("\n").find((l) => l.trim()) ?? ""}`}`);
  }
}
console.log(failed ? `\n${failed} variable(s) no se cargaron. ¿Hiciste npx vercel login y npx vercel link?` : "\nListo. Vuelve a desplegar para que el entorno tome los valores nuevos.");
process.exit(failed ? 1 : 0);
