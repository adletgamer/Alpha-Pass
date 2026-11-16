# Contratos Soroban

| Contrato | Qué hace |
| --- | --- |
| `lot-passport` | Registra cada lote con la raíz Merkle de su pasaporte y guarda las atestaciones de acopio, embarque y llegada. Solo un verificador autorizado para un hito puede firmarlo, en orden. |
| `premium-splitter` | Reparte el premio del lote entre productores por pesos (sacos), con cualquier activo de Stellar (USDC o EURC). |

## Pruebas

```bash
cd contracts
cargo test
```

`lot-passport` cubre: flujo completo, embarque sin acopio rechazado, emisor no autorizado, doble atestación, lote duplicado o inválido, emisor revocado y lote inexistente. `premium-splitter` cubre el reparto con redondeo y entradas inválidas.

## Compilar y desplegar en Testnet

Requiere [Stellar CLI](https://developers.stellar.org/docs/tools/cli) y el target `wasm32v1-none`.

```bash
stellar contract build
stellar keys generate alpha-admin --network testnet --fund
stellar contract deploy \
  --wasm target/wasm32v1-none/release/lot_passport.wasm \
  --source alpha-admin --network testnet \
  -- --admin $(stellar keys address alpha-admin)
```

Después, autorizar a cada verificador con `set_issuer` y copiar el id del contrato en `NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID`.
