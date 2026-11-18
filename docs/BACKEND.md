# Backend y persistencia

La aplicación Next.js conserva las rutas API. El esquema PostgreSQL para Neon está en `apps/web/src/lib/server/db/schema.ts` y la migración inicial en `apps/web/drizzle/`. Incluye organizaciones, wallets por rol, lotes, parcelas privadas, análisis Whisp, credenciales ACTA, escrows, hitos, desafíos de wallet, sesiones, trabajos y auditoría.

Los montos del esquema usan `numeric(24,7)` y deben tratarse como cadenas decimales en el código de pagos. Las geometrías GeoJSON permanecen en PostgreSQL; la página pública debe exponer únicamente datos permitidos.

Para aplicar la migración, configurar `DATABASE_URL` en un entorno seguro fuera del repositorio y ejecutar desde `apps/web`:

```bash
npm run db:migrate
```

`getDb()` falla si falta `DATABASE_URL`; ningún endpoint debe asumir que el navegador es la fuente de verdad. La migración todavía no se aplicó porque el proyecto Neon no está creado. Falta implementar sesiones de wallet, permisos por lote, rutas de lectura/escritura e idempotencia de la liberación antes de activar operaciones de pago.
