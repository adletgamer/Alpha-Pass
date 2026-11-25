# Integraciones

Configura `NEXT_PUBLIC_ALPHA_MODE=testnet` para habilitar el flujo con wallet y proveedores de prueba. Las claves se configuran en el servidor y se mantienen fuera de Git, sin el prefijo `NEXT_PUBLIC_`.

| Herramienta | Cómo se integra | Archivo | Clave | Estado |
| --- | --- | --- | --- | --- |
| [Trustless Work](https://docs.trustlesswork.com/trustless-work/v2-en/api-rest/introduction), multi-release | El importador firma la creación y el fondeo. La cuenta aprobadora de Alpha Pass firma la aprobación y la liberación en el servidor. | `src/app/api/escrow/*`, `src/lib/server/trustless-work.ts` | `TRUSTLESS_WORK_API_KEY` | Deploy, fondeo y tres pagos comprobados con v1 en Testnet |
| [ACTA](https://acta.build) | El SDK usa `/api/acta` y el servidor adjunta `X-ACTA-Key`. La cooperativa crea su `did:stellar`, su bóveda y firma la emisión con la wallet registrada para esa clave. | `src/lib/acta-bridge.tsx`, `src/app/api/acta/[...path]` | `ACTA_API_KEY` | Configuración y bóveda comprobadas. Emisión pendiente con la wallet vinculada. |
| [Whisp (FAO)](https://whisp.openforis.org/api/openapi.json) | `POST /api/submit/geojson` asíncrono y consulta de `/api/status/{token}`. Parcela apta si `risk_pcrop = low` y sin perturbación después de 2020. | `src/app/api/whisp/route.ts`, `src/lib/whisp.ts` | `WHISP_API_KEY` | Evaluación real y sincronización entre roles comprobadas localmente con Neon |
| Stellar Wallets Kit | Conexión y firma de cada rol (Freighter, xBull, Albedo, Lobstr…) | `src/lib/wallet.ts` | — | Listo |
| `LotPassport` | `create_lot` y `attest` firmados por la wallet; el servidor lee `get_lot` para fijar a la cooperativa como receptora del escrow y `is_attested` antes de liberar | `src/lib/lot-passport-client.ts`, `src/lib/server/stellar.ts` | — | Desplegado en Testnet; ID público en `.env.example`. Verificadores autorizados por hito |
| Circle USDC y EURC | Moneda del escrow, elegida por el importador | `src/lib/adapters.ts` | — | Emisores Testnet en la plantilla; verificar en faucet.circle.com |
| Anchor Platform (SEP-24) | Retiro de la cooperativa | — | — | Pendiente |

## Cuentas de servicio

Alpha Pass usa cuatro cuentas propias en el escrow: aprobadora (también firma liberaciones), administradora, resolutora de disputas y plataforma. Sus secretos están en las variables `ALPHA_*_SECRET`. La aprobadora ya tiene fondos de Testnet (friendbot) para pagar comisiones.

El comprador firma el deploy y el fondeo. El receptor y `serviceProvider` se obtienen de `LotPassport.get_lot(lotId)`; el cliente no puede elegir la wallet que recibe los tres pagos. Un lote sin contrato publicado no puede crear escrow en Testnet.

## LotPassport en Testnet

Contrato: `CDNM2H5XU3IR5YVE6TJJE36RPFIKWVQ2WEPNRSLAMW2JPAURETVCZ7BO` (WASM SHA-256 `230fa0045cc0a974b1ecfc5d6b02cbfaa079b3487c18ad51a69569b62522ba2d`). Desplegado el 18-nov-2026; `is_issuer` devolvió `true` para cada pareja:

| Hito | Wallet verificadora de prueba |
| --- | --- |
| Acopio | `GC6OCVKRX6G3PLVGJHKZDIZ7XP23RPMMAUQRAJ54XKMBIYF4HNYX356T` |
| Embarque | `GDWHQJWMBVOUQGYJZOQ3LPK3BLN6YALKFBDZ2KRWGR3RNSSCOB5ECC3W` |
| Llegada | `GA2OGIRLWOI53W33EWENAKCHCCNBTPMAE4JIWWXNRVFT4J6UFZJI4XQK` |

Las identidades de prueba se guardaron localmente bajo `contracts/.stellar/` (ignorado por Git). `NEXT_PUBLIC_LOT_PASSPORT_CONTRACT_ID` está configurado en Vercel para producción y para la rama preview `fix/testnet-escrow-receiver`; hace falta un nuevo despliegue para que el bundle publicado incorpore el valor.

## Orden de una liberación en Testnet

1. El verificador firma `LotPassport.attest` con su wallet.
2. El importador pulsa "Liberar hito".
3. `/api/escrow/release` simula `is_attested`; si es `false`, responde 409 y no toca el escrow.
4. Si es `true`, pide a Trustless Work la aprobación y la liberación, las firma con la cuenta aprobadora y las envía.

## Demo guiada con una sola wallet

`/demo` recorre la operación completa con **una sola wallet**. Quien prueba elige un rol (cooperativa, importador o verificador) y firma solo los pasos de ese rol. El servidor firma los demás pasos con tres cuentas de prueba de Alpha Pass, "de la casa", fondeadas con Friendbot y USDC de prueba. La regla no cambia: cada hito se libera solo si `LotPassport.is_attested` devuelve `true`.

| Paso | Firma si eliges ese rol | Si no, firma |
| --- | --- | --- |
| Whisp (FAO) evalúa las 5 parcelas | — | Servidor |
| Credencial W3C del lote en ACTA | — | Emisora ACTA de Alpha Pass |
| `LotPassport.create_lot` | Tu wallet (cooperativa) | Cooperativa de la casa |
| Deploy y fondeo del escrow de 150 USDC | Tu wallet (importador) | Importador de la casa |
| Liberar sin prueba (debe responder 409) | — | Servidor |
| `attest` de acopio, embarque y llegada | Tu wallet (verificador) | Verificador de la casa |
| Aprobar y liberar cada hito | — | Aprobadora de Alpha Pass |

Antes de empezar, `/api/demo` (acción `prepare`) deja lista la wallet del usuario. Pide XLM a Friendbot y, según el rol, pide como máximo una firma más:
- la cooperativa abre la trustline de USDC para cobrar;
- el importador cambia XLM de prueba por 200 USDC;
- el verificador no firma nada, porque la administradora lo autoriza en LotPassport.

Si eliges cooperativa, los tres pagos llegan a tu wallet. En los otros roles cobra la cooperativa de la casa, y el servidor recicla ese USDC hacia el importador de la casa para la siguiente demo.

### Preparar las cuentas de la casa

```bash
cd apps/web
npm run demo:setup
```

El script crea las cuentas que falten y guarda sus secretos en `.env.local`, sin imprimirlos. Las fondea con Friendbot, abre las trustlines y compra 1000 USDC de prueba para el importador. También autoriza al verificador de la casa en los tres hitos. Se puede repetir sin efectos secundarios. Las direcciones del 24-nov-2026:

| Cuenta | Dirección |
| --- | --- |
| Cooperativa de la casa | `GCURU4VWEG5FE2RYRU7EFMDXVMGIROKCPQ5IQFIXGKKPYQQ4ULPM2UG5` |
| Importador de la casa | `GCB7BQI5J5Y6XSSKE6RHP4EXMQIQLDIQW4VDJIXZ3E6OBXWUZEBBVQQM` |
| Verificador de la casa | `GDWSYWRUYKYGCIR4AQPPDEMSZ6S6TWPJSBBUSKTKFCFT3G3KMD3D2MMK` |

Para desplegar, copia las variables `ALPHA_DEMO_*` y `ALPHA_ACTA_*` a Vercel, sin el prefijo `NEXT_PUBLIC_`.

### ACTA de punta a punta

ACTA solo acepta como emisor la wallet asociada a `ACTA_API_KEY`; el destinatario puede ser cualquier dirección. Por eso la emisión ocurre en el servidor:
1. La emisora (`ALPHA_ACTA_ISSUER_SECRET`) crea una bóveda patrocinada para la cooperativa (`/contracts/sponsored-vault/create`).
2. Emite ahí la credencial `AlphaPassLotPassport` con la raíz del pasaporte (`/contracts/vc/issue`).
3. Comprueba la credencial con `verify-vc`.

`npm run demo:setup` registra una sola vez el `did:stellar` de la emisora y lo guarda en `ALPHA_ACTA_ISSUER_IDENTITY`. El servidor usa la API REST de ACTA directamente, porque la entrada del SDK carga hooks de React que no funcionan en una ruta de servidor de Next.

### Prueba de la demo

`node --dns-result-order=ipv4first scripts/e2e-demo.mjs http://localhost:3000` crea una wallet nueva por rol y recorre los 12 pasos firmando solo los de ese rol.

## Preparar una wallet para Stellar Testnet

La página `/testnet` deja lista una wallet de Stellar en Testnet (Freighter, xBull, Lobstr, Albedo…):

1. **XLM:** friendbot crea la cuenta (`/api/testnet`, acción `fund`).
2. **USDC de prueba:** la wallet firma una transacción que abre la trustline de USDC de Circle (Testnet) y compra 200 USDC con su propio XLM en el DEX de Testnet (`pathPaymentStrictReceive`). Alpha Pass no custodia ni envía fondos.
3. **Verificador (opcional):** la cuenta administradora de LotPassport (`ALPHA_ADMIN_SECRET`) firma `set_issuer` para los tres hitos. Solo en Testnet y con límite por IP.

El escrow no deja que la misma wallet pague y cobre: hacen falta dos cuentas (cooperativa e importador). Ambas necesitan trustline de USDC; la cooperativa, para cobrar.

En Testnet cada lote recibe un ID único (`2026-JAE-014-XXXX`), porque LotPassport no admite IDs repetidos, y el escrow es de 150 USDC (45 · 75 · 30).

## Trustless Work: v1 o v2

La clave de API de Testnet del dApp de Trustless Work funciona en `https://dev.api.trustlesswork.com` (v1); `beta.api` (v2) la rechaza con `AUTH_INVALID_CREDENTIAL`. El cliente (`lib/server/trustless-work.ts`) deduce la versión de la URL. Todas las wallets de rol (aprobadora, plataforma, resolutora, administradora y receptora) necesitan trustline del activo; las cuatro cuentas de servicio ya la tienen en Testnet. Trustless Work cobra su comisión de protocolo al liberar: en la prueba, de 150 USDC llegaron 149,55 a la cooperativa.

## Prueba de punta a punta

`node apps/web/scripts/e2e-testnet.mjs http://localhost:3000` crea tres cuentas nuevas y recorre todo el flujo contra la app. Resultado del 18-nov-2026 (lote `2026-JAE-014-E2E6TU`): 20/20 pasos correctos.

- Whisp devolvió el riesgo por parcela (ID propio vía `externalIdColumn`).
- `create_lot` firmado por la cooperativa.
- Escrow `CBTSQJPCHK62B7YUHWIBFSZEFSQ3IW6X2B54JVFSTED2HHGCL5THG2IN` desplegado y fondeado por el importador.
- Liberar sin credencial y liberar con el escrow de otro lote respondieron 409.
- Tres atestaciones y tres liberaciones; la cooperativa recibió 149,55 USDC.
- `/api/lote/[id]` leyó el lote y sus 3 hitos desde la cadena.

La emisión de la credencial en ACTA ocurre en el navegador con la wallet; el script no la cubre.

## Operación compartida en Testnet

`/testnet` permite elegir un flujo independiente. En `/testnet/cooperativa` la cuenta con XLM de Friendbot evalúa parcelas en Whisp y firma el anclaje en LotPassport. En `/testnet/importador` el importador usa su propia cuenta con USDC de prueba. La contraparte y los tres hitos vienen del lote indicado por `NEXT_PUBLIC_TESTNET_IMPORTER_LOT_ID`. El estado del fondeo se conserva en el navegador por cuenta.

El lote de referencia `2026-JAE-014-SOLO01` fue anclado y atestado en Stellar Testnet. La validación desplegó y fondeó el escrow `CAA66ALCFG7LJO2BBY2KD5L2GVWWO2MZWWRFHG5KDEOUG6LY5A6DK62W`, confirmó el bloqueo antes de la primera atestación y liberó los tres pagos. El abono total a la cooperativa fue de 149,55 USDC de prueba.

Para preparar otra referencia, crea y fondea las identidades `alpha-cooperativa`, `alpha-importador` y `alpha-verificador` con `stellar keys generate <alias> --network testnet --fund --secure-store`. Usa el mismo directorio de configuración de Stellar CLI para las tres. Inicia una app local con los proveedores de Testnet y ejecuta `node --env-file=<archivo-local> apps/web/scripts/prepare-role-testnet.mjs <directorio-stellar-cli> <id-nuevo> <url-local>`. Define el nuevo ID en `NEXT_PUBLIC_TESTNET_IMPORTER_LOT_ID` cuando la prueba confirme el anclaje y las atestaciones.

### Recorrido con un lote compartido

1. Prepara un PostgreSQL de prueba, preferiblemente una rama aislada de Neon. En `apps/web`, configura `DATABASE_URL` en el servidor y `DATABASE_URL_UNPOOLED` para la migración si dispones de ambas conexiones. Ejecuta `npm run db:migrate`. Las operaciones de Testnet existentes en un navegador siguen siendo locales. Para usar los enlaces, abre un lote nuevo desde `/testnet` antes de anclarlo.
2. Conecta la cuenta de cooperativa. Pulsa **Abrir operación compartida** y guarda el enlace de cooperativa. Copia el enlace de importador y el del verificador para sus respectivos perfiles. El código de cada enlace se guarda como hash en el servidor y se retira de la barra de direcciones al abrirlo.
3. Verifica las parcelas en Cooperativa. Usa la wallet Testnet con la que se creó `ACTA_API_KEY` para firmar la emisión y luego anclar el pasaporte. Puedes configurar su dirección pública en `NEXT_PUBLIC_ACTA_ISSUER_ADDRESS` para avisar antes de pedir firmas. Si cancelas el anclaje después de guardar la credencial, **Continuar anclaje del pasaporte** la reutiliza. Si una transacción quedó pendiente, actualiza el lote antes de continuar.
4. Desde el otro perfil, conecta la cuenta compradora y abre el enlace de importador. Crea el escrow y cancela la firma del depósito. Tras recargar, pulsa **Continuar fondeo**. Debe conservarse el mismo contrato. Revisa los hashes bajo **Referencias de transacciones** en la guía.
5. Antes de firmar una atestación, comprueba que el hito esté retenido. Abre el enlace de verificador y firma acopio. En Importador, actualiza y libera ese hito. Ambos perfiles deben mostrar el mismo lote y progreso. Repite para embarque y llegada. Comprueba también el pasaporte público desde un perfil sin el enlace privado.

El runner compartido se ejecuta con `node apps/web/scripts/e2e-testnet.mjs http://127.0.0.1:3150 --shared` sobre una instancia de pruebas. Requiere Node 24 o posterior y `E2E_ACTA_ISSUER_SECRET` en el proceso local del runner para firmar con una cuenta emisora dedicada a Testnet. También se puede completar el recorrido manual firmando desde la wallet, sin exportar su clave privada. El runner crea las cuentas efímeras de importador y verificador.

### Validación del 19-nov-2026

- Se aplicó la migración al proyecto aislado `alpha-pass-testnet` de Neon. Después de la evaluación real de Whisp, el importador leyó las cuatro parcelas aptas de un total de cinco.
- La prueba de LotPassport y Trustless Work v1 pasó sus 20 pasos con el lote `2026-JAE-014-E2EE81AD5CA`. El escrow se fondeó con 150 USDC de prueba, rechazó la liberación sin atestación y pagó 149,55 USDC de prueba a la cooperativa tras los tres hitos.
- Una operación de prueba en Neon con las referencias de ese lote confirmó los tres pagos en Stellar. Reintentar el último hito devolvió el recibo original. El enlace de cooperativa recibió 403 al intentar liberar.
- ACTA permitió registrar la identidad y crear la bóveda de la cuenta de prueba. Rechazó la emisión porque la wallet no era la asociada a la clave del servidor. Queda por repetir la emisión y el recorrido compartido completo con la wallet vinculada.

## Expediente del lote

En Testnet, el enlace del importador permite descargar el expediente de una operación compartida tras confirmar el anclaje. El archivo JSON `alpha-pass.lot-evidence/v1` contiene la evidencia de las parcelas incluidas, sus resultados de riesgo y la composición del lote. Incluye una instantánea de las atestaciones y del estado de pago de cada hito, con las referencias de liberación disponibles.

El pasaporte público usa LotPassport como referencia y no publica las coordenadas. Puede leer un expediente local y recalcular su raíz Merkle sin enviar el archivo. La raíz cubre el contenido de `claims`. La instantánea de atestaciones y pagos refleja la consulta realizada al exportar. Este archivo conserva evidencias para revisión y la declaración EUDR se tramita por separado.

El pasaporte público se puede consultar por enlace o QR. Para obtener el expediente de una operación, entra con la wallet y el enlace del importador.
