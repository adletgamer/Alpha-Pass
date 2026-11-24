import type { Metadata } from "next";
import type { HomeLocale } from "./home-copy";

const DESCRIPTION =
  "Las cooperativas cobran por hitos desde el acopio y los importadores europeos reciben la evidencia EUDR de cada lote de café peruano. El pago en USDC o EURC solo se libera cuando la prueba está en Stellar.";

export function homeMetadata(locale: HomeLocale): Metadata {
  const description = locale === "en"
    ? "Cooperatives get paid at each milestone, starting at harvest, and EU importers get EUDR evidence for every Peruvian coffee lot. USDC or EURC is released only when the proof is on Stellar."
    : DESCRIPTION;
  return {
    title: { absolute: locale === "en"
      ? "Alpha Pass · No proof, no payment"
      : "Alpha Pass · Sin prueba, no hay pago" },
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
