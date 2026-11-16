# Marca Alpha Pass

El Brand Book completo (logo, tokens, voz, patrones UI y accesibilidad) está en el artifact **Alpha Pass — Brand Book** que comparte el equipo. Este archivo resume lo necesario para el código.

## Logo

Una A verde cuyo trazo inferior es una ruta curva que termina en un punto rojo cereza. `apps/web/public/brand/alpha-pass-symbol.svg` es una **vectorización aproximada** del logo del equipo: reemplazarla por el vector original cuando esté disponible.

## Tokens usados en `apps/web/src/app/globals.css`

| Token | Valor | Uso |
| --- | --- | --- |
| `--ap-green-800` | #1F4D3A | Verde Bosque, marca y botón primario |
| `--ap-cherry-600` | #B23A2E | Rojo Cereza, acento y foco |
| `--ap-parchment` | #F3EDE2 | Fondo de página |
| `--ap-ink` | #1C1B19 | Texto principal |
| `--ap-ink-muted` | #5A574F | Texto secundario (6.2:1 sobre pergamino) |
| `--ap-font-sans` | Manrope | Interfaz y títulos |
| `--ap-font-mono` | IBM Plex Mono | IDs, hashes, coordenadas, fechas y montos |

## Reglas que el código debe respetar

- Estados siempre con texto, nunca solo por color.
- Botones de 44 px de alto; foco visible de 3 px en rojo cereza.
- Un pago bloqueado se muestra deshabilitado con el motivo escrito.
- Montos con su moneda (USDC o EURC) y cifras tabulares.
