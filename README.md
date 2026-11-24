<p align="center">
  <img src="apps/web/public/brand/alpha-pass-symbol.svg" width="96" alt="Alpha Pass">
</p>

# Alpha Pass

**Sin prueba, no hay pago. Con prueba, la cooperativa cobra antes.**

Las cooperativas cobran por hitos desde el acopio y los importadores europeos reciben la evidencia EUDR que exige la ley. El pago en **USDC o EURC** solo se libera cuando la prueba está en Stellar.

> *No proof, no payment.* Cooperatives get paid at each milestone, starting at harvest, and EU importers get the EUDR evidence the law requires. Money is released only when the proof is on Stellar.

## Por qué ahora

Desde el **30 de diciembre de 2026**, la EUDR se aplica a los operadores grandes y medianos de la UE. Desde esa fecha no pueden comercializar café sin una declaración de diligencia debida con la geolocalización de las parcelas. Hoy esa evidencia viaja en PDF que nadie puede verificar, y la cooperativa cobra semanas o meses después del embarque.

## Qué gana cada parte

| Quién | Hoy | Con Alpha Pass |
| --- | --- | --- |
| Cooperativa | Cobra después de que llega el contenedor | Cobra el 30% en el acopio, el 50% en el embarque y el 20% en la llegada |
| Importador | Paga contra documentos que no puede comprobar | Paga en escrow y obtiene un expediente verificable contra la raíz anclada en Stellar |
| Productores | El premio se reparte sin trazabilidad | El premio se reparte por sacos con `PremiumSplitter` (contrato probado; falta desplegarlo en Testnet) |

La regla está en el código: cada hito se libera solo si `LotPassport` tiene la atestación firmada de un verificador autorizado y el hito anterior ya se liberó.

## Probado en Stellar Testnet

- `LotPassport`, desplegado: [`CDNM2H5X…CZ7BO`](https://stellar.expert/explorer/testnet/contract/CDNM2H5XU3IR5YVE6TJJE36RPFIKWVQ2WEPNRSLAMW2JPAURETVCZ7BO).
- Recorrido de punta a punta: 20 de 20 pasos. Whisp (FAO) evaluó las parcelas reales, la cooperativa firmó `create_lot` y el importador fondeó un escrow de Trustless Work con 150 USDC.
- La liberación sin atestación y la liberación con el escrow de otro lote respondieron **409**: el dinero no se movió.
- Tres atestaciones y tres liberaciones: la cooperativa recibió **149,55 USDC** (0,45 de comisión de protocolo). Escrow del lote de referencia `2026-JAE-014-SOLO01`: [`CAA66ALC…DK62W`](https://stellar.expert/explorer/testnet/contract/CAA66ALCFG7LJO2BBY2KD5L2GVWWO2MZWWRFHG5KDEOUG6LY5A6DK62W).

Detalle y método en [docs/INTEGRACIONES.md](docs/INTEGRACIONES.md#prueba-de-punta-a-punta).

Proyecto para Stellar Codember Perú 2026. Prototipo operativo con wallet en Stellar Testnet. Alpha Pass organiza la evidencia para la diligencia debida del importador. No certifica el cumplimiento EUDR.

## Qué hay en este repo

| Carpeta | Qué contiene |
| --- | --- |
| `contracts/lot-passport` | Contrato Soroban que registra el lote (raíz Merkle del pasaporte) y las atestaciones de cada hito, en orden y solo por verificadores autorizados |
| `contracts/premium-splitter` | Contrato Soroban que reparte el premio entre productores por sacos, con USDC o EURC |
| `apps/web` | App Next.js con las vistas de cooperativa, importador, verificador y la página pública del lote (QR) |
| `docs/FLUJO.md` | Diagrama de flujo, secuencia entre actores y estados de un hito |
| `docs/INTEGRACIONES.md` | Estado de cada integración del ecosistema (Trustless Work, ACTA, Whisp, Circle) |
| `docs/BRAND.md` | Resumen de marca y enlace al Brand Book |

## Flujo en una línea

Parcelas → verificación satelital (Whisp, FAO) → credenciales (ACTA) → raíz en `LotPassport` → escrow en USDC o EURC (Trustless Work) → verificador firma hito → `is_attested` → liberación 30/50/20 → premio a productores → retiro SEP-24. Detalle en [docs/FLUJO.md](docs/FLUJO.md).

## Cómo correrlo

```bash
# Contratos
cd contracts && cargo test

# App web (Stellar Testnet)
cd apps/web
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
npm test           # reglas de liberación, montos y Merkle
```

Para validar el flujo en Stellar Testnet, completa las variables de `.env.local`, elige tu rol en `/testnet` y conecta tu wallet. La landing muestra vistas de solo lectura y el pasaporte público consulta los datos anclados en Stellar.

## Stack

Stellar Testnet · Soroban (Rust, soroban-sdk 29) · Trustless Work · ACTA · Circle USDC y EURC · Whisp (FAO) · Stellar Wallets Kit · Anchor Platform (SEP-24) · Next.js 16 · TypeScript · Vitest.

## Lo que todavía no está

- Emisión ACTA de punta a punta en el flujo compartido con la wallet vinculada a la clave del entorno. La evaluación Whisp y los pagos por Trustless Work v1 ya se probaron en Testnet.
- Despliegue de `PremiumSplitter` en Testnet y cliente TypeScript generado. `LotPassport` ya está desplegado en Testnet (ID en `.env.example`).
- Fee-bump y retiro SEP-24.
- Ver el límite del MVP sobre la aprobación de hitos en [docs/FLUJO.md](docs/FLUJO.md#límite-honesto-del-mvp).

## Licencia

MIT
