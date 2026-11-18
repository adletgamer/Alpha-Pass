"use client";

import type { HomeLocale } from "./home-copy";

import { useEffect, useRef, useState } from "react";
import type { OriginScene } from "./origin-scene";
import { HeroFallback } from "./HeroFallback";

const STAGE_COPY = [
  { key: "origen", label: "Origen", text: "Parcelas georreferenciadas de la cooperativa.", metric: "05", unit: "parcelas registradas", detail: "Jaén · Cajamarca" },
  { key: "evidencia", label: "Evidencia", text: "Verificación satelital y credenciales firmadas.", metric: "04 / 05", unit: "parcelas aptas", detail: "Una alerta queda fuera del lote" },
  { key: "pasaporte", label: "Pasaporte", text: "Un registro del lote anclado en Stellar.", metric: "01", unit: "pasaporte verificable", detail: "Raíz de evidencias en Stellar" },
  { key: "escrow", label: "Escrow", text: "El comprador deposita el pago antes del embarque.", metric: "100%", unit: "pago reservado", detail: "Hitos 30 · 50 · 20" },
  { key: "liberacion", label: "Liberación", text: "Cada hito se paga cuando existe su prueba.", metric: "03", unit: "hitos contra prueba", detail: "Acopio · embarque · llegada" },
] as const;

const STAGE_COPY_EN = [
  { key: "origen", label: "Origin", text: "Georeferenced plots from the cooperative.", metric: "05", unit: "registered plots", detail: "Jaén · Cajamarca" },
  { key: "evidencia", label: "Evidence", text: "Satellite verification and signed credentials.", metric: "04 / 05", unit: "eligible plots", detail: "One flagged plot excluded" },
  { key: "pasaporte", label: "Passport", text: "A lot record anchored on Stellar.", metric: "01", unit: "verifiable passport", detail: "Evidence root on Stellar" },
  { key: "escrow", label: "Escrow", text: "The buyer deposits payment before shipment.", metric: "100%", unit: "payment reserved", detail: "Milestones 30 · 50 · 20" },
  { key: "liberacion", label: "Release", text: "Payment is released when proof is available for each milestone.", metric: "03", unit: "proof-backed milestones", detail: "Collection · shipment · arrival" },
] as const;

function supportsWebGL() {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/**
 * Héroe con desplazamiento: el texto queda fijo mientras la escena avanza por
 * las cinco etapas al hacer scroll. Sin secuestrar el scroll: la página baja normal.
 */
export function HeroScene({ children, locale }: { children: React.ReactNode; locale: HomeLocale }) {
  const stageCopy = locale === "en" ? STAGE_COPY_EN : STAGE_COPY;
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<OriginScene | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState(0);
  const [parcel, setParcel] = useState<{ id: string; alert: boolean } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const section = sectionRef.current;
    if (!canvas || !section) return;
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = window.matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency ?? 8) <= 4;

    const progressNow = () => {
      const r = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      return total > 0 ? Math.min(Math.max(-r.top / total, 0), 1) : 0;
    };

    const onScroll = () => {
      const p = progressNow();
      sceneRef.current?.setProgress(p);
      setStage(Math.min(stageCopy.length - 1, Math.floor(p * stageCopy.length * 0.999)));
    };
    const onResize = () => sceneRef.current?.resize();
    let onMove = (_e: PointerEvent) => {};
    let io: IntersectionObserver | null = null;

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();
    if (!supportsWebGL()) {
      setFailed(true);
      return () => {
        window.removeEventListener("scroll", onScroll);
        window.removeEventListener("resize", onResize);
      };
    }

    import("./origin-scene")
      .then(({ OriginScene }) => {
        if (disposed) return;
        const scene = new OriginScene(canvas, {
          lowPower,
          reducedMotion: reduced,
          onHoverParcel: (id, alert) => setParcel(id ? { id, alert } : null),
        });
        sceneRef.current = scene;
        onMove = (e: PointerEvent) => {
          const r = canvas.getBoundingClientRect();
          scene.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        };
        io = new IntersectionObserver(([entry]) => scene.setVisible(entry.isIntersecting));
        io.observe(section);
        canvas.addEventListener("pointermove", onMove);
        onScroll();
        scene.resize();
        setReady(true);
      })
      .catch(() => setFailed(true));

    return () => {
      disposed = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      canvas.removeEventListener("pointermove", onMove);
      io?.disconnect();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [stageCopy]);

  function goToStage(i: number) {
    const section = sectionRef.current;
    if (!section) return;
    const total = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + (total * (i + 0.5)) / stageCopy.length, behavior: reduced ? "auto" : "smooth" });
  }

  return (
    <section ref={sectionRef} id="inicio" className="hero" aria-labelledby="hero-title">
      <div className="hero-sticky">
        <div className="hero-visual">
          {!failed && (
            <canvas
              ref={canvasRef}
              className={`hero-canvas${ready ? " is-ready" : ""}`}
              role="img"
              aria-label={locale === "en" ? "Andean terrain showing the plots, verified evidence, passport and payment route to Europe." : "Relieve andino con las parcelas de un lote, la evidencia verificada, el pasaporte y la ruta de pago hacia Europa."}
            />
          )}
          {(!ready || failed) && <HeroFallback />}
          {parcel && (
            <div className="hero-parcel mono" role="status">
              {parcel.id} · {locale === "en"
                ? (parcel.alert ? "alert: excluded from lot" : "low risk · included in lot")
                : (parcel.alert ? "alerta: excluida del lote" : "sin riesgo · en el lote")}
            </div>
          )}
          <div className="hero-signal" aria-hidden="true">
            <span className="hero-signal-kicker mono">{locale === "en" ? "Sample lot" : "Lote de ejemplo"} · 2026-JAE-014</span>
            <span className="hero-signal-metric mono">{stageCopy[stage].metric}</span>
            <strong>{stageCopy[stage].unit}</strong>
            <span className="hero-signal-detail">{stageCopy[stage].detail}</span>
            <span className="hero-signal-track"><span style={{ width: `${((stage + 1) / stageCopy.length) * 100}%` }} /></span>
            <span className="hero-signal-count mono">{String(stage + 1).padStart(2, "0")} / 05</span>
          </div>
        </div>
        <div className="hero-content">
          {children}
          <ol className="hero-stages" aria-label={locale === "en" ? "Transaction stages" : "Etapas de una operación"}>
            {stageCopy.map((s, i) => (
              <li key={s.key}>
                <button
                  type="button"
                  className={i === stage ? "is-active" : undefined}
                  aria-current={i === stage ? "step" : undefined}
                  onClick={() => goToStage(i)}
                >
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  <span>{s.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="hero-stage-text" aria-live="polite">{stageCopy[stage].text}</p>
          <span className="hero-scroll-cue mono" aria-hidden="true">{locale === "en" ? "Scroll to follow the lot" : "Desplázate para seguir el lote"} <span>↓</span></span>
        </div>
      </div>
    </section>
  );
}
