<p align="center">
  <img src="apps/web/public/brand/alpha-pass-symbol.svg" width="96" alt="Alpha Pass">
</p>

# Alpha Pass

**Cada lote con su origen, cada pago con su prueba.**

Alpha Pass une la evidencia de origen de un lote de café peruano con un escrow por hitos en **USDC o EURC** sobre Stellar. El importador descarga el expediente del lote y puede comprobar su evidencia de origen contra la raíz del pasaporte. Cada pago de acopio, embarque o llegada requiere una atestación firmada por un verificador autorizado.

Proyecto para Stellar Codember Perú 2026. **Prototipo operativo con wallet en Stellar Testnet**. `LotPassport` está desplegado en Testnet. El flujo completo requiere configurar el contrato y los proveedores de prueba.

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
