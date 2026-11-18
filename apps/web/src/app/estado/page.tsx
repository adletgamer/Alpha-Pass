import { serverEnv } from "@/lib/server/env";

export const dynamic = "force-dynamic";

type Status = "configurado" | "falta clave" | "error";

async function rpcStatus(): Promise<Status> {
  try {
    const response = await fetch(serverEnv.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return "error";
    const result = await response.json();
    return result?.result?.status === "healthy" ? "configurado" : "error";
  } catch {
    return "error";
  }
}

function keyStatus(name: string): Status {
  return process.env[name]?.trim() ? "configurado" : "falta clave";
}

export default async function EstadoPage() {
  const statuses: { name: string; status: Status; detail: string }[] = [
    { name: "ACTA", status: keyStatus("ACTA_API_KEY"), detail: "Clave del servidor" },
    { name: "Whisp", status: keyStatus("WHISP_API_KEY"), detail: "Clave del servidor" },
    { name: "Trustless Work v2", status: keyStatus("TRUSTLESS_WORK_API_KEY"), detail: "Clave del servidor" },
    { name: "LotPassport", status: keyStatus("NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID"), detail: "ID del contrato Testnet" },
    { name: "Stellar RPC", status: await rpcStatus(), detail: "Lectura getHealth" },
  ];

  return (
    <main className="container">
      <h1>Estado de integraciones</h1>
      <p className="muted">Red: {serverEnv.network}. “Configurado” indica que existe la variable necesaria; solo RPC se consulta en vivo.</p>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Servicio</th><th>Estado</th><th>Comprobación</th></tr></thead>
          <tbody>
            {statuses.map((item) => (
              <tr key={item.name}>
                <td>{item.name}</td>
                <td><span className={item.status === "configurado" ? "pill pill-ok" : "pill pill-alert"}>{item.status}</span></td>
                <td>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Esta página no muestra claves, wallets de servicio ni datos de parcelas.</p>
    </main>
  );
}
