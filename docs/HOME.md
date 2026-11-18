# Home institucional

Portada en español en `/` y en inglés en `/en`, con selector ES/EN en ambas rutas. Las pantallas del prototipo siguen en sus URLs (`/cooperativa`, `/importador`, `/verificador`, `/lote/[id]`), ahora dentro del grupo `src/app/(producto)` con su propio encabezado.

## Estructura

| Sección | Componente | Notas |
| --- | --- | --- |
| Navegación | `components/home/HomeNav.tsx` | Anclas a las secciones, menú móvil con Escape, selector ES/EN, CTA a `/cooperativa` |
| Héroe | `components/home/HeroScene.tsx` + `origin-scene.ts` | Escena Three.js propia, cinco etapas ligadas al scroll, sin secuestrar el scroll |
| Problema | `components/home/HomePage.tsx` | Antes y después, sin cifras |
| Cómo funciona | `components/home/HowItWorks.tsx` | Pestañas accesibles con flechas; hitos 30/50/20 marcados como configuración ilustrativa |
| Producto | `components/home/ProductExplorer.tsx` | Usa los componentes reales de las tres pantallas con `LotProvider preview` (servicios simulados, sin persistencia, sin firmar) |
| Tecnología | `components/home/TechFlow.tsx` | Flujo de cinco herramientas con su papel en la operación |
| Participantes, CTA final, pie | `components/home/HomePage.tsx` | Aviso: Alpha Pass no certifica ni garantiza la aprobación EUDR |

## Escena 3D

- Relieve procedural con curvas de nivel en un shader propio; parcelas P-01 a P-05 del lote de ejemplo (P-05 en rojo por la alerta).
- Etapas: origen → evidencia → pasaporte → escrow → liberación. La cámara y la opacidad de cada capa dependen del avance del scroll.
- Rendimiento: `three` se carga con `import()` solo en el navegador; dibuja bajo demanda y se detiene fuera de pantalla; geometría y DPR reducidos en móvil o equipos de 4 núcleos o menos; `dispose()` libera geometrías, materiales y el contexto WebGL.
- Accesibilidad: con `prefers-reduced-motion` no hay animación continua (solo cambia con el scroll y el desplazamiento a etapas es instantáneo). Sin WebGL se muestra una ilustración SVG estática. Las etapas son botones navegables con teclado.

## Pruebas realizadas (Playwright + Chrome)

Escritorio 1440×900 y móvil 390×844: sin errores de consola de la home, sin desbordamiento horizontal, todos los enlaces internos existen, el CTA "Explorar pasaporte de ejemplo" abre la pestaña del pasaporte. También con WebGL desactivado (se ve la ilustración) y con movimiento reducido.

## Límites conocidos

- ThreeUI / KageLandingPage no se integró: no fue posible descargar su código fuente para revisarlo. La escena es propia y no deriva de ese componente.
- El CTA final abre el explorador interactivo de la portada. Las pantallas del prototipo se muestran en español en ambos idiomas.
- El logo es un PNG recortado del brand board (532×116 px). Falta el vector original.
