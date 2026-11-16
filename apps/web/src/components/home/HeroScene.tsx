"use client";

import { useEffect, useRef, useState } from "react";
import type { OriginScene } from "./origin-scene";
import { HeroFallback } from "./HeroFallback";

const STAGE_COPY = [
  { key: "origen", label: "Origen", text: "Parcelas georreferenciadas de la cooperativa." },
  { key: "evidencia", label: "Evidencia", text: "Verificación satelital y credenciales firmadas." },
  { key: "pasaporte", label: "Pasaporte", text: "Un registro del lote anclado en Stellar." },
  { key: "escrow", label: "Escrow", text: "El comprador deposita el pago antes del embarque." },
  { key: "liberacion", label: "Liberación", text: "Cada hito se paga cuando existe su prueba." },
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
export function HeroScene({ children }: { children: React.ReactNode }) {
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
    if (!supportsWebGL()) {
      setFailed(true);
      return;
    }
    let disposed = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const lowPower = window.matchMedia("(max-width: 760px)").matches || (navigator.hardwareConcurrency ?? 8) <= 4;

    const progressNow = () => {
      const r = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      return total > 0 ? Math.min(Math.max(-r.top / total, 0), 1) : 0;
    };

    let onScroll = () => {};
    let onResize = () => {};
    let onMove = (_e: PointerEvent) => {};
    let io: IntersectionObserver | null = null;

    import("./origin-scene")
      .then(({ OriginScene }) => {
        if (disposed) return;
        const scene = new OriginScene(canvas, {
          lowPower,
          reducedMotion: reduced,
          onHoverParcel: (id, alert) => setParcel(id ? { id, alert } : null),
        });
        sceneRef.current = scene;
        onScroll = () => {
          const p = progressNow();
          scene.setProgress(p);
          setStage(Math.min(STAGE_COPY.length - 1, Math.floor(p * STAGE_COPY.length * 0.999)));
        };
        onResize = () => scene.resize();
        onMove = (e: PointerEvent) => {
          const r = canvas.getBoundingClientRect();
          scene.setPointer(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        };
        io = new IntersectionObserver(([entry]) => scene.setVisible(entry.isIntersecting));
        io.observe(section);
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onResize);
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
  }, []);

  function goToStage(i: number) {
    const section = sectionRef.current;
    if (!section) return;
    const total = section.offsetHeight - window.innerHeight;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + (total * (i + 0.5)) / STAGE_COPY.length, behavior: reduced ? "auto" : "smooth" });
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
              aria-label="Relieve andino con las parcelas de un lote, la evidencia verificada, el pasaporte y la ruta de pago hacia Europa."
            />
          )}
          {(!ready || failed) && <HeroFallback />}
          {parcel && (
            <div className="hero-parcel mono" role="status">
              {parcel.id} · {parcel.alert ? "alerta: excluida del lote" : "sin riesgo · en el lote"}
            </div>
          )}
        </div>
        <div className="hero-content">
          {children}
          <ol className="hero-stages" aria-label="Etapas de una operación">
            {STAGE_COPY.map((s, i) => (
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
          <p className="hero-stage-text" aria-live="polite">{STAGE_COPY[stage].text}</p>
        </div>
      </div>
    </section>
  );
}
