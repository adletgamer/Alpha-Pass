# Integraciones

Estado al 16-nov-2026. Con `NEXT_PUBLIC_ALPHA_MODE=demo` todo es simulado; con `testnet` la app usa los servicios reales. Las claves viven solo en el servidor (`.env.local` en local, variables cifradas en Vercel) y nunca llevan prefijo `NEXT_PUBLIC_`.

| Herramienta | Cómo se integra | Archivo | Clave | Estado |
| --- | --- | --- | --- | --- |
| [Trustless Work](https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/introduction) Core API v2, multi-release | El servidor construye `deploy`, `fund`, `approve-milestones` y `release-funds`; la wallet del importador firma deploy y fondeo; la cuenta aprobadora de Alpha Pass firma aprobación y liberación en el servidor | `src/app/api/escrow/*`, `src/lib/server/trustless-work.ts` | `TRUSTLESS_WORK_API_KEY` | Código listo · falta la clave |
| [ACTA](https://acta.build) | SDK oficial `@acta-team/credentials` en el navegador, apuntando a `/api/acta`; el servidor agrega `X-ACTA-Key`. La cooperativa crea su `did:stellar`, su bóveda y emite la credencial del pasaporte (5 XLM por credencial en Testnet) | `src/lib/acta-bridge.tsx`, `src/app/api/acta/[...path]` | `ACTA_API_KEY` | Clave configurada |
| [Whisp (FAO)](https://whisp.openforis.org/api/openapi.json) | `POST /api/submit/geojson` asíncrono y consulta de `/api/status/{token}`; apta si `risk_pcrop = low` y sin perturbación después de 2020 | `src/app/api/whisp/route.ts`, `src/lib/whisp.ts` | `WHISP_API_KEY` | Código listo · falta la clave |
| Stellar Wallets Kit | Conexión y firma de cada rol (Freighter, xBull, Albedo, Lobstr…) | `src/lib/wallet.ts` | — | Listo |
| `LotPassport` | `create_lot` y `attest` firmados por la wallet; el servidor lee `get_lot` para fijar a la cooperativa como receptora del escrow y `is_attested` antes de liberar | `src/lib/lot-passport-client.ts`, `src/lib/server/stellar.ts` | — | Falta desplegar el contrato y poner `NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID` |
| Circle USDC y EURC | Moneda del escrow, elegida por el importador | `src/lib/adapters.ts` | — | Emisores Testnet en la plantilla; verificar en faucet.circle.com |
| Anchor Platform (SEP-24) | Retiro de la cooperativa | — | — | Pendiente |

## Cuentas de servicio

Alpha Pass usa cuatro cuentas propias en el escrow: aprobadora (también firma liberaciones), administradora, resolutora de disputas y plataforma. Sus secretos están en las variables `ALPHA_*_SECRET`. La aprobadora ya tiene fondos de Testnet (friendbot) para pagar comisiones.

El comprador firma el deploy y el fondeo. El receptor y `serviceProvider` se obtienen de `LotPassport.get_lot(lotId)`; el cliente no puede elegir la wallet que recibe los tres pagos. Un lote sin contrato publicado no puede crear escrow en Testnet.

## Orden de una liberación en Testnet

1. El verificador firma `LotPassport.attest` con su wallet.
2. El importador pulsa "Liberar hito".
3. `/api/escrow/release` simula `is_attested`; si es `false`, responde 409 y no toca el escrow.
4. Si es `true`, pide a Trustless Work la aprobación y la liberación, las firma con la cuenta aprobadora y las envía.
