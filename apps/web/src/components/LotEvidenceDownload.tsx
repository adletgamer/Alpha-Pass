"use client";

import { useState } from "react";
import type { LotEvidence } from "@/lib/lot-evidence";

export function LotEvidenceDownload({ load, label }: { load: () => Promise<LotEvidence | null>; label: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  async function download() {
    setPending(true);
    setError(undefined);
    try {
      const evidence = await load();
      if (!evidence) throw new Error("La evidencia disponible no coincide con la raíz del pasaporte.");
      const file = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${evidence.lotId}-expediente.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo descargar el expediente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button className="btn" type="button" disabled={pending} onClick={download}>
        {pending ? "Preparando expediente…" : label}
      </button>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
  );
}
