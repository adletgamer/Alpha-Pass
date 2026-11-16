# Diagrama de flujo de Alpha Pass

Regla central: **el dinero no se mueve hasta que existe la prueba**. Cada hito del escrow se libera solo si `LotPassport` tiene la atestación de ese hito y el hito anterior ya se liberó.

## Flujo de punta a punta

```mermaid
flowchart TD
    A([Cooperativa carga parcelas en GeoJSON]) --> B[Whisp FAO evalúa riesgo de deforestación]
    B --> C{¿Parcela sin riesgo?}
    C -- No --> D[Parcela excluida del lote]
    C -- Sí --> E[Credenciales W3C en ACTA: organización, parcela, deforestación, composición]
    E --> F[Raíz Merkle anclada en LotPassport]
    F --> G[Importador elige USDC o EURC y fondea el escrow de Trustless Work]
    G --> H[Verificador firma un hito con el hash de su evidencia]
    H --> I{¿Emisor autorizado y hito anterior atestado?}
    I -- No --> J[LotPassport rechaza la atestación]
    I -- Sí --> K[Atestación guardada en LotPassport]
    K --> L{¿Alpha Pass consulta is_attested = true?}
    L -- No --> M[Liberación rechazada]
    L -- Sí --> N[Trustless Work libera el porcentaje del hito: 30 / 50 / 20]
    N --> O{¿Quedan hitos?}
    O -- Sí --> H
    O -- No --> P[PremiumSplitter reparte el premio a productores por sacos]
    P --> Q[Retiro de la cooperativa por SEP-24]
    F --> R[Pasaporte público con QR y paquete GeoJSON para la declaración EUDR]
```

## Quién hace qué

```mermaid
sequenceDiagram
    autonumber
    actor Coop as Cooperativa
    participant App as Alpha Pass (Next.js)
    participant Whisp as Whisp (FAO)
    participant ACTA as ACTA (credenciales)
    participant LP as LotPassport (Soroban)
    actor Imp as Importador
    participant TW as Trustless Work (escrow)
    actor Ver as Verificador

    Coop->>App: Carga parcelas (GeoJSON)
    App->>Whisp: Evalúa riesgo por parcela
    Whisp-->>App: sin_riesgo / alerta
    App->>ACTA: Emite credenciales del lote
    App->>LP: create_lot(raíz Merkle, parcelas, sacos)
    Imp->>App: Elige USDC o EURC y monto
    App->>TW: Crea y fondea escrow de 3 hitos
    Ver->>LP: attest(hito, hash de evidencia)
    Imp->>App: Liberar hito
    App->>LP: is_attested(lote, hito)
    alt atestado
        App->>TW: Aprueba y libera el hito
    else sin atestación
        App-->>Imp: Rechazado: falta la prueba
    end
```

## Estados de un hito

```mermaid
stateDiagram-v2
    [*] --> Pendiente
    Pendiente --> Atestado: verificador autorizado firma
    Atestado --> Liberado: hito anterior liberado y escrow con fondos
    Pendiente --> Pendiente: intento de liberar sin prueba (rechazado)
    Liberado --> [*]
```

## Límite honesto del MVP

Trustless Work no puede llamar a `LotPassport` desde su contrato. En el MVP, la cuenta de Alpha Pass es la aprobadora de hitos del escrow y solo aprueba si `is_attested` devuelve `true`. La verificación es pública y auditable en la cadena, pero la aprobación depende de esa cuenta de servicio. Una versión posterior puede usar un escrow propio que consulte `LotPassport` directamente.
