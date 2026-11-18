# Home institucional

Portada en español en `/` y en inglés en `/en`, con selector ES/EN en ambas rutas. Las pantallas del prototipo siguen en sus URLs (`/cooperativa`, `/importador`, `/verificador`, `/lote/[id]`), ahora dentro del grupo `src/app/(producto)` con su propio encabezado.

## Estructura

| Sección | Componente | Notas |
| --- | --- | --- |
| Navegación | `components/home/HomeNav.tsx` | Anclas a las secciones, menú móvil con Escape, selector ES/EN, CTA a `/cooperativa` |
| Héroe | `components/home/HeroScene.tsx` + `origin-scene.ts` | Escena Three.js propia, cinco etapas ligadas al scroll, indicador del lote y navegación directa entre etapas |
| Problema | `components/home/HomePage.tsx` | Antes y después, sin cifras |
| Cómo funciona | `components/home/HowItWorks.tsx` | Pestañas accesibles con flechas y avance secuencial; simulación de la prueba necesaria para liberar el primer hito 30/50/20 |
| Producto | `components/home/ProductExplorer.tsx` | Usa los componentes reales de las tres pantallas con `LotProvider preview` (servicios simulados, sin persistencia, sin firmar) |
| Tecnología | `components/home/TechFlow.tsx` | Cinco herramientas con su papel y un esquema de entrada y resultado para cada una |
| Participantes, CTA final, pie | `components/home/HomePage.tsx` | Aviso: Alpha Pass no certifica ni garantiza la aprobación EUDR |

## Escena 3D

- Relieve procedural con curvas de nivel en un shader propio; parcelas P-01 a P-05 del lote de ejemplo (P-05 en rojo por la alerta).
- Etapas: origen → evidencia → pasaporte → escrow → liberación. La cámara y la opacidad de cada capa dependen del avance del scroll.
- Rendimiento: `three` se carga con `import()` solo en el navegador; dibuja bajo demanda y se detiene fuera de pantalla; geometría y DPR reducidos en móvil o equipos de 4 núcleos o menos; `dispose()` libera geometrías, materiales y el contexto WebGL.
- Accesibilidad: con `prefers-reduced-motion` no hay animación continua (solo cambia con el scroll y el desplazamiento a etapas es instantáneo). Sin WebGL se muestra una ilustración SVG estática. Las etapas son botones navegables con teclado.
- En móvil, las etapas se desplazan horizontalmente y el indicador del lote se reduce para dejar libre el titular.

## Interacciones de la home

- Las pestañas de «Cómo funciona» cambian al hacer clic o con teclado; pasar el cursor no interrumpe la lectura. «Siguiente etapa» permite recorrer los cuatro pasos. Las mismas interacciones están disponibles en `/en`.
- La última etapa ilustra la condición del escrow: sin credencial, el primer hito queda bloqueado; al añadir una prueba de ejemplo se libera visualmente el 30 % (4,950 USDC del lote simulado). No ejecuta transacciones.
- En «Tecnología», cada herramienta se selecciona con clic o teclado y muestra sus datos de entrada y el resultado esperado.

## Pruebas realizadas (Playwright + Chrome)

Escritorio 1440×900 y móvil 390×844: sin errores de consola de la home, sin desbordamiento horizontal, todos los enlaces internos existen, el CTA "Explorar pasaporte de ejemplo" abre la pestaña del pasaporte. También con WebGL desactivado (se ve la ilustración) y con movimiento reducido.

En esta mejora: compilación de producción y chequeo de tipos; 14 pruebas Vitest aprobadas tras integrar `/en`; revisión visual del hero en móvil y escritorio; comprobación en navegador de la transición «sin credencial → prueba verificada» en ambos idiomas y de la selección de herramientas. El indicador compacto se ajustó después de detectar que cubría el titular.

## Límites conocidos

- ThreeUI / KageLandingPage no se integró: no fue posible descargar su código fuente para revisarlo. La escena es propia y no deriva de ese componente.
- El CTA final abre el explorador interactivo de la portada. Las pantallas del prototipo se muestran en español en ambos idiomas.
- El logo es un PNG recortado del brand board (532×116 px). Falta el vector original.
