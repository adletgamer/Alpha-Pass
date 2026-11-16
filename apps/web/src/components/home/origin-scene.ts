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

// ---------- shaders del terreno: curvas de nivel estilo SIG ----------
const terrainVertex = /* glsl */ `
  varying float vH;
  varying vec2 vXZ;
  void main() {
    vH = position.y;
    vXZ = position.xz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const terrainFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uLine;
  uniform float uStep;
  uniform float uFade;
  varying float vH;
  varying vec2 vXZ;
  void main() {
    float h = vH / uStep;
    float d = abs(fract(h - 0.5) - 0.5) / fwidth(h);
    float line = 1.0 - min(d, 1.0);
    float major = 1.0 - min(abs(fract(vH / (uStep * 5.0) - 0.5) - 0.5) / fwidth(vH / (uStep * 5.0)), 1.0);
    float a = line * 0.28 + major * 0.32;
    float edge = 1.0 - smoothstep(uFade * 0.55, uFade, length(vXZ - vec2(-8.0, 0.0)));
    vec3 col = mix(uBase, uLine, a * edge);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

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
  private routeIndexCount = 0;
  private milestones: THREE.Mesh[] = [];
  private originRing!: THREE.Mesh;
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

  private lineMat(color: THREE.Color, opacity: number, from = 0, to = 0) {
    const m = this.track(new THREE.LineBasicMaterial({ color, transparent: true, opacity: from > 0 ? 0 : opacity }));
    if (from > 0) this.fadeables.push({ material: m, base: opacity, from, to });
    return m;
  }

  private basicMat(color: THREE.Color, opacity: number, from = 0, to = 0, side: THREE.Side = THREE.FrontSide) {
    const m = this.track(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: from > 0 ? 0 : opacity, side, depthWrite: false }));
    if (from > 0) this.fadeables.push({ material: m, base: opacity, from, to });
    return m;
  }

  private build() {
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
      uniforms: {
        uBase: { value: COLORS.parchment },
        uLine: { value: COLORS.green },
        uStep: { value: 0.7 },
        uFade: { value: 70 },
      },
    }));
    this.scene.add(new THREE.Mesh(geo, terrainMat));

    // Parcelas: borde sobre el relieve + relleno invisible para el puntero.
    for (const p of PARCELS) {
      const pts = p.pts.map(([x, z]) => new THREE.Vector3(x, heightAt(x, z) + 0.12, z));
      const lg = this.track(new THREE.BufferGeometry().setFromPoints(densify(pts, 6)));
      const line = new THREE.LineLoop(lg, this.lineMat(p.alert ? COLORS.cherry : COLORS.green, p.alert ? 0.75 : 0.9));
      this.parcelLines.set(p.id, line);
      this.scene.add(line);
      const shape = new THREE.Shape(p.pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const sg = this.track(new THREE.ShapeGeometry(shape));
      sg.rotateX(-Math.PI / 2);
      const avgY = pts.reduce((s, v) => s + v.y, 0) / pts.length;
      sg.translate(0, avgY + 0.05, 0);
      const fill = new THREE.Mesh(sg, this.basicMat(p.alert ? COLORS.cherry : COLORS.green, p.alert ? 0.08 : 0.12, 0, 0, THREE.DoubleSide));
      fill.userData = { id: p.id, alert: p.alert };
      this.parcelMeshes.push(fill);
      this.scene.add(fill);
    }

    // Nodo de origen (rojo cereza) y su anillo.
    const oy = heightAt(ORIGIN.x, ORIGIN.y);
    const origin = new THREE.Mesh(this.track(new THREE.SphereGeometry(0.42, 24, 16)), this.track(new THREE.MeshBasicMaterial({ color: COLORS.cherry })));
    origin.position.set(ORIGIN.x, oy + 0.45, ORIGIN.y);
    this.scene.add(origin);
    this.originRing = new THREE.Mesh(this.track(new THREE.RingGeometry(0.75, 0.86, 48)), this.basicMat(COLORS.cherry, 0.55, 0, 0, THREE.DoubleSide));
    this.originRing.rotation.x = -Math.PI / 2;
    this.originRing.position.set(ORIGIN.x, oy + 0.2, ORIGIN.y);
    this.scene.add(this.originRing);

    // Evidencia: nodos firmados por encima del origen, unidos a cada parcela apta.
    const evidence = [
      new THREE.Vector3(ORIGIN.x - 3.2, oy + 5.2, ORIGIN.y - 1.5),
      new THREE.Vector3(ORIGIN.x + 0.4, oy + 6.4, ORIGIN.y - 2.4),
      new THREE.Vector3(ORIGIN.x + 3.6, oy + 5.4, ORIGIN.y - 0.8),
    ];
    const evMat = this.basicMat(COLORS.green, 1, 0.16, 0.3);
    const nodeGeo = this.track(new THREE.OctahedronGeometry(0.34, 0));
    for (const e of evidence) {
      const n = new THREE.Mesh(nodeGeo, evMat);
      n.position.copy(e);
      this.scene.add(n);
    }
    const links: THREE.Vector3[] = [];
    for (const p of PARCELS.filter((x) => !x.alert)) {
      const c = centroid(p.pts);
      const from = new THREE.Vector3(c.x, heightAt(c.x, c.y) + 0.15, c.y);
      for (const e of evidence) links.push(from, e);
    }
    this.scene.add(new THREE.LineSegments(this.track(new THREE.BufferGeometry().setFromPoints(links)), this.lineMat(COLORS.green, 0.32, 0.16, 0.3)));

    // Pasaporte: un marco que agrupa la evidencia en un solo registro anclado.
    const pTop = oy + 9.4;
    const frame = [
      new THREE.Vector3(ORIGIN.x - 4.6, pTop, ORIGIN.y - 1.6), new THREE.Vector3(ORIGIN.x + 4.6, pTop, ORIGIN.y - 1.6),
      new THREE.Vector3(ORIGIN.x + 4.6, pTop + 3.2, ORIGIN.y - 1.6), new THREE.Vector3(ORIGIN.x - 4.6, pTop + 3.2, ORIGIN.y - 1.6),
    ];
    this.scene.add(new THREE.LineLoop(this.track(new THREE.BufferGeometry().setFromPoints(frame)), this.lineMat(COLORS.green, 0.95, 0.36, 0.5)));
    const plate = new THREE.Mesh(this.track(new THREE.PlaneGeometry(9.2, 3.2)), this.basicMat(COLORS.green, 0.1, 0.36, 0.5, THREE.DoubleSide));
    plate.position.set(ORIGIN.x, pTop + 1.6, ORIGIN.y - 1.6);
    this.scene.add(plate);
    const rows: THREE.Vector3[] = [];
    for (let i = 0; i < 3; i++) {
      const y = pTop + 0.8 + i * 0.8;
      rows.push(new THREE.Vector3(ORIGIN.x - 3.8, y, ORIGIN.y - 1.6), new THREE.Vector3(ORIGIN.x + (i === 2 ? 0.4 : 2.8), y, ORIGIN.y - 1.6));
    }
    this.scene.add(new THREE.LineSegments(this.track(new THREE.BufferGeometry().setFromPoints(rows)), this.lineMat(COLORS.green, 0.55, 0.4, 0.52)));
    const anchor = [new THREE.Vector3(ORIGIN.x, pTop, ORIGIN.y - 1.6), evidence[1]];
    this.scene.add(new THREE.LineSegments(this.track(new THREE.BufferGeometry().setFromPoints(anchor)), this.lineMat(COLORS.green, 0.5, 0.36, 0.5)));

    // Ruta hacia Europa (al noreste, más allá del horizonte).
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ORIGIN.x, pTop + 1.6, ORIGIN.y - 1.6),
      new THREE.Vector3(ORIGIN.x + 8, pTop + 4, ORIGIN.y - 8),
      new THREE.Vector3(ORIGIN.x + 24, pTop + 6, ORIGIN.y - 22),
      new THREE.Vector3(ORIGIN.x + 42, pTop + 4, ORIGIN.y - 38),
      new THREE.Vector3(ORIGIN.x + 58, pTop + 1, ORIGIN.y - 52),
    ]);
    this.routeGeo = this.track(new THREE.TubeGeometry(curve, 220, 0.11, 8, false));
    this.routeIndexCount = this.routeGeo.index!.count;
    this.routeGeo.setDrawRange(0, 0);
    this.scene.add(new THREE.Mesh(this.routeGeo, this.track(new THREE.MeshBasicMaterial({ color: COLORS.green }))));

    // Hitos del pago sobre la ruta: acopio, embarque, llegada.
    const ringGeo = this.track(new THREE.TorusGeometry(0.8, 0.09, 10, 40));
    const discGeo = this.track(new THREE.CircleGeometry(0.62, 32));
    [0.12, 0.5, 0.96].forEach((t, i) => {
      const p = curve.getPointAt(t);
      const ring = new THREE.Mesh(ringGeo, this.basicMat(COLORS.green, 1, 0.6 + i * 0.06, 0.66 + i * 0.06, THREE.DoubleSide));
      ring.position.copy(p);
      ring.lookAt(p.clone().add(new THREE.Vector3(0, 0, 1)));
      this.scene.add(ring);
      const disc = new THREE.Mesh(discGeo, this.basicMat(i === 0 ? COLORS.cherry : COLORS.green, 0.95, 0.82 + i * 0.06, 0.86 + i * 0.06, THREE.DoubleSide));
      disc.position.copy(p);
      disc.lookAt(p.clone().add(new THREE.Vector3(0, 0, 1)));
      this.milestones.push(disc);
      this.scene.add(disc);
    });
  }

  // ---------- cámara por etapas ----------
  // Encuadres por etapa, relativos al origen O = (-16.8, ·, 8.6).
  private static KEYS = [
    { p: 0, pos: [-4, 24, 40], look: [-15, 2, 6] },
    { p: 0.24, pos: [-6, 18, 32], look: [-15, 4, 5] },
    { p: 0.48, pos: [-8, 24, 36], look: [-20, 7, 4] },
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
