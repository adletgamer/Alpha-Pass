import Link from "next/link";

const ROLES = [
  { href: "/cooperativa", title: "Cooperativa", text: "Verifica sus parcelas, arma el lote y ancla su pasaporte." },
  { href: "/importador", title: "Importador", text: "Fondea el escrow en USDC o EURC y libera cada hito contra prueba." },
  { href: "/verificador", title: "Verificador", text: "Firma acopio, embarque y llegada con el hash de su evidencia." },
  { href: "/lote/2026-JAE-014", title: "Pasaporte público", text: "Lo que ve cualquiera que escanee el QR del lote." },
];

export default function Home() {
  return (
    <main className="container">
      <section className="card" style={{ gap: 12 }}>
        <p className="muted" style={{ margin: 0, fontWeight: 600 }}>Prototipo · Stellar Codember Perú 2026</p>
        <h1>Cada lote con su origen, cada pago con su prueba.</h1>
        <p style={{ margin: 0, maxWidth: 720 }}>
          Alpha Pass une el pasaporte verificado de un lote de café o cacao con un escrow por hitos.
          El dinero solo se libera cuando existe la credencial firmada que prueba cada etapa.
        </p>
      </section>
      <div className="stats">
        {ROLES.map((r) => (
          <Link key={r.href} href={r.href} className="card" style={{ textDecoration: "none", color: "inherit" }}>
            <h2 style={{ color: "var(--ap-green-800)" }}>{r.title}</h2>
            <span className="muted">{r.text}</span>
          </Link>
        ))}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
        Orden sugerido de la demo: Cooperativa → Importador → Verificador → Importador → Pasaporte público.
      </p>
    </main>
  );
}
