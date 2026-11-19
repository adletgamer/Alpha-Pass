// Escena 3D de la home: del origen (parcelas en los Andes) al comercio verificado.
// Escena propia de Alpha Pass sobre Three.js. Se carga solo en el navegador,
// renderiza bajo demanda y libera todos sus recursos en dispose().

import * as THREE from "three";

export const STAGES = ["origen", "evidencia", "pasaporte", "escrow", "liberacion"] as const;
export type Stage = (typeof STAGES)[number];

const COLORS = {
  green: new THREE.Color("#1F4D3A"),
  greenLight: new THREE.Color("#2E6B52"),
  cherry: new THREE.Color("#B23A2E"),
  parchment: new THREE.Color("#F3EDE2"),
  ink: new THREE.Color("#1C1B19"),
};

/** Parcelas de ejemplo (las mismas 5 del prototipo; P-05 con alerta). Coordenadas de escena. */
const PARCELS: { id: string; alert: boolean; pts: [number, number][] }[] = [
  { id: "P-01", alert: false, pts: [[-21, 6], [-17.5, 5.2], [-16.8, 8.6], [-20.6, 9.4]] },
  { id: "P-02", alert: false, pts: [[-17, 4.8], [-13.6, 4.2], [-13.2, 7.4], [-16.4, 8.2]] },
  { id: "P-03", alert: false, pts: [[-20.4, 10.2], [-16.4, 9.2], [-15.6, 13.4], [-19.8, 14]] },
  { id: "P-04", alert: false, pts: [[-15.8, 8.6], [-12.6, 7.8], [-12, 11.6], [-15, 12.6]] },
  { id: "P-05", alert: true, pts: [[-27.5, 13], [-24.2, 12.2], [-23.6, 15.6], [-27, 16.4]] },
];

const ORIGIN = new THREE.Vector2(-16.8, 8.6);

// ---------- relieve determinista (value noise) ----------
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function heightAt(x: number, z: number) {
  let h = 0, amp = 1, f = 0.032;
  for (let i = 0; i < 4; i++) {
    h += amp * noise(x * f + 11.3, z * f - 7.1);
    amp *= 0.5;
    f *= 2.05;
  }
  // Cordillera hacia el oeste-sur, valle cafetalero templado alrededor del origen.
  const ridge = Math.exp(-((x + 34) ** 2) / 260) * 9;
  const valley = Math.exp(-((x - ORIGIN.x) ** 2 + (z - ORIGIN.y) ** 2) / 120) * -2.2;
  const plains = THREE.MathUtils.smoothstep(x, 0, 40) * -3.5;
  return h * 6 + ridge + valley + plains;
}

// ---------- shaders del terreno: curvas de nivel estilo SIG con relieve sombreado ----------
const terrainVertex = /* glsl */ `
  varying float vH;
  varying vec2 vXZ;
  varying vec3 vN;
  #include <fog_pars_vertex>
  void main() {
    vH = position.y;
    vXZ = position.xz;
    vN = normal;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const terrainFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uShade;
  uniform vec3 uLine;
  uniform vec3 uLight;
  uniform float uStep;
  uniform float uFade;
  varying float vH;
  varying vec2 vXZ;
  varying vec3 vN;
  #include <fog_pars_fragment>
  void main() {
    float h = vH / uStep;
    float d = abs(fract(h - 0.5) - 0.5) / fwidth(h);
    float line = 1.0 - min(d, 1.0);
    float major = 1.0 - min(abs(fract(vH / (uStep * 5.0) - 0.5) - 0.5) / fwidth(vH / (uStep * 5.0)), 1.0);
    float edge = 1.0 - smoothstep(uFade * 0.55, uFade, length(vXZ - vec2(-8.0, 0.0)));
    // Sombreado de relieve suave (luz del noroeste, como en cartografía).
    float lambert = clamp(dot(normalize(vN), normalize(uLight)), 0.0, 1.0);
    float shade = (1.0 - lambert) * 0.55 * edge;
    vec3 col = mix(uBase, uShade, shade);
    col = mix(col, uLine, (line * 0.26 + major * 0.34) * edge);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

// ---------- grano de café arábica, modelado por procedimiento ----------
const BEAN_TONES = {
  base: new THREE.Color("#93A784"), // verde de café pergamino / grano verde
  deep: new THREE.Color("#3F5E46"), // surco y sombras
  light: new THREE.Color("#C8D2B2"), // película plateada en los lomos
};

/**
 * Grano de arábica: cuerpo ovalado con lomo convexo, cara ventral plana y
 * surco central en S. Eje largo = Z, cara plana (con el surco) = +Y.
 */
function createBeanGeometry(detail: number) {
  const g = new THREE.SphereGeometry(1, detail, Math.round(detail * 0.75));
  g.rotateX(Math.PI / 2); // polos en las puntas del grano, no sobre el surco
  const pos = g.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i), y = pos.getY(i);
    const z = pos.getZ(i);
    // Puntas algo más finas y una asimetría leve: ningún grano es perfecto.
    const taper = 1 - 0.16 * z * z;
    x *= taper;
    x += 0.035 * z * z - 0.02;
    // Cara ventral aplanada.
    const ventral = THREE.MathUtils.smoothstep(y, -0.05, 0.25);
    y = y > 0 ? y * 0.4 : y;
    // Surco en S, más hondo al centro y que se pierde en las puntas.
    const cx = 0.11 * Math.sin(z * 2.6);
    const dx = x - cx;
    const along = Math.pow(Math.max(0, 1 - z * z), 0.6);
    const w = 0.075;
    const groove = Math.exp(-(dx * dx) / (2 * w * w)) * along * ventral;
    // Labios del surco: ligero abultamiento a cada lado.
    const lip = Math.exp(-((Math.abs(dx) - 0.17) ** 2) / 0.006) * along * ventral;
    y += -groove * 0.3 + lip * 0.025;
    pos.setXYZ(i, x * 0.68, y * 0.62, z);
    // Color: moteado suave, surco oscuro, lomos más claros.
    const mottle = noise(x * 7 + 3, z * 7 - 2) * 0.5 + noise(x * 19, z * 17) * 0.25;
    c.copy(BEAN_TONES.base).lerp(BEAN_TONES.light, Math.max(0, (1 - ventral) * (y < -0.4 ? 0.35 : 0.12) + (mottle - 0.4) * 0.35));
    c.lerp(BEAN_TONES.deep, Math.min(1, groove * 0.9 + (1 - along) * 0.08));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function radialTexture(inner: string, outer: string) {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const gr = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export interface SceneOptions {
  lowPower: boolean;
  reducedMotion: boolean;
  onHoverParcel?: (id: string | null, alert: boolean) => void;
}

type Fadeable = { material: THREE.Material & { opacity: number }; base: number; from: number; to: number };

export class OriginScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private disposables: { dispose(): void }[] = [];
  private fadeables: Fadeable[] = [];
  private parcelMeshes: THREE.Mesh[] = [];
  private parcelLines = new Map<string, THREE.LineLoop>();
  private routeGeo!: THREE.TubeGeometry;
  private routeCurve!: THREE.CatmullRomCurve3;
  private routeIndexCount = 0;
  private originRing!: THREE.Mesh;
  private bean!: THREE.Group;
  private beanShadow!: THREE.Mesh;
  private beanBaseY = 0;
  private courier!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2(2, 2);
  private progress = 0;
  private hovered: string | null = null;
  private frame = 0;
  private running = false;
  private needsRender = true;
  private start = performance.now();

  constructor(private canvas: HTMLCanvasElement, private opts: SceneOptions) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !opts.lowPower, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.lowPower ? 1.25 : 1.75));
    this.renderer.setClearColor(COLORS.parchment, 1);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 400);
    this.scene.fog = new THREE.Fog(COLORS.parchment, 70, 150);
    this.build();
    this.resize();
  }

  // ---------- construcción ----------
  private track<T extends { dispose(): void }>(o: T): T {
    this.disposables.push(o);
    return o;
  }

  private fade<M extends THREE.Material & { opacity: number }>(m: M, opacity: number, from: number, to: number) {
    m.transparent = true;
    m.opacity = from > 0 ? 0 : opacity;
    if (from > 0) this.fadeables.push({ material: m, base: opacity, from, to });
    return m;
  }

  private lineMat(color: THREE.Color, opacity: number, from = 0, to = 0) {
    return this.fade(this.track(new THREE.LineBasicMaterial({ color })), opacity, from, to);
  }

  private basicMat(color: THREE.Color, opacity: number, from = 0, to = 0, side: THREE.Side = THREE.FrontSide) {
    return this.fade(this.track(new THREE.MeshBasicMaterial({ color, side, depthWrite: false })), opacity, from, to);
  }

  /** Material iluminado para los objetos con volumen (sellos, pasaporte, hitos). */
  private litMat(color: THREE.Color, from = 0, to = 0, extra: THREE.MeshStandardMaterialParameters = {}) {
    return this.fade(this.track(new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra })), 1, from, to);
  }

  private build() {
    // Luz de cielo cálida y sol bajo del noroeste: volumen sin perder la paleta.
    const hemi = new THREE.HemisphereLight(0xfbf8f2, 0x2e6b52, 1.7);
    const sun = new THREE.DirectionalLight(0xfff3e0, 2.1);
    sun.position.set(-30, 50, 26);
    sun.target.position.set(-16, 0, 6);
    this.scene.add(hemi, sun, sun.target);

    const seg = this.opts.lowPower ? 110 : 200;
    const size = 150;
    const geo = this.track(new THREE.PlaneGeometry(size, size, seg, seg));
    geo.rotateX(-Math.PI / 2);
    geo.translate(-8, 0, 0);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
    geo.computeVertexNormals();
    const terrainMat = this.track(new THREE.ShaderMaterial({
      vertexShader: terrainVertex,
      fragmentShader: terrainFragment,
      fog: true,
      uniforms: {
        ...THREE.UniformsLib.fog,
        uBase: { value: COLORS.parchment },
        uShade: { value: new THREE.Color("#D9D6C3") },
        uLine: { value: COLORS.green },
        uLight: { value: new THREE.Vector3(-0.5, 0.75, 0.35) },
        uStep: { value: 0.7 },
        uFade: { value: 70 },
      },
    }));
    this.scene.add(new THREE.Mesh(geo, terrainMat));

    // Parcelas: borde sobre el relieve + relleno para el puntero.
    for (const p of PARCELS) {
      const pts = p.pts.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.12, z));
      const lg = this.track(new THREE.BufferGeometry().setFromPoints(densify(pts, 6)));
      const line = new THREE.LineLoop(lg, this.lineMat(p.alert ? COLORS.cherry : COLORS.green, p.alert ? 0.75 : 0.9));
      this.parcelLines.set(p.id, line);
      this.scene.add(line);
      // Relleno drapeado sobre el relieve (malla bilineal), para que calce con el borde.
      const sg = this.track(drapedQuad(p.pts, this.opts.lowPower ? 8 : 12));
      const fill = new THREE.Mesh(sg, this.basicMat(p.alert ? COLORS.cherry : COLORS.green, p.alert ? 0.08 : 0.12, 0, 0, THREE.DoubleSide));
      fill.userData = { id: p.id, alert: p.alert };
      this.parcelMeshes.push(fill);
      this.scene.add(fill);
    }

    // ----- Origen: marcador de ubicación (cereza) + grano de café -----
    const oy = heightAt(ORIGIN.x, ORIGIN.y);
    const pin = new THREE.Mesh(this.track(new THREE.CircleGeometry(0.34, 32)), this.basicMat(COLORS.cherry, 1, 0, 0, THREE.DoubleSide));
    pin.rotation.x = -Math.PI / 2;
    pin.position.set(ORIGIN.x, oy + 0.16, ORIGIN.y);
    this.scene.add(pin);
    this.originRing = new THREE.Mesh(this.track(new THREE.RingGeometry(0.75, 0.86, 48)), this.basicMat(COLORS.cherry, 0.55, 0, 0, THREE.DoubleSide));
    this.originRing.rotation.x = -Math.PI / 2;
    this.originRing.position.set(ORIGIN.x, oy + 0.2, ORIGIN.y);
    this.scene.add(this.originRing);

    const beanGeo = this.track(createBeanGeometry(this.opts.lowPower ? 48 : 96));
    const beanMat = this.track(new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.62,
      sheen: 0.6,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color("#EEF0DC"),
    }));
    const beanMesh = new THREE.Mesh(beanGeo, beanMat);
    beanMesh.scale.setScalar(1.5);
    this.bean = new THREE.Group();
    this.bean.add(beanMesh);
    this.beanBaseY = oy + 2.3;
    this.bean.position.set(ORIGIN.x, this.beanBaseY, ORIGIN.y);
    this.scene.add(this.bean);
    // Hilo de ubicación: une el grano con su punto en el mapa.
    const tether = [new THREE.Vector3(ORIGIN.x, oy + 0.18, ORIGIN.y), new THREE.Vector3(ORIGIN.x, this.beanBaseY - 0.55, ORIGIN.y)];
    this.scene.add(new THREE.LineSegments(this.track(new THREE.BufferGeometry().setFromPoints(tether)), this.lineMat(COLORS.cherry, 0.7)));
    // Sombra de contacto suave (textura procedural de 128 px).
    const shadowTex = this.track(radialTexture("rgba(31,77,58,0.55)", "rgba(31,77,58,0)"));
    this.beanShadow = new THREE.Mesh(
      this.track(new THREE.PlaneGeometry(2.6, 3.6)),
      this.track(new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })),
    );
    this.beanShadow.rotation.x = -Math.PI / 2;
    this.beanShadow.position.set(ORIGIN.x, oy + 0.1, ORIGIN.y);
    this.scene.add(this.beanShadow);

    // ----- Evidencia: sellos hexagonales firmados, unidos a cada parcela apta -----
    const evidence = [
      new THREE.Vector3(ORIGIN.x - 3.2, oy + 5.2, ORIGIN.y - 1.5),
      new THREE.Vector3(ORIGIN.x + 0.4, oy + 6.4, ORIGIN.y - 2.4),
      new THREE.Vector3(ORIGIN.x + 3.6, oy + 5.4, ORIGIN.y - 0.8),
    ];
    const sealGeo = this.track(new THREE.CylinderGeometry(0.5, 0.5, 0.16, 6));
    sealGeo.rotateX(Math.PI / 2);
    const sealMat = this.litMat(COLORS.green, 0.16, 0.3, { roughness: 0.4 });
    const sealDotGeo = this.track(new THREE.CircleGeometry(0.15, 24));
    const sealDotMat = this.basicMat(COLORS.parchment, 1, 0.18, 0.3);
    const facing = new THREE.Vector3(-6, 18, 32);
    for (const e of evidence) {
      const seal = new THREE.Group();
      seal.add(new THREE.Mesh(sealGeo, sealMat));
      const dot = new THREE.Mesh(sealDotGeo, sealDotMat);
      dot.position.z = 0.09;
      seal.add(dot);
      seal.position.copy(e);
      seal.lookAt(facing);
      this.scene.add(seal);
    }
    const links: THREE.Vector3[] = [];
    for (const p of PARCELS.filter((x) => !x.alert)) {
      const c = centroid(p.pts);
      const from = new THREE.Vector3(c.x, heightAt(c.x, c.y) + 0.15, c.y);
      for (const e of evidence) links.push(from, e);
    }
    this.scene.add(new THREE.LineSegments(this.track(new THREE.BufferGeometry().setFromPoints(links)), this.lineMat(COLORS.green, 0.28, 0.16, 0.3)));

    // ----- Pasaporte: tarjeta con grosor que agrupa la evidencia en un registro -----
    const pTop = oy + 9.4;
    const cardZ = ORIGIN.y - 1.6;
    const depth = 0.18;
    const cardGeo = this.track(new THREE.ExtrudeGeometry(roundedRect(9.2, 3.2, 0.42), {
      depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 6,
    }));
    const card = new THREE.Mesh(cardGeo, this.litMat(new THREE.Color("#FBF8F2"), 0.36, 0.5, { roughness: 0.7 }));
    card.position.set(ORIGIN.x, pTop + 1.6, cardZ - depth);
    this.scene.add(card);
    const rimPts = roundedRect(9.2, 3.2, 0.42).getPoints(10).map((v) => new THREE.Vector3(ORIGIN.x + v.x, pTop + 1.6 + v.y, cardZ + 0.07));
    this.scene.add(new THREE.LineLoop(this.track(new THREE.BufferGeometry().setFromPoints(rimPts)), this.lineMat(COLORS.green, 0.95, 0.36, 0.5)));
    // Franja superior verde, sello y filas de datos.
    const band = new THREE.Mesh(this.track(new THREE.PlaneGeometry(8.4, 0.12)), this.basicMat(COLORS.green, 0.9, 0.4, 0.52));
    band.position.set(ORIGIN.x, pTop + 2.75, cardZ + 0.08);
    this.scene.add(band);
    const cardSeal = new THREE.Mesh(sealGeo, this.litMat(COLORS.green, 0.4, 0.52, { roughness: 0.4 }));
    cardSeal.scale.setScalar(1.5);
    cardSeal.position.set(ORIGIN.x - 3.4, pTop + 1.4, cardZ + 0.12);
    this.scene.add(cardSeal);
    const cardDot = new THREE.Mesh(sealDotGeo, this.basicMat(COLORS.cherry, 1, 0.42, 0.52));
    cardDot.scale.setScalar(1.4);
    cardDot.position.set(ORIGIN.x - 3.4, pTop + 1.4, cardZ + 0.26);
    this.scene.add(cardDot);
    const rowGeo = this.track(new THREE.PlaneGeometry(1, 0.14));
    const rowMat = this.basicMat(COLORS.green, 0.5, 0.42, 0.54);
    [[5.6, 0.7], [4.8, 1.4], [2.8, 2.1]].forEach(([w, dy]) => {
      const r = new THREE.Mesh(rowGeo, rowMat);
      r.scale.x = w;
      r.position.set(ORIGIN.x - 2.2 + w / 2, pTop + 2.4 - dy, cardZ + 0.08);
      this.scene.add(r);
    });
    const anchor = [new THREE.Vector3(ORIGIN.x, pTop, cardZ), evidence[1]];
    this.scene.add(new THREE.LineSegments(this.track(new THREE.BufferGeometry().setFromPoints(anchor)), this.lineMat(COLORS.green, 0.5, 0.36, 0.5)));

    // ----- Ruta hacia Europa (al noreste, más allá del horizonte) -----
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ORIGIN.x, pTop + 1.6, cardZ),
      new THREE.Vector3(ORIGIN.x + 8, pTop + 4, ORIGIN.y - 8),
      new THREE.Vector3(ORIGIN.x + 24, pTop + 6, ORIGIN.y - 22),
      new THREE.Vector3(ORIGIN.x + 42, pTop + 4, ORIGIN.y - 38),
      new THREE.Vector3(ORIGIN.x + 58, pTop + 1, ORIGIN.y - 52),
    ]);
    this.routeCurve = curve;
    // Trazo previo punteado: anticipa el recorrido completo antes de que avance.
    const ghostGeo = this.track(new THREE.BufferGeometry().setFromPoints(curve.getSpacedPoints(160)));
    const ghost = new THREE.Line(ghostGeo, this.fade(this.track(new THREE.LineDashedMaterial({ color: COLORS.green, dashSize: 0.7, gapSize: 0.55 })), 0.4, 0.48, 0.56));
    ghost.computeLineDistances();
    this.scene.add(ghost);
    this.routeGeo = this.track(new THREE.TubeGeometry(curve, 240, 0.15, this.opts.lowPower ? 8 : 12, false));
    this.routeIndexCount = this.routeGeo.index!.count;
    this.routeGeo.setDrawRange(0, 0);
    this.scene.add(new THREE.Mesh(this.routeGeo, this.track(new THREE.MeshStandardMaterial({ color: COLORS.green, roughness: 0.45 }))));
    // El lote viaja: un grano pequeño marca la cabeza de la ruta.
    this.courier = new THREE.Mesh(beanGeo, beanMat);
    this.courier.scale.setScalar(0.85);
    this.courier.visible = false;
    this.scene.add(this.courier);

    // ----- Hitos del pago sobre la ruta: acopio, embarque, llegada (30 · 50 · 20) -----
    const ringGeo = this.track(new THREE.TorusGeometry(0.95, 0.12, 14, 48));
    const coinGeo = this.track(new THREE.CylinderGeometry(0.66, 0.66, 0.2, 40));
    coinGeo.rotateX(Math.PI / 2);
    [0.12, 0.5, 0.96].forEach((t, i) => {
      const p = curve.getPointAt(t);
      const face = p.clone().add(new THREE.Vector3(0, 0.35, 1));
      const ring = new THREE.Mesh(ringGeo, this.litMat(COLORS.green, 0.6 + i * 0.06, 0.66 + i * 0.06, { roughness: 0.35 }));
      ring.position.copy(p);
      ring.lookAt(face);
      this.scene.add(ring);
      const coin = new THREE.Mesh(coinGeo, this.litMat(i === 0 ? COLORS.cherry : COLORS.green, 0.82 + i * 0.06, 0.86 + i * 0.06, { roughness: 0.4 }));
      coin.position.copy(p);
      coin.lookAt(face);
      this.scene.add(coin);
    });
  }

  // ---------- cámara por etapas ----------
  // Encuadres por etapa, relativos al origen O = (-16.8, ·, 8.6).
  private static KEYS = [
    { p: 0, pos: [-4, 24, 40], look: [-15, 2, 6] },
    { p: 0.24, pos: [-6, 18, 32], look: [-15, 4, 5] },
    { p: 0.48, pos: [-8, 27, 41], look: [-19, 8.6, 4] },
    { p: 0.74, pos: [-2, 54, 64], look: [-3, 8, -12] },
    { p: 1, pos: [10, 70, 74], look: [8, 8, -18] },
  ];

  private placeCamera() {
    const k = OriginScene.KEYS;
    let i = 0;
    while (i < k.length - 2 && this.progress > k[i + 1].p) i++;
    const a = k[i], b = k[i + 1];
    const t = THREE.MathUtils.smootherstep(this.progress, a.p, b.p);
    this.camera.position.set(
      THREE.MathUtils.lerp(a.pos[0], b.pos[0], t),
      THREE.MathUtils.lerp(a.pos[1], b.pos[1], t),
      THREE.MathUtils.lerp(a.pos[2], b.pos[2], t),
    );
    // Desplazar el encuadre hacia la derecha en pantallas anchas deja espacio al titular.
    const look = new THREE.Vector3(
      THREE.MathUtils.lerp(a.look[0], b.look[0], t),
      THREE.MathUtils.lerp(a.look[1], b.look[1], t),
      THREE.MathUtils.lerp(a.look[2], b.look[2], t),
    );
    // En pantallas verticales la cámara se aleja para que entre la escena completa.
    if (this.camera.aspect < 0.8) this.camera.position.sub(look).multiplyScalar(1.55).add(look);
    this.camera.lookAt(look);
  }

  // ---------- API ----------
  setProgress(p: number) {
    const v = THREE.MathUtils.clamp(p, 0, 1);
    if (Math.abs(v - this.progress) < 1e-4) return;
    this.progress = v;
    this.needsRender = true;
    this.kick();
  }

  setPointer(x: number, y: number) {
    this.pointer.set(x, y);
    this.needsRender = true;
    this.kick();
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // En pantallas anchas el titular ocupa la izquierda: corremos la vista.
    // En móvil el texto ocupa la parte baja: subimos la escena.
    const shiftX = w > 900 ? -0.26 : 0;
    const shiftY = w <= 760 ? 0.36 : 0;
    this.camera.setViewOffset(w, h, shiftX * w, shiftY * h, w, h);
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
    this.kick();
  }

  setVisible(visible: boolean) {
    if (visible) this.kick();
    else this.running = false;
  }

  private kick() {
    if (this.running) return;
    this.running = true;
    this.frame = requestAnimationFrame(this.tick);
  }

  private tick = () => {
    if (!this.running) return;
    const animated = !this.opts.reducedMotion;
    if (this.needsRender || animated) {
      this.update();
      this.renderer.render(this.scene, this.camera);
      this.needsRender = false;
    }
    // Sin movimiento reducido el pulso del origen sigue; con él, solo se dibuja ante cambios.
    if (animated) this.frame = requestAnimationFrame(this.tick);
    else this.running = false;
  };

  private update() {
    this.placeCamera();
    const p = this.progress;
    for (const f of this.fadeables) {
      f.material.opacity = f.base * THREE.MathUtils.smoothstep(p, f.from, f.to);
      f.material.visible = f.material.opacity > 0.002;
    }
    const routeT = THREE.MathUtils.smoothstep(p, 0.5, 0.78);
    this.routeGeo.setDrawRange(0, Math.floor((this.routeIndexCount * routeT) / 3) * 3);
    this.courier.visible = routeT > 0.015;
    if (this.courier.visible) {
      const at = Math.min(routeT, 0.995);
      const head = this.routeCurve.getPointAt(at);
      this.courier.position.copy(head).add(new THREE.Vector3(0, 0.55, 0));
      this.courier.lookAt(head.add(this.routeCurve.getTangentAt(at)).add(new THREE.Vector3(0, 0.55, 0)));
      this.courier.rotateZ(Math.PI); // cara con el surco hacia abajo: se ve el lomo
    }
    // Grano: postura ligada al avance (gira para mostrar surco y lomo) y crece al alejarse la cámara.
    const t = (performance.now() - this.start) / 1000;
    const idle = this.opts.reducedMotion ? 0 : 1;
    this.bean.rotation.set(
      0.5 - 0.3 * p + idle * 0.04 * Math.sin(t * 0.9),
      -0.55 + p * Math.PI * 1.15 + idle * 0.12 * Math.sin(t * 0.35),
      0.22 - 0.14 * p,
    );
    const grow = 1 + 0.9 * THREE.MathUtils.smoothstep(p, 0.5, 0.9);
    this.bean.scale.setScalar(grow);
    const bob = idle * 0.1 * Math.sin(t * 1.1);
    this.bean.position.y = this.beanBaseY + (grow - 1) * 1.1 + bob;
    this.beanShadow.scale.setScalar(grow * (1 - bob * 0.4));
    if (!this.opts.reducedMotion) {
      const s = 1 + 0.35 * Math.sin((performance.now() - this.start) / 520);
      this.originRing.scale.setScalar(s);
    }
    // Resaltado de parcelas bajo el puntero.
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.parcelMeshes, false)[0];
    const id = (hit?.object.userData.id as string | undefined) ?? null;
    if (id !== this.hovered) {
      this.hovered = id;
      for (const m of this.parcelMeshes) {
        const mat = m.material as THREE.MeshBasicMaterial;
        const alert = m.userData.alert as boolean;
        mat.opacity = m.userData.id === id ? 0.32 : alert ? 0.08 : 0.12;
      }
      this.opts.onHoverParcel?.(id, Boolean(hit?.object.userData.alert));
    }
  }

  dispose() {
    this.running = false;
    cancelAnimationFrame(this.frame);
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

function centroid(pts: [number, number][]) {
  const x = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const y = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return new THREE.Vector2(x, y);
}

/** Cuadrilátero subdividido que sigue el relieve (relleno de parcela). */
function drapedQuad(q: [number, number][], n: number) {
  const [p0, p1, p2, p3] = q;
  const verts: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const u = i / n, v = j / n;
      const ax = p0[0] + (p1[0] - p0[0]) * u, az = p0[1] + (p1[1] - p0[1]) * u;
      const bx = p3[0] + (p2[0] - p3[0]) * u, bz = p3[1] + (p2[1] - p3[1]) * u;
      const x = ax + (bx - ax) * v, z = az + (bz - az) * v;
      verts.push(x, heightAt(x, z) + 0.06, z);
      if (i < n && j < n) {
        const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(idx);
  return g;
}

/** Interpola puntos en cada lado para que el borde siga el relieve. */
function densify(pts: THREE.Vector3[], n: number) {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    for (let k = 0; k < n; k++) {
      const v = a.clone().lerp(b, k / n);
      v.y = heightAt(v.x, v.z) + 0.12;
      out.push(v);
    }
  }
  return out;
}
