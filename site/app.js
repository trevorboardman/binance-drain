import * as THREE from "three";

import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";

import { RenderPass } from "three/addons/postprocessing/RenderPass.js";

import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

import { makeState, addNode, loadData, node, isSide, isAddr, isHash, addrUrl, txUrl, chainOf, CHAINS, totalsAt, tankSteps, tankLevels, assetClass, STABLE, short, sleep, ATTACKER, B14, DELEGATE, SEEDS } from "./core.js?v=12";

import { makeTanks, DOT, COLS, BANDS, BAND_NAME, BAND_SHADE } from "./tanks.js?v=10";

const Q = new URLSearchParams(location.search);

const OG = Q.has("og");

if (OG) document.body.classList.add("og");

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const touch = matchMedia("(hover: none)").matches;

const $ = id => document.getElementById(id);

const css = n => getComputedStyle(document.documentElement).getPropertyValue("--" + n).trim();

const esc = s => String(s).replace(/[&<>"]/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
}[c]));

const usd = (v, long) => {
  if (v == null || !isFinite(v)) return "–";
  const a = Math.abs(v);
  if (a >= 1e9) return "$" + (v / 1e9).toFixed(2) + (long ? " billion" : "B");
  if (a >= 1e6) return "$" + (v / 1e6).toFixed(a >= 1e8 ? 0 : 1) + (long ? " million" : "M");
  if (a >= 1e3) return "$" + (v / 1e3).toFixed(0) + "K";
  return "$" + v.toFixed(0);
};

const amt = v => v >= 1e12 ? (v / 1e12).toFixed(2) + "T" : v >= 1e9 ? (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e4 ? (v / 1e3).toFixed(1) + "K" : v.toLocaleString("en-US", {
  maximumFractionDigits: v < 10 ? 3 : 1
});

const hms = t => new Date(t).toISOString().slice(11, 19);

const big = v => v >= 1e9 ? "$" + (v / 1e9).toFixed(1) + " billion" : v >= 1e6 ? "$" + Math.round(v / 1e6) + " million" : usd(v, true);

const valueOf = e => e.sym === "ETH" || e.sym === "WETH" ? e.amt * S.ethPrice : S.prices[e.sym] ? e.amt * S.prices[e.sym] : STABLE.has((e.sym || "").toUpperCase()) ? e.amt : e.usd;

const ago = t => {
  const s = Math.max(0, (Date.now() - t) / 1e3);
  return s < 90 ? Math.round(s) + " s" : s < 5400 ? Math.round(s / 60) + " min" : (s / 3600).toFixed(1) + " h";
};

let seedState = 1234567;

const rnd = () => {
  seedState = seedState * 1664525 + 1013904223 >>> 0;
  return seedState / 4294967296;
};

const hash01 = s => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
};

const S = makeState();

let tech = false;

const narrow = () => innerWidth < 760;

const plainOf = n => n.role === "hop" ? "Attacker wallet" + (chainOf(n.addr) === "eth" ? "" : " (" + CHAINS[chainOf(n.addr)].name + ")") : n.plain;

const nameOf = n => !n ? "" : tech ? n.label : narrow() && n.mini || plainOf(n);

const nameAt = a => {
  const n = node(S, a);
  return n ? nameOf(n) : short(a);
};

const BOTS = "venue:unverified contracts";

const START = Date.parse("2026-10-29T20:00:00Z");

const shownT = e => e.liveAt || e.t;

let evs = [];

let ph = START, live = false, playing = false, speed = 300, cursor = 0, slowUntil = 0, holdUntil = 0;

let T = null, Tdirty = true;

let view = Q.get("view") === "map" ? "map" : "totals";

let TK = null, TS = {
  steps: [],
  missing: 0
};

const liveKeys = new Set;

const sortEvents = () => {
  evs = [ ...S.events.values() ].filter(e => e.t >= START || e.liveAt).sort((a, b) => shownT(a) - shownT(b));
};

const endTime = () => Math.max(Date.now(), evs.length ? shownT(evs[evs.length - 1]) : 0);

let G = null;

const UNIT = OG ? 25e3 : innerWidth < 760 ? 6e4 : 25e3;

const MAXN = 48;

function lane(n) {
  if (n.role === "victim") return 0;
  if (n.role === "hub") return n.addr === SEEDS[6].addr ? 1.55 : n.addr === SEEDS[7].addr ? 1.45 : 1;
  if (n.role === "hop") return n.depth >= 2 ? 3 : 2;
  if (n.role === "venue" || n.role === "recovered") return 4;
  if (n.role === "inflow") return 1.6;
  return -1;
}

function buildGraph() {
  const flowOf = new Map;
  for (const e of S.events.values()) for (const a of [ e.from, e.to ]) {
    const n = node(S, a);
    if (n) flowOf.set(n.addr, (flowOf.get(n.addr) || 0) + e.usd);
  }
  const list = [ ...S.nodes.values() ].filter(n => lane(n) >= 0 && (flowOf.get(n.addr) || 0) > 0).sort((a, b) => (flowOf.get(b.addr) || 0) - (flowOf.get(a.addr) || 0)).slice(0, MAXN);
  const index = new Map(list.map((n, i) => [ n.addr, i ]));
  const vert = narrow();
  const byLane = new Map;
  list.forEach(n => {
    const l = lane(n);
    if (!byLane.has(l)) byLane.set(l, []);
    byLane.get(l).push(n);
  });
  const pos = [], kind = [];
  for (const [l, ns] of byLane) {
    const order = [];
    ns.forEach((n, i) => i % 2 ? order.push(n) : order.unshift(n));
    order.forEach((n, i) => {
      const spread = vert ? 22 : 34;
      let across = order.length > 1 ? (i / (order.length - 1) - .5) * 2 * Math.min(spread, 8 + order.length * 4.2) : 0;
      if (l === 1.55) across = -22;
      if (l === 1.45) across = 22;
      if (l === 1.6) across = 24 + i * 8;
      const along = (l - 2) * (vert ? 24 : 34);
      const z = (hash01(n.addr) - .5) * 26;
      pos[index.get(n.addr)] = vert ? new THREE.Vector3(across * 2.1, -along * 1.05, z) : new THREE.Vector3(along, -across * .95, z);
    });
  }
  list.forEach((n, i) => {
    kind[i] = n.role === "victim" ? 0 : n.role === "venue" ? n.addr === BOTS ? 3 : 2 : n.role === "inflow" ? 4 : n.role === "recovered" ? 5 : 1;
  });
  return {
    list,
    index,
    pos,
    kind,
    rad: new Array(list.length).fill(1.5),
    vert
  };
}

const MAXHOP = 5;

function buildParticles() {
  seedState = 1234567;
  const pools = new Map, resident = new Map, maxRes = new Map, made = new Map;
  const P = [];
  const bump = (i, d) => {
    const v = (resident.get(i) || 0) + d;
    resident.set(i, v);
    if (v > (maxRes.get(i) || 0)) maxRes.set(i, v);
  };
  const freezeAt = new Map;
  for (const z of S.freezes.values()) {
    const n = node(S, z.addr);
    if (!n || n.role === "venue" || !G.index.has(n.addr)) continue;
    const k = G.index.get(n.addr) + ":" + z.issuer;
    if (!freezeAt.has(k) || z.t < freezeAt.get(k)) freezeAt.set(k, z.t);
  }
  for (const e of evs) {
    if (!e.usd) continue;
    const fn = node(S, e.from), tn = node(S, e.to);
    if (!fn || !tn || fn === tn || !G.index.has(fn.addr) || !G.index.has(tn.addr)) continue;
    const a = G.index.get(fn.addr), b = G.index.get(tn.addr);
    let n = Math.floor(e.usd / UNIT);
    if (rnd() < e.usd / UNIT - n) n++;
    if (!n) continue;
    const pool = pools.get(a) || (pools.set(a, []), pools.get(a));
    const tgt = pools.get(b) || (pools.set(b, []), pools.get(b));
    const cls = {
      eth: 0,
      usd: 1,
      tok: 2
    }[assetClass(e.sym)];
    const at = shownT(e);
    for (let k = 0; k < n; k++) {
      let id = pool.pop();
      if (id === undefined || P[id].t.length >= MAXHOP) {
        id = P.length;
        P.push({
          n: [ a ],
          t: [],
          c: [ cls ],
          birth: fn.role === "victim" ? -1e12 : at - 2e4,
          sym: e.sym
        });
        bump(a, 1);
        if (fn.role === "victim") made.set(a, (made.get(a) || 0) + 1);
      }
      const p = P[id];
      p.n.push(b);
      p.t.push(at + rnd() * 45e3);
      p.c.push(cls);
      p.sym = e.sym;
      bump(a, -1);
      bump(b, 1);
      tgt.push(id);
    }
  }
  const F = new Float32Array(P.length);
  P.forEach((p, i) => {
    const last = p.n[p.n.length - 1], arrive = p.t.length ? p.t[p.t.length - 1] : -1e12;
    const iss = p.sym === "USDT" ? "Tether" : p.sym === "USDC" ? "Circle" : p.sym === "RLUSD" ? "Ripple" : null;
    const fz = iss && freezeAt.get(last + ":" + iss);
    F[i] = fz ? Math.max(fz, arrive + 6e4) - START : 1e12;
  });
  G.rad = G.list.map((_, i) => Math.max(1.1, 2.15 * Math.cbrt(Math.max(maxRes.get(i) || 0, made.get(i) || 0) * UNIT / 25e3 / 1e3)));
  return {
    P,
    F
  };
}

const canvas = $("gl");

let renderer, scene, camera, composer, renderPass, bloom, points, mat, rings = [], frames = [], edges = [];

let glOK = true;

try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: OG
  });
} catch (e) {
  glOK = false;
  console.error("[tracker] WebGL", e);
}

if (glOK) {
  const ground = (new THREE.Color).setRGB(.0012, .0015, .003, THREE.SRGBColorSpace);
  renderer.setClearColor(ground, 1);
  scene = new THREE.Scene;
  scene.fog = new THREE.FogExp2(ground, .004);
  camera = new THREE.PerspectiveCamera(38, 1, .1, 3e3);
} else {
  $("scene").insertAdjacentHTML("beforeend", '<div class="nogl">This browser could not start the 3D view. The figures, the timeline and every transfer below still update live.</div>');
}

const VERT = `\nuniform float uT; uniform float uClock; uniform float uFlight; uniform float uPx; uniform float uPulse;\nuniform vec3 uPos[${MAXN}]; uniform float uRad[${MAXN}]; uniform float uKind[${MAXN}];\nattribute vec3 aN0; attribute vec3 aN1; attribute vec3 aT0; attribute vec2 aT1; attribute vec3 aC0; attribute vec3 aC1;\nattribute vec4 aSeed; attribute float aBirth; attribute float aFreeze; attribute float aMoves;\nvarying vec3 vCol; varying float vA;\nconst vec3 VAULT = vec3(1.0, 0.66, 0.18);\nconst vec3 ETH = vec3(0.62, 0.50, 1.0);\nconst vec3 USD = vec3(0.22, 0.90, 0.54);\nconst vec3 TOK = vec3(1.0, 0.62, 0.24);\nconst vec3 ICE = vec3(0.55, 0.85, 1.0);\nconst vec3 SVC = vec3(0.42, 0.46, 0.53);\nvec3 clsCol(float c) { return c < 0.5 ? ETH : c < 1.5 ? USD : TOK; }\nfloat nodeAt(int i) { return i == 0 ? aN0.x : i == 1 ? aN0.y : i == 2 ? aN0.z : i == 3 ? aN1.x : i == 4 ? aN1.y : aN1.z; }\nfloat timeAt(int i) { return i == 0 ? aT0.x : i == 1 ? aT0.y : i == 2 ? aT0.z : i == 3 ? aT1.x : aT1.y; }\nfloat clsAt(int i) { return i == 0 ? aC0.x : i == 1 ? aC0.y : i == 2 ? aC0.z : i == 3 ? aC1.x : i == 4 ? aC1.y : aC1.z; }\nvec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z); }\nvec3 home(int n, float spin) {\n  vec3 d = normalize(aSeed.xyz * 2.0 - 1.0 + vec3(0.001));\n  float k = uKind[n];\n  if (k > 1.5 && k < 3.5) {\n    float a = aSeed.x * 6.2832 + spin * 1.6 / (0.4 + aSeed.w);\n    float rr = uRad[n] * (0.35 + 0.65 * aSeed.w);\n    return uPos[n] + vec3(cos(a) * rr, (aSeed.y - 0.5) * 0.7, sin(a) * rr);\n  }\n\n  float r = uRad[n] * (0.8 + 0.2 * aSeed.w);\n  return uPos[n] + rotY(d * r, spin * (0.6 + aSeed.y));\n}\nvoid main() {\n  int moves = int(aMoves + 0.5);\n  int m = 0;\n  for (int i = 0; i < 5; i++) { if (i < moves && timeAt(i) <= uT) m = i + 1; }\n  int cur = int(nodeAt(m) + 0.5);\n  float frozen = step(aFreeze, uT);\n  float spin = mix(uClock * 0.05, aSeed.z * 6.2832, frozen);\n  vec3 p = home(cur, spin);\n  float flying = 0.0, flyDens = 1.0;\n  vec3 col = clsCol(clsAt(m));\n  if (m > 0) {\n    float dep = timeAt(m - 1);\n    float dur = uFlight * (0.55 + 0.9 * aSeed.y);\n    float f = (uT - dep) / dur;\n    if (f < 1.0) {\n      int prv = int(nodeAt(m - 1) + 0.5);\n\n      flyDens = max(clamp(1.6 / uRad[prv], 0.05, 1.0), clamp(1.6 / uRad[cur], 0.05, 1.0));\n      vec3 a = home(prv, spin), b = p;\n      float e = f * f * (3.0 - 2.0 * f);\n      vec3 lift = vec3(0.0, 6.0 + 18.0 * aSeed.x, (aSeed.z - 0.5) * 30.0);\n      vec3 c1 = a + (b - a) * 0.3 + lift, c2 = a + (b - a) * 0.7 + lift * 0.6;\n      float u = 1.0 - e;\n      p = u * u * u * a + 3.0 * u * u * e * c1 + 3.0 * u * e * e * c2 + e * e * e * b;\n      flying = 1.0 - abs(f * 2.0 - 1.0) * 0.4;\n    }\n  }\n  float k = uKind[cur];\n  if (m == 0 && k < 0.5) col = VAULT;\n  float arrived = m > 0 ? uT - timeAt(m - 1) : 1e9;\n  float dens = clamp(1.6 / uRad[cur], 0.05, 1.0);\n  float a = 0.55 * dens;\n  if (k > 1.5 && k < 3.5 && flying == 0.0) { col = mix(col, SVC, clamp(arrived / 400000.0, 0.0, 1.0)); a = mix(a, a * 0.35, clamp(arrived / 900000.0, 0.0, 1.0)); }\n  if (frozen > 0.5) { col = ICE; a = (0.5 + 0.2 * sin(uClock * 2.0 + aSeed.x * 40.0)) * dens; }\n  if (flying > 0.0) { col = mix(col, vec3(1.0), 0.2); a = 0.9 * flyDens; }\n  a *= step(aBirth, uT);\n  vCol = col * (1.0 + uPulse * 0.35);\n  vA = a;\n  vec4 mv = modelViewMatrix * vec4(p, 1.0);\n  gl_PointSize = uPx * (1.0 + flying * 0.8) * (140.0 / -mv.z);\n  gl_Position = projectionMatrix * mv;\n}`;

const FRAG = `\nvarying vec3 vCol; varying float vA;\nvoid main() {\n  vec2 d = gl_PointCoord - 0.5;\n  float r = dot(d, d);\n  if (r > 0.25) discard;\n  float g = exp(-r * 14.0);\n\n  gl_FragColor = vec4(pow(vCol, vec3(2.2)) * g, vA * g);\n}`;

function makePoints({P, F}) {
  if (points) {
    scene.remove(points);
    points.geometry.dispose();
  }
  const N = P.length;
  const geo = new THREE.BufferGeometry;
  const f32 = n => new Float32Array(N * n);
  const pos = f32(3), N0 = f32(3), N1 = f32(3), T0 = f32(3), T1 = f32(2), C0 = f32(3), C1 = f32(3), SEED = f32(4), B = f32(1), MV = f32(1);
  const far = 1e12;
  P.forEach((p, i) => {
    for (let k = 0; k < 6; k++) {
      const v = p.n[Math.min(k, p.n.length - 1)];
      (k < 3 ? N0 : N1)[i * 3 + k % 3] = v;
    }
    for (let k = 0; k < 5; k++) {
      const v = k < p.t.length ? p.t[k] - START : far;
      if (k < 3) T0[i * 3 + k] = v; else T1[i * 2 + k - 3] = v;
    }
    for (let k = 0; k < 6; k++) {
      const v = p.c[Math.min(k, p.c.length - 1)];
      (k < 3 ? C0 : C1)[i * 3 + k % 3] = v;
    }
    for (let k = 0; k < 4; k++) SEED[i * 4 + k] = rnd();
    B[i] = p.birth < -1e11 ? -far : p.birth - START;
    MV[i] = p.t.length;
  });
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  [ [ "aN0", N0, 3 ], [ "aN1", N1, 3 ], [ "aT0", T0, 3 ], [ "aT1", T1, 2 ], [ "aC0", C0, 3 ], [ "aC1", C1, 3 ], [ "aSeed", SEED, 4 ], [ "aBirth", B, 1 ], [ "aFreeze", F, 1 ], [ "aMoves", MV, 1 ] ].forEach(([k, v, s]) => geo.setAttribute(k, new THREE.BufferAttribute(v, s)));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3, 1e4);
  if (!mat) mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uT: {
        value: 0
      },
      uClock: {
        value: 0
      },
      uFlight: {
        value: 15e4
      },
      uPx: {
        value: 2
      },
      uPulse: {
        value: 0
      },
      uPos: {
        value: Array.from({
          length: MAXN
        }, () => new THREE.Vector3)
      },
      uRad: {
        value: new Array(MAXN).fill(1)
      },
      uKind: {
        value: new Array(MAXN).fill(1)
      }
    }
  });
  G.pos.forEach((p, i) => mat.uniforms.uPos.value[i].copy(p));
  G.rad.forEach((r, i) => mat.uniforms.uRad.value[i] = r);
  G.kind.forEach((k, i) => mat.uniforms.uKind.value[i] = k);
  points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  buildFrames();
}

let dust = null;

function buildFrames() {
  frames.forEach(f => scene.remove(f));
  frames = [];
  edges.forEach(f => scene.remove(f));
  edges = [];
  G.list.forEach((n, i) => {
    const r = G.rad[i], k = G.kind[i];
    let m;
    if (k === 0) m = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r * 1.3, 1)), new THREE.LineBasicMaterial({
      color: 15970874,
      transparent: true,
      opacity: .2
    })); else if (n.role === "hub") m = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(r * 1.25, 1)), new THREE.LineBasicMaterial({
      color: 16727347,
      transparent: true,
      opacity: .18
    })); else if (k === 5) {
      m = new THREE.Mesh(new THREE.TorusGeometry(r * 1.4, .05, 6, 72), new THREE.MeshBasicMaterial({
        color: 4186255,
        transparent: true,
        opacity: .45
      }));
      m.rotation.x = Math.PI / 2;
    } else if (k === 2 || k === 3) {
      m = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, .05, 6, 72), new THREE.MeshBasicMaterial({
        color: 8094868,
        transparent: true,
        opacity: .3
      }));
      m.rotation.x = Math.PI / 2;
    } else return;
    m.position.copy(G.pos[i]);
    m.userData.spin = .05 + hash01(n.addr) * .1;
    m.userData.first = k === 0 ? -Infinity : firstSeenIdx[i];
    scene.add(m);
    frames.push(m);
  });
  const pairs = new Map;
  for (const e of evs) {
    if (!e.usd) continue;
    const fn = node(S, e.from), tn = node(S, e.to);
    if (!fn || !tn || fn === tn || !G.index.has(fn.addr) || !G.index.has(tn.addr)) continue;
    const k = fn.addr + ">" + tn.addr;
    const p = pairs.get(k) || (pairs.set(k, {
      a: G.index.get(fn.addr),
      b: G.index.get(tn.addr),
      usd: 0,
      first: shownT(e),
      victim: fn.role === "victim"
    }), pairs.get(k));
    p.usd += e.usd;
  }
  for (const p of pairs.values()) {
    const a = G.pos[p.a], b = G.pos[p.b], lift = new THREE.Vector3(0, 15, 0);
    const curve = new THREE.CubicBezierCurve3(a, a.clone().lerp(b, .3).add(lift), a.clone().lerp(b, .7).add(lift.multiplyScalar(.6)), b);
    const w = Math.min(1, Math.max(0, Math.log10(p.usd / 1e5) / 4));
    const line = new THREE.Line((new THREE.BufferGeometry).setFromPoints(curve.getPoints(48)), new THREE.LineBasicMaterial({
      color: p.victim ? 15970874 : 9082040,
      transparent: true,
      opacity: .04 + .14 * w,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    line.userData.first = p.first;
    scene.add(line);
    edges.push(line);
  }
  if (!dust) {
    const n = 2600, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = (rnd() - .5) * 520;
      a[i * 3 + 1] = (rnd() - .5) * 320;
      a[i * 3 + 2] = (rnd() - .5) * 420 - 60;
    }
    const g = new THREE.BufferGeometry;
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    dust = new THREE.Points(g, new THREE.PointsMaterial({
      color: 3885158,
      size: .9,
      sizeAttenuation: true,
      transparent: true,
      opacity: .7,
      depthWrite: false
    }));
    scene.add(dust);
  }
}

function ring(i, color, size) {
  if (!glOK || OG || reduced || !G.pos[i]) return;
  const m = new THREE.Mesh(new THREE.RingGeometry(.92, 1, 96), new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: .9,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  m.position.copy(G.pos[i]);
  m.userData = {
    born: performance.now(),
    size: size + G.rad[i] * .3
  };
  scene.add(m);
  rings.push(m);
}

const cam = {
  yaw: -.24,
  pitch: .16,
  dist: 150,
  target: new THREE.Vector3,
  drag: null,
  shake: 0
};

const NOTE_ROOM = 104;

function fitCamera() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setPixelRatio(Math.min(OG ? 1 : view === "totals" ? 3 : 1.75, devicePixelRatio || 1));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }
  if (mat) mat.uniforms.uPx.value = 2.1 * renderer.getPixelRatio();
  const sb = $("scene").getBoundingClientRect();
  const h1 = $("head").querySelector("h1").getBoundingClientRect().bottom - sb.top;
  const slot = h1 + 14;
  $("scene").style.setProperty("--slot", slot + "px");
  if (TK) fitTanks(w, h, sb, slot);
  if (!G) return;
  const box = new THREE.Box3;
  G.pos.forEach((p, i) => {
    box.expandByPoint(p.clone().addScalar(G.rad[i]));
    box.expandByPoint(p.clone().addScalar(-G.rad[i]));
  });
  const size = box.getSize(new THREE.Vector3), mid = box.getCenter(new THREE.Vector3);
  const top = OG ? h * .42 : narrow() ? slot + NOTE_ROOM : $("head").getBoundingClientRect().bottom - sb.top - 40;
  const bot = (narrow() || OG ? $("figs") : $("when")).getBoundingClientRect().top - sb.top + (narrow() && !OG ? -62 : 6);
  const band = Math.max(h * .3, bot - top), centre = (top + bot) / 2;
  camera.setViewOffset(w, h, 0, h / 2 - centre, w, h);
  const fov = camera.fov * Math.PI / 180;
  const fitH = (size.y + 6) / 2 / Math.tan(fov / 2) / (band / h), fitW = (size.x + 6) / 2 / Math.tan(fov / 2) / camera.aspect;
  cam.dist = Math.max(fitH, fitW) + size.z / 2;
  cam.target.copy(mid);
}

let bandSig = "";

function bandLabels(list) {
  const keep = (list || []).filter(b => b.y1 - b.y0 >= 2);
  const sig = keep.map(b => b.k + b.band + Math.round(b.y0) + Math.round(b.y1) + Math.round(b.v / 1e6)).join("|");
  if (sig === bandSig) return;
  bandSig = sig;
  $("bandNames").innerHTML = keep.map((b, i) => `<span data-i="${i}" style="left:${b.x.toFixed(1)}px;top:${b.y0.toFixed(1)}px;width:${b.w.toFixed(1)}px;height:${(b.y1 - b.y0).toFixed(1)}px"></span>`).join("");
  bandLabels.list = keep;
  const top = Math.min(...keep.map(b => b.y0), ...keep.map(b => b.y1));
  if (isFinite(top)) {
    $("bandKey").style.top = Math.max(0, top).toFixed(0) + "px";
    $("bandKey").style.visibility = "visible";
  }
}

function bandTip(ev) {
  const el = ev.target.closest("#bandNames span"), b = el && bandLabels.list[+el.dataset.i];
  if (!b) {
    $("tip").hidden = true;
    return;
  }
  const tip = $("tip");
  tip.innerHTML = `<b>${esc(BAND_NAME[b.band])}</b>${usd(Math.max(0, b.v))}`;
  tip.hidden = false;
  const r = $("scene").getBoundingClientRect();
  tip.style.left = Math.max(8, Math.min(r.width - tip.offsetWidth - 8, ev.clientX - r.left + 14)) + "px";
  tip.style.top = Math.max(8, Math.min(r.height - tip.offsetHeight - 8, ev.clientY - r.top + 14)) + "px";
}

$("bandNames").addEventListener("pointerover", bandTip);

$("bandNames").addEventListener("pointermove", bandTip);

$("bandNames").addEventListener("pointerleave", () => {
  $("tip").hidden = true;
});

$("bandKey").innerHTML = BANDS.map((b, i) => `<span><i style="background:rgb(${[ 243, 178, 58 ].map(c => Math.round(c * BAND_SHADE[i])).join(",")})"></i>${b === "more" ? "Other chains" : BAND_NAME[b]}</span>`).join("");

function fitTanks(w, h, sb, slot) {
  const centers = {};
  let cellW = 0;
  document.querySelectorAll("#figs .fig").forEach(f => {
    const r = f.getBoundingClientRect();
    centers[f.dataset.k] = r.left - sb.left + r.width / 2;
    cellW = r.width;
  });
  const head = $("head").getBoundingClientRect().bottom - sb.top;
  const top = OG ? head + 20 : narrow() ? slot + NOTE_ROOM : head + 28;
  const bottom = $("figs").getBoundingClientRect().top - sb.top - (narrow() ? 10 : 16);
  TK.resize({
    w,
    h,
    dpr: renderer.getPixelRatio(),
    top,
    bottom,
    centers,
    cellW
  });
  const G2 = TK.layout;
  $("ticks").innerHTML = G2.ticks.map(t => `<span style="top:${t.y.toFixed(1)}px;left:${G2.axisX.toFixed(1)}px">$${t.b % 1 ? t.b.toFixed(1) : t.b}B</span>`).join("");
}

function placeCamera(now) {
  const still = reduced || OG;
  const yaw = cam.yaw + (still ? 0 : Math.sin(now / 9e3) * .12), pitch = cam.pitch + (still ? 0 : Math.sin(now / 13e3) * .04);
  camera.position.set(cam.target.x + Math.sin(yaw) * Math.cos(pitch) * cam.dist, cam.target.y + Math.sin(pitch) * cam.dist, cam.target.z + Math.cos(yaw) * Math.cos(pitch) * cam.dist);
  camera.lookAt(cam.target);
  if (cam.shake > 0) {
    camera.position.x += (Math.random() - .5) * cam.shake;
    camera.position.y += (Math.random() - .5) * cam.shake;
    cam.shake *= .9;
    if (cam.shake < .02) cam.shake = 0;
  }
}

if (glOK && !touch) {
  canvas.addEventListener("pointerdown", e => {
    cam.drag = {
      x: e.clientX,
      y: e.clientY,
      yaw: cam.yaw,
      pitch: cam.pitch
    };
    canvas.setPointerCapture(e.pointerId);
    $("hint").style.opacity = 0;
  });
  canvas.addEventListener("pointermove", e => {
    if (!cam.drag) return;
    cam.yaw = cam.drag.yaw - (e.clientX - cam.drag.x) * .005;
    cam.pitch = Math.max(-.6, Math.min(.9, cam.drag.pitch + (e.clientY - cam.drag.y) * .004));
  });
  canvas.addEventListener("pointerup", () => {
    cam.drag = null;
  });
}

const labs = new Map;

function buildLabels() {
  $("labels").innerHTML = "";
  labs.clear();
  const rank = n => ({
    hub: 0,
    victim: 1,
    recovered: 2,
    venue: 4
  }[n.role] ?? 3);
  [ ...G.list.keys() ].sort((a, b) => rank(G.list[a]) - rank(G.list[b]) || G.rad[b] - G.rad[a]).forEach(i => {
    const n = G.list[i];
    const big = n.role === "victim" || n.role === "hub" || n.role === "recovered" || n.role === "venue" && n.addr.startsWith("venue:") || G.rad[i] > (narrow() ? 3.2 : 2.4);
    if (!big) return;
    const el = document.createElement("div");
    el.className = "lab " + n.role;
    el.style.opacity = 0;
    el.addEventListener("pointerenter", ev => showTip(n, ev));
    el.addEventListener("pointerleave", () => showTip(null));
    el.addEventListener("click", ev => {
      if (touch) {
        showTip(n, ev);
        return;
      }
      if (addrUrl(n.link)) window.open(addrUrl(n.link), "_blank", "noopener");
    });
    $("labels").appendChild(el);
    labs.set(n.addr, {
      el,
      i,
      n
    });
  });
}

const v3 = new THREE.Vector3;

function placeLabels(now) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  const text = !placeLabels.at || now - placeLabels.at > 200;
  const placed = [];
  for (const {el, i, n} of labs.values()) {
    v3.copy(G.pos[i]);
    v3.y -= G.rad[i] * 1.3 + 1.4;
    v3.project(camera);
    const x = (v3.x + 1) / 2 * w, y = (1 - v3.y) / 2 * h;
    const bw = Math.max(70, nameOf(n).length * 7) / 2, box = [ x - bw, y, x + bw, y + 30 ];
    const clear = !placed.some(b => b[0] < box[2] && box[0] < b[2] && b[1] < box[3] && box[1] < b[3]);
    const vis = clear && v3.z < 1 && (live || n.seed || firstSeenIdx[i] <= ph);
    if (vis) placed.push(box);
    el.style.opacity = vis ? 1 : 0;
    el.style.left = x + "px";
    el.style.top = y + "px";
    if (text && T) {
      const hd = T.heldBy.get(n.addr) || 0, fz = T.frozenBy.get(n.addr) || 0;
      let val = "";
      if (n.role === "victim") val = outOf.get(n.addr) ? "−" + usd(outOf.get(n.addr)) : ""; else if (n.role === "venue" || n.role === "recovered") val = inOf.get(n.addr) ? usd(inOf.get(n.addr)) + (n.role === "recovered" ? " back" : " in") : ""; else if (hd > 1e4) val = usd(hd) + (fz > 1e5 ? ` · <span class="fz">${usd(fz)} frozen</span>` : "");
      const html = `<b>${esc(nameOf(n))}</b>${val ? `<span>${val}</span>` : ""}`;
      if (el.innerHTML !== html) el.innerHTML = html;
    }
  }
  if (text) placeLabels.at = now;
}

const outOf = new Map, inOf = new Map, fired = new Set;

let firstSeenIdx = [], pulse = 0;

function applyUpTo(t, fx) {
  if (t < ph) {
    cursor = 0;
    outOf.clear();
    inOf.clear();
    fired.clear();
    fx = false;
  }
  if (TK) {
    if (!fx) TK.clear(); else TK.advance(ph, t, fx === "live" ? s => liveKeys.has(s.key) : null, performance.now());
  }
  let bursts = 0;
  while (cursor < evs.length && shownT(evs[cursor]) <= t) {
    const e = evs[cursor++];
    const fn = node(S, e.from), tn = node(S, e.to);
    if (fn && fn.role === "victim" && !(tn && tn.role === "victim")) outOf.set(fn.addr, (outOf.get(fn.addr) || 0) + e.usd);
    if (tn && (tn.role === "venue" || tn.role === "recovered") && isSide(fn)) inOf.set(tn.addr, (inOf.get(tn.addr) || 0) + e.usd);
    if (!fx || fired.has(e.key) || fx === "live" && !e.liveAt) continue;
    fired.add(e.key);
    if (e.usd >= 1e8 && bursts++ < 3) {
      if (G && tn && G.index.has(tn.addr)) ring(G.index.get(tn.addr), 16765562, 4 + Math.log10(e.usd / 1e8) * 10);
      if (G && fn && G.index.has(fn.addr)) ring(G.index.get(fn.addr), 16734794, 7);
      cam.shake = Math.min(1.6, cam.shake + .5);
      pulse = 1;
      if (TK) TK.bump(1.5 + Math.log10(e.usd / 1e8) * 2);
    }
    if (e.liveAt && e.usd >= 1e6 && isSide(fn)) toast(`${Date.now() - e.t < 9e4 ? "Just now" : ago(e.t) + " ago"}: ${usd(e.usd)} ${e.sym} from ${nameAt(e.from)} to ${nameAt(e.to)}`);
  }
  if (fx === true && G) for (const z of S.freezes.values()) if (z.t > ph && z.t <= t) {
    const n = node(S, z.addr);
    if (n && G.index.has(n.addr)) ring(G.index.get(n.addr), 9426687, 9);
  }
  ph = t;
  Tdirty = true;
}

function firstSeenFor() {
  firstSeenIdx = G.list.map(() => Infinity);
  for (const e of evs) for (const a of [ e.from, e.to ]) {
    const n = node(S, a);
    if (n && G.index.has(n.addr)) {
      const i = G.index.get(n.addr);
      if (shownT(e) < firstSeenIdx[i]) firstSeenIdx[i] = shownT(e);
    }
  }
}

const MILESTONES = [ {
  t: "20:05:00",
  kind: "attack",
  sum: "*",
  to: "xrpl:rK21t6nGLy4MNDqhvy3pGwcLFy25qgfzMx",
  title: "{v} in XRP goes first",
  plain: "Five Binance XRP wallets are emptied into one new wallet in four minutes, before anything moves on Ethereum.",
  tx: "Binance 6, 9, 10, 15 and 18 → rK21t6…qfzMx · first tx 78E3…FA6A"
}, {
  t: "20:20:59",
  kind: "attack",
  title: "Binance wallet 14 changes hands",
  plain: "Signed with the wallet's own key. Nothing has moved yet.",
  tx: "EIP-7702 delegation to 0x63e8…6fae, 50 authorizations signed by B14 for nonces 18,914,775–824 · tx 0xad99…298b"
}, {
  t: "20:24:23",
  kind: "attack",
  sum: "0x53bd38b8",
  to: "0x5227f6",
  title: "{v} leaves in one transfer",
  plain: "167,464 Ether and dozens of tokens in one go. Fee: under $1.",
  tx: "sweep 0x8a179be4 → Exploiter 2 · tx 0x53bd…e2f3"
}, {
  t: "20:26:00",
  kind: "attack",
  title: "A second Binance wallet pays out",
  plain: "28,005 Ether from Binance wallet 16 follows.",
  tx: "B16 → E2 · tx 0x51f2…d39f"
}, {
  t: "20:32:00",
  kind: "report",
  title: "Investigators spot it",
  plain: "Analysts flag it on X, eight minutes in.",
  tx: "reported time (CryptoTicker)",
  reported: true
}, {
  t: "20:39:00",
  kind: "attack",
  sum: "0x551d7961",
  to: "0x8532fa",
  title: "{v} in Ether is parked",
  plain: "195,460 Ether goes to a fresh wallet. It hasn't moved since.",
  tx: "E2 → E8 0x8532…43d4 · tx 0x551d…2c76"
}, {
  t: "20:41:23",
  kind: "attack",
  title: "780 million USDC pulled out",
  plain: "Wallet 14 owns Binance wallet 34, so that gets emptied too.",
  tx: "Hot Wallet 34 (Circle MSCA, owner B14) → E2, 780M USDC · tx 0xdc10…7481"
}, {
  t: "21:00:59",
  kind: "attack",
  title: "Borrowing against stolen dollars",
  plain: "60 million USDT goes into Aave as collateral for 19,762 Ether.",
  tx: "0x8d53…639a · Aave V3 supply 10M + 50M USDT, borrow 3,271 + 16,491 WETH"
}, {
  t: "21:15:00",
  kind: "report",
  title: "Binance's founder: it looks like a hack",
  plain: "Changpeng Zhao says so on X.",
  tx: "reported time (FinanceFeeds)",
  reported: true
}, {
  t: "21:16:00",
  kind: "report",
  title: "Binance: user funds are safe",
  plain: "Its first post says no impact is confirmed.",
  tx: "reported times (FinanceFeeds)",
  reported: true
}, {
  t: "21:44:11",
  kind: "attack",
  title: "$200 million lands in a frozen wallet",
  plain: "Another USDT sweep reaches Wallet A, frozen 43 minutes earlier. It can't move.",
  tx: "B14 → E2, 200,397,772 USDT · tx 0x55ba…0556"
}, {
  t: "21:47:23",
  kind: "attack",
  title: "Aave freezes its markets",
  plain: "No new deposits or loans in 32 assets.",
  tx: "32 ReserveFrozen events, 21:47:23–21:49:59 · PoolConfigurator"
}, {
  t: "22:39:35",
  kind: "attack",
  title: "The next sweep goes to a new wallet",
  plain: "Wallet A is frozen, so wallet 14 is emptied somewhere else.",
  tx: "B14 → 0xa97b…8d10, 128 ETH and dozens of tokens · tx 0x4a4a…6d6b"
}, {
  t: "22:55:00",
  kind: "report",
  title: "Binance stops withdrawals",
  plain: "For security checks, it says.",
  tx: "reported time (CoinDesk)",
  reported: true
}, {
  t: "23:03:47",
  kind: "attack",
  title: "Synthetix takes its tokens back",
  plain: "8.4 million SNX goes back to a Synthetix wallet.",
  tx: "E2 → 0xeb31…7769 (Synthetix protocolDAO Safe) · tx 0x0d4a…776f"
}, {
  t: "23:27:11",
  kind: "attack",
  title: "The Sandbox does the same",
  plain: "58.4 million SAND goes back.",
  tx: "E2 → 0x84a9…d87d · tx 0x0a68…06a8"
}, {
  t: "23:56:47",
  kind: "attack",
  title: "One last sweep",
  plain: "The last 2,961 Ether leaves wallet 14.",
  tx: "B14 → 0xa97b…8d10 · tx 0x4395…f89b"
}, {
  at: "2026-10-30T00:18:20Z",
  kind: "freeze",
  sum: "*",
  to: "arb:0x0000000000000000000000000000000000000da0",
  title: "{v} on Arbitrum is locked away",
  plain: "Moved out of the attacker's wallet by a transaction sent from Ethereum, the way Arbitrum's Security Council froze stolen funds in April.",
  tx: "arb 0x3e2b…32d5 → 0x…0da0, 8,426 ETH + 74.6M ARB · tx 0x410a…5f70, 0x75e8…edb6"
}, {
  at: "2026-10-30T00:10:35Z",
  kind: "attack",
  title: "Binance takes wallet 14 back",
  plain: "It removes the attacker's program, 3 h 50 min after it went on.",
  tx: "type-4 tx from B14 delegating to 0x0 · tx 0xafbf…7209"
} ];

let MS = [];

function freezeWho(n) {
  if (n.role === "hub") return n.plain;
  if (n.role === "hop") return "one of the attacker's wallets";
  if (n.role === "inflow") return "a wallet that fed the attacker's side";
  return "a contract the attacker paid";
}

function buildMilestones() {
  const fz = [];
  for (const z of [ ...S.freezes.values() ].sort((a, b) => a.t - b.t)) {
    const n = node(S, z.addr);
    if (!n || n.role === "venue") continue;
    const token = {
      Tether: "USDT",
      Circle: "USDC",
      Ripple: "RLUSD"
    }[z.issuer];
    const ev = {
      Tether: "AddedBlackList",
      Circle: "Blacklisted",
      Ripple: "AccountPaused"
    }[z.issuer];
    const prev = fz[fz.length - 1];
    if (n.role !== "victim" && prev && !prev.victim && prev.issuer === z.issuer && z.t - prev.at < 12e4) {
      prev.count++;
      prev.addrs.push(short(z.addr));
      prev.title = `${z.issuer} freezes ${prev.count} of the attacker's wallets`;
      prev.tx = `${ev}(${prev.addrs.join(", ")})`;
      continue;
    }
    const victim = n.role === "victim";
    fz.push({
      at: z.t,
      kind: "freeze",
      issuer: z.issuer,
      victim,
      count: 1,
      addrs: [ short(z.addr) ],
      title: victim ? `${z.issuer} blocks ${n.plain} itself` : `${z.issuer} freezes ${freezeWho(n)}`,
      plain: victim ? "Nothing more can be pulled through it." : `Its ${token} can't move any more.`,
      tx: `${ev}(${short(z.addr)}) · tx ${short(z.hash)}`
    });
  }
  const sumOf = m => {
    let v = 0;
    for (const e of S.events.values()) if ((m.sum === "*" || e.hash.startsWith(m.sum)) && e.to.startsWith(m.to)) v += valueOf(e);
    return v;
  };
  MS = MILESTONES.map(m => ({
    ...m,
    at: Date.parse(m.at || "2026-10-29T" + m.t + "Z"),
    title: m.sum ? m.title.replace("{v}", big(sumOf(m))) : m.title
  })).concat(fz).sort((a, b) => a.at - b.at);
  const sweep = MILESTONES.find(m => m.sum === "0x53bd38b8");
  if (sweep && $("sweepAmt")) $("sweepAmt").textContent = big(sumOf(sweep));
  MS.forEach((m, i) => m.no = i + 1);
}

let noteShown = null;

function showNote(m) {
  const el = $("note");
  if (!m) {
    el.hidden = true;
    noteShown = null;
    $("scene").classList.remove("noting");
    return;
  }
  if (m === noteShown) return;
  el.dataset.kind = m.kind;
  el.innerHTML = `<div class="n"><span>${m.no} / ${MS.length}</span><b>${hms(m.at)} UTC · ${m.reported ? "reported" : "on-chain"}</b></div><h3>${esc(m.title)}</h3><p>${esc(m.plain)}</p>${tech ? `<div class="tx">${esc(m.tx)}</div>` : ""}`;
  el.hidden = false;
  noteShown = m;
  $("scene").classList.add("noting");
}

const captionFor = t => {
  let m = null;
  for (const x of MS) if (x.at <= t) m = x;
  return m && t - m.at < 25 * 6e4 ? m : null;
};

function figsAt(t) {
  const L = tankLevels(TS.steps, t);
  let vIn = 0, vOut = 0;
  for (const s of TS.steps) {
    if (s.t > t) break;
    if (s.b === "V") vIn += s.v;
    if (s.a === "V") vOut += s.v;
  }
  return {
    ...L,
    vIn,
    vOut
  };
}

function renderFigures() {
  if (!TK) return;
  const F = figsAt(live ? Infinity : ph);
  const fig = v => {
    v = Math.max(0, v);
    return !narrow() ? usd(v) : v >= 1e9 ? "$" + (v / 1e9).toFixed(1) + "B" : v >= 1e6 ? "$" + Math.round(v / 1e6) + "M" : usd(v);
  };
  $("fB").textContent = fig(F.B);
  $("fM").textContent = fig(F.M);
  $("fF").textContent = fig(F.F);
  $("fV").textContent = fig(F.V);
  $("fR").textContent = fig(F.R);
  $("fX").textContent = fig(F.X);
  const m = F.by.M, mt = m.eth + m.usd + m.tok;
  $("dM").textContent = mt > 1e7 && m.eth / mt > .5 ? `${Math.round(m.eth / mt * 100)}% of it in coins nobody can freeze: Ether, Bitcoin, XRP, TRX, SOL.` : "Coins and tokens nobody has frozen.";
  $("dV").textContent = F.vIn > 1e6 ? `${usd(F.vIn)} went in, ${usd(F.vOut)} came back out.` : "Exchanges and lenders, net of what came back.";
  $("when").classList.toggle("rep", !live);
  $("whenTxt").textContent = live ? "now, live" : "at " + hms(ph) + " UTC in the replay";
}

function renderHeadline() {
  $("hOut").textContent = big(tankLevels(TS.steps).B);
}

const sc = $("sc"), sx = sc.getContext("2d");

const AREA = [ [ "M", "#ff3d33" ], [ "F", "#8fd6ff" ], [ "V", "#d5dbe4" ], [ "R", "#3fe08f" ], [ "X", "#8d97a6" ] ];

const NIGHT = 4.5 * 36e5;

function timeScale(w) {
  const t0 = START, span = Math.max(6e4, endTime() - t0);
  if (span <= 9 * 36e5) return {
    X: t => (t - t0) / span * w,
    inv: x => t0 + x / w * span,
    brk: null
  };
  const wN = w * .8, gap = 10, rest = span - NIGHT;
  return {
    X: t => t <= t0 + NIGHT ? (t - t0) / NIGHT * wN : wN + gap + (t - t0 - NIGHT) / rest * (w - wN - gap),
    inv: x => x <= wN ? t0 + x / wN * NIGHT : t0 + NIGHT + Math.max(0, x - wN - gap) / (w - wN - gap) * rest,
    brk: wN + gap / 2
  };
}

const AX = 13, AT = 12;

let areaCache = null;

function drawScrub() {
  const w = sc.clientWidth, h = sc.clientHeight, d = Math.min(2, devicePixelRatio || 1);
  if (!w || !TK) return;
  if (sc.width !== Math.round(w * d) || sc.height !== Math.round(h * d)) {
    sc.width = Math.round(w * d);
    sc.height = Math.round(h * d);
    areaCache = null;
  }
  sx.setTransform(d, 0, 0, d, 0, 0);
  sx.clearRect(0, 0, w, h);
  const TSC = timeScale(w), H = h - AX - AT, top = TK.finalTaken() * 1.04 || 1, Y = v => AT + H - v / top * H;
  if (!areaCache || areaCache.w !== w || areaCache.n !== TS.steps.length || areaCache.t1 < endTime() - 6e4) {
    const cols = [];
    for (let x = 0; x <= w + 1; x += 2) {
      const L = TK.levelsAt(TSC.inv(Math.min(w, x))), st = [ 0 ];
      let acc = 0;
      for (const [k] of AREA) {
        acc += Math.max(0, L[k]);
        st.push(acc);
      }
      cols.push({
        x: Math.min(w, x),
        st
      });
    }
    areaCache = {
      w,
      n: TS.steps.length,
      t1: endTime(),
      cols
    };
  }
  const band = (li, a) => {
    sx.beginPath();
    areaCache.cols.forEach((c, i) => i ? sx.lineTo(c.x, Y(c.st[li + 1])) : sx.moveTo(c.x, Y(c.st[li + 1])));
    for (let i = areaCache.cols.length - 1; i >= 0; i--) sx.lineTo(areaCache.cols[i].x, Y(areaCache.cols[i].st[li]));
    sx.closePath();
    sx.globalAlpha = a;
    sx.fill();
  };
  const cut = live ? w : TSC.X(ph);
  for (const [past, a] of [ [ false, .2 ], [ true, .82 ] ]) {
    sx.save();
    sx.beginPath();
    past ? sx.rect(0, 0, cut, h) : sx.rect(cut, 0, w - cut, h);
    sx.clip();
    AREA.forEach(([, c], li) => {
      sx.fillStyle = c;
      band(li, a);
    });
    sx.restore();
  }
  sx.globalAlpha = 1;
  sx.fillStyle = "rgba(255,255,255,.14)";
  sx.fillRect(0, AT + H, w, 1);
  sx.font = "10px " + css("mono");
  sx.fillStyle = "#8d97a6";
  sx.textAlign = "left";
  sx.textAlign = "center";
  const t1 = endTime(), hour = 36e5;
  let lastTick = -1e9;
  const tickStep = TSC.brk ? hour : t1 - START > 6 * hour ? hour : 18e5;
  for (let t = Math.ceil(START / tickStep) * tickStep; t < Math.min(t1, TSC.brk ? START + NIGHT : t1); t += tickStep) {
    const x = TSC.X(t);
    if (x > 40 && x < w - 40 && x - lastTick >= 46) {
      sx.fillText(hms(t).slice(0, 5), x, h - 1);
      lastTick = x;
    }
  }
  if (TSC.brk) {
    const bx = TSC.brk;
    sx.fillStyle = css("bg") || "#04050a";
    sx.fillRect(bx - 3, 0, 6, h - AX);
    sx.strokeStyle = "#8d97a6";
    sx.lineWidth = 1;
    for (const o of [ -3, 3 ]) {
      sx.beginPath();
      sx.moveTo(bx + o - 2, AT + H + 4);
      sx.lineTo(bx + o + 2, AT + H - 4);
      sx.stroke();
    }
    sx.fillStyle = "#8d97a6";
    sx.textAlign = "right";
    sx.fillText(new Date(t1).toISOString().slice(5, 10).replace("-", "/") + " " + hms(t1).slice(0, 5), w - 2, h - 1);
  } else {
    sx.textAlign = "right";
    sx.fillText("now", w - 2, h - 1);
  }
  for (const m of MS) {
    const x = TSC.X(m.at);
    sx.fillStyle = m.kind === "freeze" ? "#8fd6ff" : m.kind === "report" ? "#a98bff" : "#ffffff";
    sx.globalAlpha = m.at <= ph || live ? 1 : .45;
    sx.beginPath();
    sx.arc(x, 5, m === noteShown ? 3.6 : 2.2, 0, 7);
    sx.fill();
  }
  sx.globalAlpha = 1;
  if (!live) {
    sx.fillStyle = "#fff";
    sx.fillRect(cut - 1, 0, 2, AT + H);
  }
}

function scrubTime(clientX) {
  const b = $("scrub").getBoundingClientRect();
  const x = Math.max(0, Math.min(b.width, clientX - b.left));
  return {
    t: timeScale(b.width).inv(x),
    end: x > b.width - 3
  };
}

function scrubTo(clientX) {
  const {t, end} = scrubTime(clientX);
  if (end) {
    goLive();
    return;
  }
  setLive(false);
  applyUpTo(t, false);
  showNote(captionFor(ph));
}

function scrubTip(e) {
  if (!TK) return;
  const {t} = scrubTime(e.clientX), F = figsAt(t);
  const b = $("scrub").getBoundingClientRect(), TSC = timeScale(b.width), x = e.clientX - b.left;
  const pin = MS.find(m => Math.abs(TSC.X(m.at) - x) < 5);
  const row = (k, name, v) => `<span class="sw" style="background:${{
    B: "#f3b23a",
    M: "#ff3d33",
    F: "#8fd6ff",
    V: "#d5dbe4",
    R: "#3fe08f",
    X: "#8d97a6"
  }[k]}"></span>${name} ${usd(Math.max(0, v))}`;
  const tip = $("tip");
  tip.innerHTML = `<b>${hms(t).slice(0, 5)} UTC${pin ? " · " + esc(pin.title) : ""}</b>` + [ row("B", "Taken", F.B), row("M", "Still movable", F.M), row("F", "Frozen", F.F), row("V", "In swaps and loans", F.V), row("R", "Given back", F.R), row("X", "Not traced", F.X) ].join("<br>");
  tip.hidden = false;
  const s = $("scene").getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(s.width - tw - 8, e.clientX - s.left - tw / 2)) + "px";
  tip.style.top = Math.max(8, b.top - s.top - th - 10) + "px";
}

let dragging = false;

$("scrub").addEventListener("pointerdown", e => {
  dragging = true;
  $("scrub").setPointerCapture(e.pointerId);
  setPlaying(false);
  $("tip").hidden = true;
  scrubTo(e.clientX);
});

$("scrub").addEventListener("pointermove", e => {
  if (dragging) scrubTo(e.clientX); else if (!touch) scrubTip(e);
});

$("scrub").addEventListener("pointerleave", () => {
  if (!dragging) $("tip").hidden = true;
});

$("scrub").addEventListener("pointerup", () => {
  dragging = false;
});

$("scrub").addEventListener("keydown", e => {
  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
  setLive(false);
  setPlaying(false);
  applyUpTo(Math.max(START, ph + (e.key === "ArrowRight" ? 1 : -1) * 5 * 6e4), false);
  showNote(captionFor(ph));
  e.preventDefault();
});

const SIG_FIRST = 18914775, SIG_HIT = 18914809, SIG_N = 50;

function buildSig() {
  const g = $("sigGrid");
  if (!g || g.children.length) return;
  for (let i = 0; i < SIG_N; i++) {
    const n = SIG_FIRST + i, c = document.createElement("span");
    c.className = n < SIG_HIT ? "used" : n === SIG_HIT ? "hit" : "ahead";
    c.textContent = String(n % 1e3).padStart(3, "0");
    c.title = n.toLocaleString("en-US") + (n < SIG_HIT ? ": already used by Binance" : n === SIG_HIT ? ": took effect" : ": never reached");
    if (!reduced) c.style.transitionDelay = i * 28 + (n === SIG_HIT ? 250 : 0) + "ms";
    g.appendChild(c);
  }
  if (reduced || OG || !("IntersectionObserver" in window)) {
    g.classList.add("on");
    return;
  }
  const io = new IntersectionObserver(es => {
    if (es.some(e => e.isIntersecting)) {
      g.classList.add("on");
      io.disconnect();
    }
  }, {
    threshold: .5
  });
  io.observe(g);
}

function setPlaying(p) {
  playing = p;
  $("play").setAttribute("aria-label", p ? "Pause replay" : "Play replay");
  $("playIco").innerHTML = p ? '<path d="M3 1.5h3.5v13H3zM9.5 1.5H13v13H9.5z"/>' : '<path d="M3 1.5v13l11-6.5z"/>';
  $("playTxt").textContent = p ? "Pause" : "Play";
}

function setLive(l) {
  live = l;
  $("golive").setAttribute("aria-pressed", String(l));
  Tdirty = true;
  stateLine();
}

function goLive() {
  setPlaying(false);
  setLive(true);
  applyUpTo(endTime(), false);
  showNote(null);
}

$("play").addEventListener("click", () => {
  if (live || ph >= endTime() - 1e3) {
    setLive(false);
    applyUpTo(START, false);
  }
  setLive(false);
  setPlaying(!playing);
});

$("golive").addEventListener("click", goLive);

document.querySelectorAll(".speed button").forEach(b => b.addEventListener("click", () => {
  speed = Number(b.dataset.s);
  document.querySelectorAll(".speed button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
}));

function setTech(on) {
  tech = on;
  document.body.classList.toggle("techmode", on);
  $("mPlain").setAttribute("aria-pressed", String(!on));
  $("mTech").setAttribute("aria-pressed", String(on));
  if (on) $("techbox").open = true;
  if (noteShown) {
    const m = noteShown;
    noteShown = null;
    showNote(m);
  }
  placeLabels.at = 0;
  renderTables();
}

$("mPlain").addEventListener("click", () => setTech(false));

$("mTech").addEventListener("click", () => setTech(true));

let toastT = 0;

function toast(msg, ice) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.toggle("ice", !!ice);
  t.classList.add("on");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("on"), 5500);
}

function showTip(n, ev) {
  const tip = $("tip");
  if (!n) {
    tip.hidden = true;
    return;
  }
  const hd = T ? T.heldBy.get(n.addr) || 0 : 0, fz = T ? T.frozenBy.get(n.addr) || 0 : 0;
  const rows = [];
  if (n.role === "victim") rows.push(`Sent to the attacker's side: ${usd(outOf.get(n.addr) || 0)}`); else if (n.role === "venue") rows.push(`${n.members.length} contract${n.members.length === 1 ? "" : "s"}: ${esc(n.members.slice(0, 4).map(m => m.name || short(m.addr)).join(", "))}${n.members.length > 4 ? "…" : ""}`, `Received from the attacker's side: ${usd(inOf.get(n.addr) || 0)}`); else rows.push(`Holds ${live ? "now" : "at this point"}: ${usd(hd)}${fz ? ` <span class="fz">(${usd(fz)} frozen)</span>` : ""}`);
  if (live && n.role !== "venue" && n.tokens.length) rows.push(n.tokens.slice(0, 4).map(t => `${esc(t.sym)} ${amt(t.amt)}`).join(" · ") + (n.eth > .01 ? ` · ETH ${amt(n.eth)}` : ""));
  if (n.note) rows.push(`<span class="m">${esc(n.note)}</span>`);
  if (n.link) rows.push(`<span class="m">${n.role === "venue" ? "e.g. " : ""}${esc(n.link)}</span>`);
  tip.innerHTML = `<b>${esc(tech ? n.label : n.plain)}</b>${tech ? "" : `<span class="m">${esc(n.label)}</span><br>`}${rows.join("<br>")}`;
  tip.hidden = false;
  const b = $("scene").getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = Math.max(8, Math.min(b.width - tw - 8, ev.clientX - b.left + 14)) + "px";
  tip.style.top = Math.max(8, Math.min(b.height - th - 8, ev.clientY - b.top + 14)) + "px";
}

let lastNow = performance.now(), built = false;

function frame(now) {
  const dt = Math.min(.1, (now - lastNow) / 1e3);
  lastNow = now;
  if (playing && !live) {
    let step = dt * 1e3 * speed;
    const nx = evs[cursor];
    if (!nx || shownT(nx) - ph > speed * 15e3) step *= 8;
    if (now < holdUntil) step = 0; else if (now < slowUntil) step *= .15;
    const target = ph + step;
    if (target >= endTime()) goLive(); else if (step) applyUpTo(target, true);
    const m = captionFor(ph);
    if (m !== noteShown) {
      showNote(m);
      if (m) {
        slowUntil = now + 3400;
        if (m.kind !== "report") holdUntil = now + 1900;
      }
    }
  } else if (live) applyUpTo(endTime(), "live");
  if (Tdirty && (!frame.tAt || now - frame.tAt > 150)) {
    if (view === "map" && G) T = totalsAt(S, live ? null : ph, START);
    Tdirty = live;
    frame.tAt = now;
    renderFigures();
  }
  $("clock").textContent = hms(ph);
  $("clockS").textContent = (live ? "live · " : "replay · ") + new Date(ph).toISOString().slice(0, 10) + " UTC";
  if (glOK && built && view === "totals") {
    bloom.strength = narrow() ? .18 : .22;
    bloom.radius = .25;
    bloom.threshold = .6;
    const fr = TK.frame(now, live ? Infinity : ph);
    if (fr) bandLabels(fr.bands);
    renderPass.scene = TK.scene;
    renderPass.camera = TK.cam;
    composer.render();
  } else if (glOK && built && G) {
    renderPass.scene = scene;
    renderPass.camera = camera;
    bloom.strength = narrow() ? .8 : .9;
    bloom.radius = .18;
    bloom.threshold = .28;
    pulse *= .93;
    mat.uniforms.uT.value = ph - START;
    mat.uniforms.uClock.value = now / 1e3;
    mat.uniforms.uPulse.value = pulse;
    mat.uniforms.uFlight.value = live ? 4e4 : 9e4 + speed * 160;
    for (const f of frames) {
      f.rotation.y += dt * f.userData.spin;
      f.visible = live || f.userData.first <= ph;
    }
    for (const e of edges) e.visible = live || e.userData.first <= ph;
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i], k = (now - r.userData.born) / 1800;
      if (k >= 1) {
        scene.remove(r);
        r.geometry.dispose();
        r.material.dispose();
        rings.splice(i, 1);
        continue;
      }
      r.lookAt(camera.position);
      r.scale.setScalar(1 + k * r.userData.size * 3);
      r.material.opacity = (1 - k) * (1 - k) * .9;
    }
    if (dust) dust.rotation.y = now / 4e5;
    placeCamera(now);
    composer.render();
    placeLabels(now);
  }
  drawScrub();
  requestAnimationFrame(frame);
}

let ledgerFilter = "all";

const shown = new Set;

document.querySelectorAll("#lf button").forEach(b => b.addEventListener("click", () => {
  ledgerFilter = b.dataset.f;
  document.querySelectorAll("#lf button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  renderTables();
}));

const ROLE = n => n.addr === BOTS ? "unnamed contracts" : {
  victim: "Binance",
  attacker: "attacker",
  hub: "main wallet",
  hop: "hop " + n.depth,
  venue: "service",
  inflow: "outside sender",
  recovered: "recovered"
}[n.role];

const COLOR = n => !n ? "#8d97a6" : n.addr === BOTS ? "#5c6470" : {
  victim: "#f3b23a",
  attacker: "#ff3d33",
  hub: "#ff3d33",
  hop: "#ff8a5c",
  venue: "#7b8494",
  inflow: "#a8b4c8",
  recovered: "#3fe08f"
}[n.role];

function renderTables() {
  if (!$("techbox").open) return;
  const L = totalsAt(S, null, START);
  const ws = [ ...S.nodes.values() ].sort((a, b) => lane(a) - lane(b) || (L.heldBy.get(b.addr) || 0) - (L.heldBy.get(a.addr) || 0));
  $("wCount").textContent = ws.length + " entries";
  $("wRows").innerHTML = ws.map(n => `<tr><td><span class="sw" style="background:${COLOR(n)}"></span>${ROLE(n)}</td>` + `<td>${addrUrl(n.link) ? `<a href="${addrUrl(n.link)}" target="_blank" rel="noopener">${n.role === "venue" && n.addr.startsWith("venue:") ? esc(n.label) + " (" + n.members.length + ")" : esc((chainOf(n.link) === "eth" ? "" : CHAINS[chainOf(n.link)].name + " ") + n.link.slice(n.link.indexOf(":") + 1))}</a>` : ""}</td>` + `<td class="r">${n.role === "venue" ? "" : amt(n.eth)}</td><td class="r">${n.role === "venue" ? "" : usd(L.heldBy.get(n.addr) || 0)}</td>` + `<td>${n.role === "venue" ? "" : esc(n.tokens.slice(0, 3).map(t => t.sym + " " + amt(t.amt)).join(", "))}</td>` + `<td>${n.role === "venue" ? "" : [ [ "USDT", n.usdtBl ], [ "USDC", n.usdcBl ], [ "RLUSD", n.rlusdBl ] ].filter(x => x[1]).map(x => `<span class="fz">${x[0]}</span>`).join(" ") || "–"}</td>` + `<td style="white-space:normal;min-width:220px;color:var(--mute)">${esc(n.note || n.label)}</td></tr>`).join("");
  $("fRows").innerHTML = [ ...S.freezes.values() ].filter(z => isAddr(z.addr) && isHash(z.hash, chainOf(z.addr))).sort((a, b) => a.t - b.t).map(z => {
    const n = node(S, z.addr);
    return `<tr><td>${hms(z.t)}</td><td class="fz">${z.issuer}</td><td><a href="${addrUrl(z.addr)}" target="_blank" rel="noopener">${esc(z.addr)}</a></td><td>${n ? esc(n.label) : '<span style="color:var(--mute)">not on the map</span>'}</td><td><a href="${txUrl(z.hash, chainOf(z.addr))}" target="_blank" rel="noopener">${esc(z.hash.slice(0, 12))}</a></td></tr>`;
  }).join("");
  let list = [ ...S.events.values() ].filter(e => isAddr(e.from) && isAddr(e.to) && isHash(e.hash, chainOf(e.from)));
  if (ledgerFilter === "out") list = list.filter(e => isSide(node(S, e.from)));
  if (ledgerFilter === "big") list = list.filter(e => e.usd >= 1e6);
  list = list.sort((a, b) => b.t - a.t).slice(0, 500);
  $("lRows").innerHTML = list.map(e => {
    const fresh = e.liveAt && !shown.has(e.key);
    shown.add(e.key);
    const f = node(S, e.from), t = node(S, e.to);
    return `<tr class="${fresh ? "new" : ""}"><td>${hms(e.t)}</td><td style="color:${COLOR(f)}" title="${e.from}">${esc(f ? f.label : short(e.from))}</td><td style="color:${COLOR(t)}" title="${e.to}">${esc(t ? t.label : short(e.to))}</td>` + `<td class="r">${e.sym === "call" ? "sweep call" : amt(e.amt) + " " + esc(e.sym)}</td><td class="r">${e.usd ? usd(e.usd) : ""}</td>` + `<td><a href="${txUrl(e.hash, chainOf(e.from))}" target="_blank" rel="noopener">${esc(e.hash.slice(0, 12))}</a></td></tr>`;
  }).join("");
  const gen = Date.parse(S.generatedAt || "");
  $("health").textContent = (gen ? `This data was built at ${hms(gen)} UTC from block ${S.block.toLocaleString("en-US")}` + (S.failures ? `; ${S.failures} calls failed while building it.` : ".") : "The data has not loaded.") + (fetchErr ? ` The last check for newer data failed: ${fetchErr.slice(0, 80)}.` : "");
}

$("techbox").addEventListener("toggle", renderTables);

function renderWatch() {
  const w = S.watch || {};
  const b = w.b14, c = b ? String(b.code) : "";
  if (!b) {
    $("wDel").textContent = "Unavailable";
    $("wDelD").textContent = "Not read yet.";
  } else if (c.startsWith("0xef0100")) {
    const to = "0x" + c.slice(8, 48), bad = to === DELEGATE;
    $("wDel").textContent = bad ? "Still hijacked" : "Delegated elsewhere";
    $("wDel").className = "v " + (bad ? "bad" : "");
    $("wDelD").textContent = bad ? `Still runs the attacker's program. Checked ${hms(b.at)} UTC.` : `Now delegated to ${short(to)}. Checked ${hms(b.at)} UTC.`;
  } else if (c === "0x") {
    $("wDel").textContent = "Released";
    $("wDel").className = "v good";
    $("wDelD").textContent = "Binance took it back at 00:10 UTC. Checked " + hms(b.at) + " UTC.";
  } else {
    $("wDel").textContent = "Has code";
    $("wDel").className = "v";
    $("wDelD").textContent = "Unexpected code at the address: " + c.slice(0, 18) + "…";
  }
  const av = w.aave;
  if (!av) {
    $("wAave").textContent = "Unavailable";
    $("wAaveD").textContent = "Not read yet.";
  } else {
    let debt = 0, coll = 0, hf = Infinity;
    for (const p of av.list) {
      coll += p.coll;
      debt += p.debt;
      if (p.debt > 0 && p.hf != null) hf = Math.min(hf, p.hf);
    }
    const names = av.list.map(p => short(p.addr)).join(", ");
    $("wAave").textContent = debt > 0 ? usd(debt) + " borrowed" : coll > 0 ? usd(coll) + " deposited" : "None found";
    $("wAave").className = "v" + (debt > 0 && hf < 1.1 ? " bad" : "");
    $("wAaveD").textContent = debt > 0 ? `Against ${usd(coll)} of USDT. If Ether rises ${Math.max(0, (hf - 1) * 100).toFixed(1)}%, Aave can sell it. Checked ${hms(av.at)} UTC.` + (tech ? ` ${names}, health factor ${hf.toFixed(3)}.` : "") : coll > 0 ? `Deposited, nothing borrowed. Checked ${hms(av.at)} UTC.` : "No Aave loans on the map.";
  }
  let last = null;
  for (const e of S.events.values()) if (isSide(node(S, e.from)) && e.usd && (!last || e.t > last.t)) last = e;
  if (last) {
    $("wLast").textContent = ago(last.t) + " ago";
    $("wLastD").textContent = `${usd(last.usd)} ${last.sym}, ${nameAt(last.from)} to ${nameAt(last.to)}.`;
  }
  const blSet = new Set([ ...S.nodes.values() ].filter(n => n.usdtBl || n.usdcBl).map(n => n.addr));
  for (const z of S.freezes.values()) {
    const n = node(S, z.addr);
    if (n && n.role !== "venue" && chainOf(z.addr) !== "eth") blSet.add(n.addr);
  }
  const bl = blSet.size;
  $("wBl").textContent = bl;
  $("wBlD").textContent = `Out of ${[ ...S.nodes.values() ].filter(n => n.link && n.role !== "venue").length} on the map.`;
}

const REFRESH = 6e4, OLD = 45 * 6e4;

let lastFetchOk = 0, fetchErr = "";

async function fetchData() {
  try {
    const r = await fetch("data.json", {
      cache: "no-cache"
    });
    if (!r.ok) throw new Error("data.json HTTP " + r.status);
    const d = await r.json();
    lastFetchOk = Date.now();
    fetchErr = "";
    return d;
  } catch (e) {
    fetchErr = e.message || String(e);
    console.error("[tracker] data.json", e);
    return null;
  }
}

function seedText() {
  for (const s of SEEDS) {
    const n = S.nodes.get(s.addr);
    if (n) Object.assign(n, {
      seed: true,
      plain: s.plain,
      mini: s.mini,
      note: s.note
    });
  }
}

function snapLine() {
  $("snapInfo").textContent = S.generatedAt ? `Updated ${S.generatedAt.slice(11, 16)} UTC, every 10 minutes.` : "The data did not load. Trying again every minute.";
}

function stateLine() {
  const gen = Date.parse(S.generatedAt || "") || 0;
  const failing = !!fetchErr && Date.now() - lastFetchOk > 3 * REFRESH, old = !gen || Date.now() - gen > OLD;
  const stale = failing || old;
  $("state").classList.toggle("bad", stale);
  $("state").classList.toggle("replay", !live && !stale);
  $("stateTxt").textContent = failing ? "Update failed, retrying" : old ? gen ? `Updated ${ago(gen)} ago` : "No data" : !live ? "Replay" : narrow() ? "Live" : `Live · updated ${ago(gen)} ago`;
}

async function refreshLoop() {
  for (;;) {
    await sleep(REFRESH);
    const d = await fetchData();
    if (!d || d.generatedAt === S.generatedAt) {
      stateLine();
      continue;
    }
    const first = !S.generatedAt, nodesBefore = S.nodes.size;
    let add;
    try {
      add = loadData(S, d);
    } catch (e) {
      fetchErr = e.message;
      console.error("[tracker] data.json", e);
      continue;
    }
    seedText();
    if (!first) {
      const now = Date.now();
      add.events.forEach(e => {
        e.liveAt = now;
        liveKeys.add(e.key);
      });
      add.freezes.forEach(z => liveKeys.add(z.key));
    }
    if (add.events.length || S.nodes.size !== nodesBefore) rebuild();
    if (!first) for (const z of add.freezes) {
      const n = node(S, z.addr);
      if (!n) continue;
      if (G && G.index.has(n.addr)) ring(G.index.get(n.addr), 9426687, 12);
      toast(`${z.issuer} just froze ${n.role === "victim" ? n.plain : freezeWho(n)}`, true);
    }
    buildMilestones();
    renderHeadline();
    renderTables();
    renderWatch();
    snapLine();
    stateLine();
    Tdirty = true;
  }
}

function rebuild() {
  sortEvents();
  TS = tankSteps(S, START);
  TK.setSteps(TS.steps);
  areaCache = null;
  const t = ph;
  cursor = 0;
  outOf.clear();
  inOf.clear();
  ph = START - 1;
  if (glOK && built && G) {
    G = buildGraph();
    firstSeenFor();
    makePoints(buildParticles());
    buildLabels();
  }
  if (glOK && built) fitCamera();
  applyUpTo(t, live ? "live" : false);
}

function ensureMap() {
  if (G || !glOK || !built) return;
  G = buildGraph();
  firstSeenFor();
  makePoints(buildParticles());
  buildLabels();
  const t = ph;
  cursor = 0;
  outOf.clear();
  inOf.clear();
  ph = START - 1;
  applyUpTo(t, false);
}

function setView(v) {
  view = v;
  document.querySelectorAll("#views button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
  document.body.classList.toggle("v-map", v === "map");
  if (v === "map") ensureMap();
  $("unitTxt").textContent = v === "map" ? "$" + UNIT / 1e3 + ",000" : "$1 million";
  $("unitTxt2").textContent = v === "map" ? "$" + UNIT / 1e3 + "K" : "$1M";
  $("tip").hidden = true;
  if (glOK && built) fitCamera();
  Tdirty = true;
  renderFigures();
}

document.querySelectorAll("#views button").forEach(b => b.addEventListener("click", () => setView(b.dataset.v)));

async function boot() {
  const data = await fetchData();
  try {
    if (data) loadData(S, data);
  } catch (e) {
    fetchErr = e.message;
    console.error("[tracker] data.json", e);
  }
  SEEDS.forEach(s => addNode(S, {
    ...s
  }));
  seedText();
  snapLine();
  sortEvents();
  TS = tankSteps(S, START);
  TK = makeTanks({
    reduced: reduced || OG
  });
  TK.setSteps(TS.steps);
  buildMilestones();
  renderHeadline();
  if (glOK) {
    composer = new EffectComposer(renderer);
    renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    composer.addPass(new ShaderPass({
      uniforms: {
        tDiffuse: {
          value: null
        }
      },
      vertexShader: "varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform sampler2D tDiffuse; varying vec2 vUv; void main() { vec4 c = texture2D(tDiffuse, vUv); gl_FragColor = vec4(vec3(1.0) - exp(-c.rgb * 1.35), 1.0); }"
    }));
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), narrow() ? .8 : .9, .18, .28);
    composer.addPass(bloom);
    composer.addPass(new OutputPass);
    built = true;
    new ResizeObserver(() => {
      if (G && narrow() !== G.vert) rebuild(); else fitCamera();
      areaCache = null;
    }).observe(canvas);
  }
  setView(view);
  buildSig();
  const share = location.href.split(/[?#]/)[0];
  $("shareLi").href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(share);
  $("copyLink").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(share);
      $("copyLink").textContent = "Link copied";
    } catch {
      $("copyLink").textContent = share;
    }
  });
  if (touch) $("hint").hidden = true;
  if (OG || reduced || Q.has("live")) goLive(); else {
    applyUpTo(START, false);
    const io = new IntersectionObserver(es => {
      if (es.some(x => x.isIntersecting)) {
        io.disconnect();
        setTimeout(() => {
          if (!live && !playing && ph === START) setPlaying(true);
        }, 1200);
      }
    }, {
      threshold: .4
    });
    io.observe($("scene"));
  }
  requestAnimationFrame(frame);
  setInterval(stateLine, 1e3);
  stateLine();
  renderWatch();
  if (!OG) refreshLoop(); else setTimeout(() => document.body.dataset.ready = "1", 1500);
}

window.tracker = {
  S,
  totalsAt,
  figsAt,
  get TK() {
    return TK;
  },
  get TS() {
    return TS;
  },
  get view() {
    return view;
  },
  setView,
  seek(t, play) {
    setLive(false);
    applyUpTo(t, false);
    showNote(captionFor(ph));
    setPlaying(!!play);
  },
  get ph() {
    return ph;
  },
  get live() {
    return live;
  },
  get G() {
    return G;
  },
  get count() {
    return points ? points.geometry.attributes.aMoves.count : 0;
  },
  get T() {
    return T;
  },
  get gl() {
    return {
      renderer,
      scene,
      composer,
      bloom,
      dust,
      camera
    };
  }
};

boot();
