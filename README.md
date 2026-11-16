<p align="center">
  <img src="apps/web/public/brand/alpha-pass-symbol.svg" width="96" alt="Alpha Pass">
</p>

# Alpha Pass

**Cada lote con su origen, cada pago con su prueba.**

Alpha Pass une el pasaporte verificado de un lote de café o cacao peruano con un escrow por hitos en **USDC o EURC** sobre Stellar. Cada hito del pago (acopio, embarque, llegada) se libera solo si existe la credencial firmada que lo prueba. Al final, el importador tiene el paquete de evidencias para su declaración EUDR y la cooperativa cobra sin intermediario.

Proyecto para Stellar Codember Perú 2026. Estado: **prototipo en modo demo**, contratos con pruebas unitarias, integraciones pendientes de conexión.

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

# App web (modo demo)
cd apps/web
cp .env.example .env.local
npm install
npm run dev        # http://localhost:3000
npm test           # reglas de liberación, montos y Merkle
```

Recorrido de la demo: Cooperativa (verificar parcelas, anclar pasaporte) → Importador (elegir USDC o EURC y fondear) → Verificador (firmar acopio) → Importador (liberar; probar a liberar el embarque sin prueba y ver el rechazo) → Pasaporte público.

## Stack

Stellar Testnet · Soroban (Rust, soroban-sdk 29) · Trustless Work · ACTA · Circle USDC y EURC · Whisp (FAO) · Stellar Wallets Kit · Anchor Platform (SEP-24) · Next.js 16 · TypeScript · Vitest.

## Lo que todavía no está

- Conexión real con Trustless Work, ACTA y Whisp (adaptadores simulados en `apps/web/src/lib/adapters.ts`).
- Despliegue de los contratos en Testnet y cliente TypeScript generado.
- Firma con Stellar Wallets Kit, fee-bump y retiro SEP-24.
- Ver el límite del MVP sobre la aprobación de hitos en [docs/FLUJO.md](docs/FLUJO.md#límite-honesto-del-mvp).

## Licencia

MIT
