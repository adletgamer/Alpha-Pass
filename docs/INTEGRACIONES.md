# Integraciones

Estado al 16-nov-2026. El prototipo corre en **modo demo** (`NEXT_PUBLIC_ALPHA_MODE=demo`) con adaptadores simulados en `apps/web/src/lib/adapters.ts`. Cada adaptador `testnet` falla con un mensaje claro hasta conectarse con la documentación oficial: no se inventaron endpoints.

| Herramienta | Para qué | Adaptador | Estado | Qué falta |
| --- | --- | --- | --- | --- |
| [Trustless Work](https://docs.trustlesswork.com) | Escrow multi-hito en USDC o EURC | `EscrowProvider` | Simulado | Pedir API key, mapear crear/fondear/aprobar/liberar según su API y React SDK |
| [ACTA](https://acta.build) | Credenciales W3C, `did:stellar` | `CredentialProvider` | Simulado | Confirmar acceso a red de prueba; plan B: atestaciones en `LotPassport` |
| [Whisp (FAO)](https://whisp.openforis.org) | Riesgo de deforestación por parcela | `DeforestationProvider` | Respuesta grabada | Pedir clave de API; llamar desde el servidor |
| [Circle USDC y EURC](https://faucet.circle.com) | Monedas del escrow | `ASSETS` | Emisores en `.env.example` | Verificar emisores Testnet contra el faucet de Circle |
| Stellar Wallets Kit | Firma de cada rol | — | Pendiente | Conectar Freighter en el front |
| Anchor Platform / testanchor (SEP-24) | Retiro de la cooperativa | — | Pendiente | Flujo interactivo SEP-24 |
| `LotPassport` (este repo) | Registro del lote y de los hitos | — | Contrato con tests | Desplegar en Testnet y generar el cliente TypeScript |
| `PremiumSplitter` (este repo) | Reparto del premio | — | Contrato con tests | Desplegar en Testnet |

## Monedas

El escrow acepta **USDC o EURC**; la moneda se elige al crear el escrow. La lógica de liberación no depende de la moneda (ver `release-gate.test.ts`). Los emisores Testnet de `.env.example` deben confirmarse en el faucet de Circle antes de usarse: la documentación de Trustless Work muestra un emisor de USDC distinto al del faucet.
