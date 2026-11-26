// The subject: "Small Business Street" — a miniature high street built entirely from code.
// Eight shopfronts, one for each kind of client Hafeez builds for, and his own studio at the
// end of the street. Patterns follow the starter: real dimensions in metres, one instanced
// kit per repeated part, canvas textures (every sign is drawn, nothing is downloaded),
// shader patches that read the shared uniforms, and an update(now) for anything alive.
import * as THREE from 'three';
import { Kit, place, lathe, canvasTex, rng } from './kit.js';
import { U } from './env.js';

// ---------------------------------------------------------------- layout (metres)
const ROAD_HALF = 3.5;          // road runs along Z, x in [-3.5, 3.5]
const WALK = 5.6;               // shopfront line: |x| = 5.6 (sidewalk 3.5..5.6)
const DEPTH = 6;                // shop depth behind the front line
const WIDTH = 10.5;             // shop width along Z
const Y0 = 0.05;                // top of the city slab

const SHOPS = [
  // west side (x < 0, facing +x)
  { side: -1, z: -17.55, h: 6.0, base: '#33526e', trim: '#22384c', accent: '#f4631e', name: 'RAPIDFLOW', sub: 'PLUMBING CO.' },
  { side: -1, z: -5.85,  h: 7.5, base: '#e8e0d0', trim: '#8a7a5f', accent: '#b4551f', name: 'OSTERIA LUNA', sub: 'ITALIAN KITCHEN' },
  { side: -1, z: 5.85,   h: 6.5, base: '#dfe9e8', trim: '#5f7d7c', accent: '#0e7c7b', name: 'BRIGHTSMILE', sub: 'DENTAL CLINIC' },
  { side: -1, z: 17.55,  h: 8.0, base: '#23282e', trim: '#10131a', accent: '#2fd8f2', name: 'HYDRA', sub: 'ATHLETICS CLUB' },
  // east side (x > 0, facing -x)
  { side: 1, z: -17.55,  h: 7.0, base: '#f0e7da', trim: '#97795a', accent: '#ff6b4a', name: 'WANDERPEAK', sub: 'TRAVEL CO.' },
  { side: 1, z: -5.85,   h: 8.5, base: '#0d2b1d', trim: '#071a10', accent: '#c9a24b', name: 'BARAKAH', sub: 'UMRAH & TRAVELS' },
  { side: 1, z: 5.85,    h: 9.5, base: '#e9efe9', trim: '#5c7263', accent: '#047857', name: 'INVOICEFLOW', sub: 'INVOICING · SAAS' },
  { side: 1, z: 17.55,   h: 6.5, base: '#dde3ea', trim: '#66707c', accent: '#3e6fa8', name: 'ROGER CLINIC', sub: 'FAMILY PRACTICE' },
];
const WIN_COLS = [-3.9, -1.3, 1.3, 3.9];   // window columns, metres from shop centre

// ---------------------------------------------------------------- textures
function speckle(g, w, h, n, r0, r1, colors, rand) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(rand() * colors.length) | 0];
    g.globalAlpha = 0.05 + rand() * 0.08;
    g.beginPath(); g.arc(rand() * w, rand() * h, r0 + rand() * (r1 - r0), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}
const grassMap = canvasTex(512, 512, (g, w, h) => {
  const r = rng(11);
  g.fillStyle = '#55703a'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 5000, 1, 7, ['#688549', '#4a6129', '#779350', '#425c27'], r);
}, { repeat: [60, 60] });
const paveMap = canvasTex(512, 512, (g, w, h) => {
  const r = rng(5);
  g.fillStyle = '#8f8c85'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 2600, 1, 5, ['#7e7b74', '#a09d95', '#86837c'], r);
  g.strokeStyle = 'rgba(60,58,54,.5)'; g.lineWidth = 3;
  for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(0, i * 256); g.lineTo(w, i * 256); g.stroke(); g.beginPath(); g.moveTo(i * 256, 0); g.lineTo(i * 256, h); g.stroke(); }
}, { repeat: [2, 40] });
const roadMap = canvasTex(256, 512, (g, w, h) => {
  const r = rng(9);
  g.fillStyle = '#26282c'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 3200, 0.6, 2.4, ['#2e3034', '#1f2124', '#383a3e'], r);
  g.fillStyle = '#d8c26a';
  g.fillRect(w / 2 - 4, 30, 8, 150); g.fillRect(w / 2 - 4, 332, 8, 150);   // dashed centre line
}, { repeat: [1, 6] });

// A shopfront drawn in code: storefront glass, a sign band, rows of windows above.
// Canvas y runs top-down; `ym` converts metres-from-ground to canvas pixels.
function facadeTex(shop) {
  const H = shop.h;
  return canvasTex(512, 512, (g, w, h) => {
    const ym = (m) => h - (m / H) * h;
    const xm = (m) => ((m + WIDTH / 2) / WIDTH) * w;
    g.fillStyle = shop.base; g.fillRect(0, 0, w, h);
    const r = rng(shop.z * 10 + 40);
    speckle(g, w, h, 500, 2, 9, ['#00000022', '#ffffff22'], r);
    // panel seams for scale
    g.strokeStyle = 'rgba(0,0,0,.10)'; g.lineWidth = 2;
    for (const m of [-WIDTH / 4, 0, WIDTH / 4]) { g.beginPath(); g.moveTo(xm(m), ym(H)); g.lineTo(xm(m), ym(4.1)); g.stroke(); }
    // upper windows (the glow planes sit exactly over a subset of these)
    for (const rowY of winRows(H)) {
      for (const c of WIN_COLS) {
        g.fillStyle = '#1d242e'; g.fillRect(xm(c) - 24, ym(rowY) - 31, 48, 62);
        g.fillStyle = 'rgba(160,190,220,.20)'; g.fillRect(xm(c) - 24, ym(rowY) - 31, 48, 26);
        g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.strokeRect(xm(c) - 24, ym(rowY) - 31, 48, 62);
      }
    }
    // sign band 2.9..4.15 m
    g.fillStyle = shop.accent; g.fillRect(0, ym(4.15), w, ym(2.9) - ym(4.15));
    g.fillStyle = 'rgba(255,255,255,.94)'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 54; g.font = `700 ${fs}px system-ui, sans-serif`;
    while (g.measureText(shop.name).width > w - 56 && fs > 20) { fs -= 3; g.font = `700 ${fs}px system-ui, sans-serif`; }
    g.fillText(shop.name, w / 2, ym(3.74));
    g.font = '600 18px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillText(shop.sub.split('').join('  '), w / 2, ym(3.14));
    // storefront glass 0.25..2.8 m with mullions and a door
    g.fillStyle = '#171d24'; g.fillRect(xm(-5.0), ym(2.8), xm(5.0) - xm(-5.0), ym(0.25) - ym(2.8));
    g.fillStyle = 'rgba(150,180,210,.13)'; g.fillRect(xm(-5.0), ym(2.8), xm(5.0) - xm(-5.0), 26);
    g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 4;
    for (const m of [-2.5, 0, 2.5]) { g.beginPath(); g.moveTo(xm(m), ym(2.8)); g.lineTo(xm(m), ym(0.25)); g.stroke(); }
    g.strokeStyle = shop.trim; g.lineWidth = 6; g.strokeRect(xm(0.4), ym(2.8), xm(2.4) - xm(0.4), ym(0.25) - ym(2.8));  // door
    g.fillStyle = '#d8c26a'; g.beginPath(); g.arc(xm(0.75), ym(1.35), 4, 0, Math.PI * 2); g.fill();
    // skirting
    g.fillStyle = shop.trim; g.fillRect(0, ym(0.25), w, h - ym(0.25));
  });
}
function winRows(H) {
  const rows = [H - 1.35];
  if (H >= 7.4) rows.push(H - 2.95);
  if (H >= 9.2) rows.push(H - 4.55);
  return rows;
}

// The studio at the end of the street: charcoal, gold letters, a grid of windows.
const STUDIO = { w: 17, h: 12, z: -29.5, front: -26.5 };
const studioTex = canvasTex(1024, 724, (g, w, h) => {
  const ym = (m) => h - (m / STUDIO.h) * h, xm = (m) => ((m + STUDIO.w / 2) / STUDIO.w) * w;
  g.fillStyle = '#14171c'; g.fillRect(0, 0, w, h);
  speckle(g, w, h, 700, 2, 8, ['#ffffff14', '#00000030'], rng(21));
  for (const rowY of [7.6, 5.9, 4.2]) for (const c of [-6.9, -4.15, -1.4, 1.4, 4.15, 6.9]) {
    g.fillStyle = '#1d242e'; g.fillRect(xm(c) - 30, ym(rowY) - 24, 60, 48);
    g.fillStyle = 'rgba(160,190,220,.16)'; g.fillRect(xm(c) - 30, ym(rowY) - 24, 60, 20);
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#c9a24b'; g.font = '700 92px system-ui, sans-serif';
  g.fillText('H A F E E Z', w / 2, ym(10.1));
  g.fillStyle = 'rgba(244,239,230,.75)'; g.font = '600 30px system-ui, sans-serif';
  g.fillText('W E B   S T U D I O', w / 2, ym(9.15));
  g.fillStyle = '#171d24'; g.fillRect(xm(-7.6), ym(3.3), xm(7.6) - xm(-7.6), ym(0.25) - ym(3.3));
  g.fillStyle = 'rgba(150,180,210,.12)'; g.fillRect(xm(-7.6), ym(3.3), xm(7.6) - xm(-7.6), 30);
  g.strokeStyle = '#c9a24b'; g.lineWidth = 5; g.strokeRect(xm(-1.1), ym(3.3), xm(1.1) - xm(-1.1), ym(0.25) - ym(3.3));
  g.fillStyle = '#0d2b1d'; g.fillRect(0, ym(0.25), w, h - ym(0.25));
});

// ---------------------------------------------------------------- materials
const grass = new THREE.MeshStandardMaterial({ map: grassMap, roughness: 0.95 });
const pave = new THREE.MeshStandardMaterial({ map: paveMap, roughness: 0.95 });
const road = new THREE.MeshStandardMaterial({ map: roadMap, roughness: 0.97 });
const slabMat = new THREE.MeshStandardMaterial({ color: '#6f6d68', roughness: 1 });
const trimDark = new THREE.MeshStandardMaterial({ color: '#191d22', roughness: 0.8 });
const bronze = new THREE.MeshStandardMaterial({ color: '#3b3128', metalness: 0.7, roughness: 0.45 });
const winGlow = new THREE.MeshStandardMaterial({ color: '#232a33', emissive: '#ffb45e', emissiveIntensity: 0, roughness: 0.4 });
const lampGlow = new THREE.MeshStandardMaterial({ color: '#fff3dc', emissive: '#ffcf8a', emissiveIntensity: 0 });

function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}

// ---------------------------------------------------------------- trees (starter pattern)
function trees(group, rand) {
  const trunkGeo = lathe([[0.001, 0], [0.22, 0], [0.16, 1.2], [0.12, 2.6], [0.001, 2.8]], 8);
  const leafGeo = new THREE.IcosahedronGeometry(1, 2);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#4f6e2c', roughness: 0.9, flatShading: true });
  const sway = `
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    float ph = dot(wp.xz, vec2(0.13, 0.17));
    transformed.x += sin(uTime * 1.7 + ph) * 0.06 * uWind * (position.y + 1.0);
    transformed.z += cos(uTime * 1.3 + ph * 1.3) * 0.05 * uWind * (position.y + 1.0);`;
  const patch = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uWind: U.uWind });
    sh.vertexShader = 'uniform float uTime, uWind;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + sway);
  };
  leafMat.onBeforeCompile = patch;
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  leafDepth.onBeforeCompile = patch;
  const kit = new Kit()
    .def('trunk', trunkGeo, new THREE.MeshStandardMaterial({ color: '#4a3a2c', roughness: 0.95 }))
    .def('leaves', leafGeo, leafMat, { depth: leafDepth });
  const greens = ['#4f6e2c', '#5d7a33', '#46632a', '#6a8540'].map((c) => new THREE.Color(c));
  const spots = [];
  for (const sx of [-4.95, 4.95]) for (let z = -21; z <= 21; z += 7) spots.push([sx, z + (rand() - 0.5) * 1.6]);
  for (const [x, z] of [[-8, 26.5], [8, 26.5], [-13, 24], [13, 24], [-16, -2], [16, -2], [-14, 12], [14, 12]]) spots.push([x, z]);
  for (const [x, z] of spots) {
    const s = 0.5 + rand() * 0.25, rot = rand() * 6.28;
    kit.add('trunk', place(x, 0.14, z, rot, s, s, s));
    for (let k = 0; k < 5; k++) {
      const ox = (rand() - 0.5) * 2.2 * s, oz = (rand() - 0.5) * 2.2 * s, oy = 0.14 + (2.6 + rand() * 1.8) * s, ls = (1.1 + rand() * 0.9) * s;
      kit.add('leaves', place(x + ox, oy, z + oz, rand() * 6.28, ls, ls * 0.85, ls), greens[(rand() * 4) | 0]);
    }
  }
  kit.build(group);
}

// ---------------------------------------------------------------- the build
export function buildScene() {
  const group = new THREE.Group();
  const rand = rng(2026);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), grass);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);

  box(30, 0.1, 78, slabMat, 0, 0, 0, group).castShadow = false;                    // city slab
  const roadM = new THREE.Mesh(new THREE.BoxGeometry(ROAD_HALF * 2, 0.04, 72), road);
  roadM.position.set(0, 0.07, 0); roadM.receiveShadow = true; group.add(roadM);
  for (const sx of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.14, 72), pave);
    walk.position.set(sx * 4.55, 0.07, 0); walk.receiveShadow = true; walk.castShadow = false; group.add(walk);
  }

  // window-glow kit: one draw call for every lit window on the street
  const glowKit = new Kit()
    .def('win', new THREE.PlaneGeometry(1.0, 1.3), winGlow, { cast: false, receive: false })
    .def('pane', new THREE.PlaneGeometry(2.1, 2.3), winGlow, { cast: false, receive: false });

  for (const shop of SHOPS) {
    const s = shop.side;                                   // -1 west, +1 east
    const frontX = s * WALK;
    const cx = s * (WALK + DEPTH / 2);
    const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(shop.base).multiplyScalar(0.94), roughness: 0.9 });
    box(DEPTH, shop.h, WIDTH, bodyMat, cx, Y0 + shop.h / 2, shop.z, group);
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, shop.h),
      new THREE.MeshStandardMaterial({ map: facadeTex(shop), roughness: 0.85 }));
    facade.position.set(frontX - s * 0.01, Y0 + shop.h / 2, shop.z);
    facade.rotation.y = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    facade.receiveShadow = true; group.add(facade);
    box(DEPTH + 0.5, 0.35, WIDTH + 0.5, trimDark, cx, Y0 + shop.h + 0.17, shop.z, group);   // roof cap
    const awn = box(1.7, 0.07, 8.6, new THREE.MeshStandardMaterial({ color: shop.accent, roughness: 0.7 }),
      frontX - s * 0.85, Y0 + 3.55, shop.z, group);
    awn.rotation.z = s * 0.30;
    // glow windows over a random subset of the drawn ones, plus two storefront panes
    const gx = frontX - s * 0.03, ga = s < 0 ? Math.PI / 2 : -Math.PI / 2;
    for (const rowY of winRows(shop.h)) for (const c of WIN_COLS)
      if (rand() > 0.35) glowKit.add('win', place(gx, Y0 + rowY, shop.z + c, ga));
    for (const c of [-2.6, 2.6]) if (rand() > 0.25) glowKit.add('pane', place(gx, Y0 + 1.5, shop.z + c, ga));
  }

  // the studio, closing the north end of the street
  box(STUDIO.w, STUDIO.h, DEPTH, new THREE.MeshStandardMaterial({ color: '#101216', roughness: 0.9 }), 0, Y0 + STUDIO.h / 2, STUDIO.z, group);
  const sFace = new THREE.Mesh(new THREE.PlaneGeometry(STUDIO.w, STUDIO.h),
    new THREE.MeshStandardMaterial({ map: studioTex, roughness: 0.85 }));
  sFace.position.set(0, Y0 + STUDIO.h / 2, STUDIO.front + 0.01); sFace.receiveShadow = true; group.add(sFace);
  box(STUDIO.w + 0.5, 0.4, DEPTH + 0.5, trimDark, 0, Y0 + STUDIO.h + 0.2, STUDIO.z, group);
  for (const rowY of [7.6, 5.9, 4.2]) for (const c of [-6.9, -4.15, -1.4, 1.4, 4.15, 6.9])
    if (rand() > 0.3) glowKit.add('win', place(c, Y0 + rowY, STUDIO.front + 0.03, 0, 1.25, 0.8, 1));
  glowKit.build(group);

  // lamps down both sidewalks; two real lights do the night work
  const postGeo = lathe([[0.001, 0], [0.16, 0], [0.16, 0.1], [0.07, 0.25], [0.05, 2.9], [0.09, 3.0], [0.001, 3.0]], 12);
  const lamps = new Kit().def('post', postGeo, bronze).def('globe', new THREE.SphereGeometry(0.2, 20, 12), lampGlow, { cast: false });
  const lights = [];
  for (const sx of [-4.7, 4.7]) for (const z of [-24, -12, 0, 12, 24]) {
    lamps.add('post', place(sx, 0.14, z));
    lamps.add('globe', place(sx, 3.32, z));
  }
  lamps.build(group);
  for (const [x, z, c] of [[-4.7, -12, 40], [4.7, 12, 40], [0, -23.5, 55]]) {
    const l = new THREE.PointLight('#ffc98a', 0, 20, 2);
    l.position.set(x, 3.2, z); l.userData.candela = c; group.add(l); lights.push(l);
  }

  // benches and planters on the sidewalks
  const benchMat = new THREE.MeshStandardMaterial({ color: '#5a4632', roughness: 0.9 });
  const leafPlain = new THREE.MeshStandardMaterial({ color: '#527539', roughness: 0.95, flatShading: true });
  for (const [x, z, a] of [[-4.6, -8, Math.PI / 2], [4.6, 3, -Math.PI / 2], [-4.6, 14, Math.PI / 2], [4.6, -19, -Math.PI / 2]]) {
    const b = new THREE.Group();
    box(1.9, 0.09, 0.55, benchMat, 0, 0.45, 0, b);
    box(1.9, 0.5, 0.08, benchMat, 0, 0.78, -0.26, b);
    box(0.09, 0.45, 0.5, trimDark, -0.8, 0.22, 0, b);
    box(0.09, 0.45, 0.5, trimDark, 0.8, 0.22, 0, b);
    b.position.set(x, 0.14, z); b.rotation.y = a; group.add(b);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.55, 14), trimDark);
    pot.position.set(x, 0.41, z + 1.6); pot.castShadow = pot.receiveShadow = true; group.add(pot);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), leafPlain);
    bush.position.set(x, 1.05, z + 1.6); bush.scale.y = 0.85; bush.castShadow = true; group.add(bush);
  }

  trees(group, rand);

  return {
    group,
    center: new THREE.Vector3(0, 3.5, 0),
    update(now) {
      const night = U.uNight.value;
      winGlow.emissiveIntensity = night * 2.4;         // shop windows and storefronts light up
      lampGlow.emissiveIntensity = night * 3.5;        // bloom picks the globes up at night
      for (const l of lights) { l.intensity = night * l.userData.candela; l.visible = night > 0.01; }
    },
  };
}
