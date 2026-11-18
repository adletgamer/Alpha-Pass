import type { Metadata } from "next";
import type { HomeLocale } from "./home-copy";

const DESCRIPTION =
  "Alpha Pass conecta la evidencia de origen de lotes de café y cacao del Perú con pagos internacionales liberados por hitos, sobre Stellar.";

export function homeMetadata(locale: HomeLocale): Metadata {
  const description = locale === "en"
    ? "Alpha Pass connects verified origin evidence for Peruvian coffee and cacao lots with milestone-based international payments on Stellar."
    : DESCRIPTION;
  return {
    title: { absolute: locale === "en"
      ? "Alpha Pass · Verified origin, proof-backed payments"
      : "Alpha Pass · Cada lote con su origen, cada pago con su prueba" },
    description,
    openGraph: {
      title: "Alpha Pass · Verified Origin Infrastructure",
      description,
      type: "website",
      locale: locale === "en" ? "en" : "es_PE",
      images: [{ url: "/brand/alpha-pass-logo-horizontal.png", width: 532, height: 116, alt: "Alpha Pass" }],
    },
  twitter: { card: "summary", title: "Alpha Pass · Verified Origin Infrastructure", description },
  alternates: { languages: { es: "/", en: "/en" } },
  };
}
