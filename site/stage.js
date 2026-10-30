import * as THREE from "three";

import { makeLiquid } from "./liquid.js?v=2";

import { stageLevels } from "./stage-data.js?v=1";

export const DOT = 1e6;

export const COLS = [ "B", "M", "F", "V", "R", "X" ];

const KEYS = COLS;

export const BANDS = [ "eth", "btc", "tron", "xrpl", "sol", "more" ];

export const BAND_NAME = {
  eth: "Ethereum",
  btc: "Bitcoin",
  tron: "Tron",
  xrpl: "XRP Ledger",
  sol: "Solana",
  more: "Arbitrum, Avalanche, Optimism, Base"
};

export const BAND_SHADE = [ 1, 1, 1, 1, 1, 1 ];

const BI = Object.fromEntries(BANDS.map((b, i) => [ b, i ])), NB = BANDS.length;

const bandOf = key => {
  const i = typeof key === "string" ? key.indexOf(":") : -1, c = i > 0 ? key.slice(0, i) : "";
  return BI[c] != null ? BI[c] : /^(arb|op|base|avax|bsc)$/.test(c) ? BI.more : BI.eth;
};

export const DROP = 1e6;

const BORE = .24, PIPE_R = .27, BEND = .3, RP = .03;

const PACE_LO = 700, PACE_HI = 1800;

const BIN_HEX = 10178047, KIND_HEX = [ 4174591, 3135114, 16726832 ];

export const KIND_NAME = [ "Frozen", "Dollar tokens", "Coins" ];

const PCOL = [ BIN_HEX, KIND_HEX[2], KIND_HEX[1], KIND_HEX[0] ], COL_OF = [ 3, 2, 1 ];

const ROW_NAME = [ "Binance’s wallets", "The attacker", "Wallets it was split into", "Where it went" ];

const INK_VERT = `\nvarying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const INK_FRAG = `\nuniform sampler2D tInk;\nuniform vec2 uTx;\nuniform float uT;\nvarying vec2 vUv;\nvoid main() {\n  vec4 c = texture2D(tInk, vUv);\n  float a = c.a, fw = max(fwidth(a) * 0.8, 0.02), edge = smoothstep(uT - fw, uT + fw, a);\n  if (edge < 0.01) discard;\n  float hL = texture2D(tInk, vUv - vec2(uTx.x * 1.5, 0.0)).a, hR = texture2D(tInk, vUv + vec2(uTx.x * 1.5, 0.0)).a;\n  float hB = texture2D(tInk, vUv - vec2(0.0, uTx.y * 1.5)).a, hT = texture2D(tInk, vUv + vec2(0.0, uTx.y * 1.5)).a;\n  float thick = smoothstep(uT, uT + 1.3, a);\n  vec3 n = normalize(vec3(-(hR - hL) * 1.4, -(hT - hB) * 1.4, 0.25 + thick * 0.75));\n  vec3 col = c.rgb / max(a, 1e-4), V = vec3(0.0, 0.0, 1.0), Ld = normalize(vec3(-0.4, 0.65, 0.65));\n  vec3 base = mix(col * 1.05, col * 0.5, thick);\n  float diff = 0.6 + 0.4 * max(dot(n, Ld), 0.0);\n  vec3 R = reflect(-V, n);\n  float spec = pow(max(dot(R, Ld), 0.0), 70.0) * 1.4;\n  float boxes = smoothstep(0.62, 0.95, R.y) * 0.5 + smoothstep(0.86, 0.985, abs(R.x)) * (R.x < 0.0 ? 0.9 : 0.5);\n  float fres = pow(1.0 - max(n.z, 0.0), 2.0);\n  vec3 o = base * diff + vec3(1.0, 0.97, 0.92) * spec + vec3(0.85, 0.9, 1.0) * boxes * 0.18 + col * fres * 0.15;\n  gl_FragColor = vec4(o, edge * 0.97);\n}`;

const LIQ_VERT = `\nuniform float uTime, uAmp, uWave, uH, uMax, uProfS;\nuniform float uProf[16];\nuniform vec2 uSlope;\nvarying vec3 vW, vN, vL;\nfloat prof(float x) {\n  float f = clamp((x * 0.5 + 0.5) * 16.0 - 0.5, 0.0, 15.0);\n  int i = int(floor(f));\n  return mix(uProf[i], uProf[min(i + 1, 15)], f - float(i)) * uProfS;\n}\nvoid main() {\n  vec3 p = position;\n  float lvl = clamp(uH + dot(uSlope, p.xz) + prof(p.x), 0.0, uMax);\n  if (uWave < 0.5) p.y = position.y * lvl;\n  else {\n    float rr = length(p.xz);\n    p.y = lvl + uAmp * (sin(rr * 11.0 - uTime * 5.0) * 0.55 + sin(p.x * 4.0 + uTime * 1.7) * 0.25 + sin(p.z * 5.0 - uTime * 2.1) * 0.2) * smoothstep(1.0, 0.6, rr) * 0.05;\n  }\n  vL = p;\n  vec4 w = modelMatrix * vec4(p, 1.0);\n  vW = w.xyz;\n  vN = normalize(mat3(modelMatrix) * normal);\n  gl_Position = projectionMatrix * viewMatrix * w;\n}`;

const LIQ_FRAG = `\nuniform vec3 uCol, uC0, uC1, uC2;\nuniform float uTime, uBase, uTop, uWave, uRefl, uFade, uGlow, uInkOn, uL1, uL2, uFloor, uIceTop;\nuniform sampler2D tInk;\nuniform vec4 uInkRect;\nuniform vec2 uInkTx;\nvarying vec3 vW, vN, vL;\nvoid main() {\n  vec3 W = vW;\n  if (uRefl > 0.5) W.y = 2.0 * uFloor - W.y;\n  vec3 V = normalize(cameraPosition - vW);\n  vec3 N = uWave > 0.5 ? normalize(cross(dFdx(vW), dFdy(vW))) : normalize(vN);\n  if (dot(N, V) < 0.0) N = -N;\n  float ndv = max(dot(N, V), 0.0), fres = pow(1.0 - ndv, 3.0);\n  float h = clamp((W.y - uBase) / max(uTop - uBase, 1e-3), 0.0, 1.0);\n  float y = uWave > 0.5 ? 1e6 : vL.y, bw = (uTop - uBase) * 0.012;\n  float isIce = uWave > 0.5 ? uIceTop : 1.0 - smoothstep(uL1 - bw, uL1 + bw, y);\n  vec3 lc = mix(uC0, mix(uC1, uC2, smoothstep(uL2 - bw, uL2 + bw, y)), smoothstep(uL1 - bw, uL1 + bw, y));\n  if (uWave > 0.5) lc = uCol;\n  vec3 c = mix(lc * 0.2, lc * 0.72, pow(h, 1.25));\n  float sw = sin(W.y * 5.0 + uTime * 0.55 + sin(W.x * 2.6 + uTime * 0.35) * 1.6) * 0.5 + 0.5;\n  c *= 0.82 + 0.36 * mix(sw, 0.5, isIce);\n  if (uInkOn > 0.5 && uRefl < 0.5 && isIce < 0.5) {\n    vec2 iu = (vW.xy - uInkRect.xy) / (uInkRect.zw - uInkRect.xy);\n    vec4 d = texture2D(tInk, iu);\n    float ia = 1.0 - exp(-d.a * 2.2);\n    if (ia > 0.003) {\n      float gx = texture2D(tInk, iu + vec2(uInkTx.x, 0.0)).a - texture2D(tInk, iu - vec2(uInkTx.x, 0.0)).a;\n      float gy = texture2D(tInk, iu + vec2(0.0, uInkTx.y)).a - texture2D(tInk, iu - vec2(0.0, uInkTx.y)).a;\n      vec3 ic = d.rgb / max(d.a, 1e-4);\n      float lit = 0.75 + 0.6 * clamp(-gx * 3.0 + gy * 3.0, -0.6, 0.8);\n      float other = clamp(length(ic - lc) * 1.8, 0.0, 1.0);\n      c = mix(c, mix(ic * 0.25, ic * 0.8, pow(h, 1.1)) * lit * (0.85 + 0.3 * sw), ia * 0.7 * other);\n    }\n  }\n\n  if (isIce > 0.01) {\n    float cr = abs(sin(W.x * 31.0 + sin(W.y * 17.0) * 2.2)) * abs(sin(W.y * 27.0 - W.x * 9.0 + sin(W.x * 13.0)));\n    vec3 ice = mix(lc * 0.45, vec3(0.78, 0.9, 1.0), 0.32 + 0.25 * h) + vec3(0.7, 0.85, 1.0) * pow(1.0 - cr, 18.0) * 0.45;\n    c = mix(c, ice, isIce);\n  }\n  vec3 R = reflect(-V, N);\n  float boxes = smoothstep(0.62, 0.95, R.y) * 0.35 + smoothstep(0.86, 0.985, abs(R.x)) * (R.x < 0.0 ? 0.75 : 0.45);\n  c += vec3(0.85, 0.9, 1.0) * boxes * (0.35 + 0.25 * isIce);\n  c += lc * fres * (0.7 + 0.5 * uGlow);\n  if (uWave > 0.5) {\n    float rr = length(vL.xz);\n    c = mix(c, lc * 1.05, 0.55 * (1.0 - uIceTop * 0.5));\n    c += mix(lc, vec3(1.0), 0.35) * smoothstep(0.82, 0.99, rr) * (0.9 + uGlow);\n  }\n  float a = 1.0;\n  if (uRefl > 0.5) a = 0.11 * exp((vW.y - uFloor) / uFade);\n  gl_FragColor = vec4(c, a);\n}`;

const PIPE_VERT = `\nvarying vec3 vW, vN;\nvoid main() {\n  vec4 w = modelMatrix * vec4(position, 1.0);\n  vW = w.xyz;\n  vN = normalize(mat3(modelMatrix) * normal);\n  gl_Position = projectionMatrix * viewMatrix * w;\n}`;

const PIPE_FRAG = `\nvarying vec3 vW, vN;\nvoid main() {\n  vec3 V = normalize(cameraPosition - vW), N = normalize(vN);\n  float ndv = abs(dot(N, V)), fres = pow(1.0 - ndv, 2.2);\n  float hi = pow(max(N.y, 0.0), 10.0) * 0.55 + smoothstep(0.86, 0.98, abs(reflect(-V, N).x)) * 0.25;\n  vec3 glass = vec3(0.55, 0.62, 0.75) * fres * 0.55 + vec3(0.9, 0.94, 1.0) * hi;\n  gl_FragColor = vec4(glass, clamp(0.06 + fres * 0.6 + hi, 0.0, 1.0));\n}`;

const SHELF_VERT = `\nvarying vec3 vW;\nvoid main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const SHELF_FRAG = `\nuniform vec3 uLift;\nuniform vec4 uStage;\nvarying vec3 vW;\nvoid main() {\n  float d = exp(-pow((vW.x - uStage.x) / uStage.z, 6.0) - pow((vW.z - uStage.y) / uStage.w, 2.0));\n  gl_FragColor = vec4(uLift * d, 1.0);\n}`;

function studio(renderer) {
  const s = new THREE.Scene;
  s.background = new THREE.Color(.004, .005, .008);
  const box = (w, h, p, look, k, c = [ 1, 1, 1 ]) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      color: new THREE.Color(c[0] * k, c[1] * k, c[2] * k),
      side: THREE.DoubleSide
    }));
    m.position.set(...p);
    m.lookAt(...look);
    s.add(m);
  };
  box(26, 9, [ 0, 18, 2 ], [ 0, 0, 0 ], 2.2);
  box(3.2, 18, [ -15, 7, 7 ], [ 0, 4, 0 ], 5);
  box(2.4, 18, [ 15, 7, 5 ], [ 0, 4, 0 ], 3, [ .85, .92, 1 ]);
  box(40, 2.2, [ 0, 13, -14 ], [ 0, 4, 0 ], 1, [ .6, .75, 1 ]);
  const pm = new THREE.PMREMGenerator(renderer);
  const t = pm.fromScene(s, .02).texture;
  pm.dispose();
  return t;
}

function glassGeo(r, h, t, b) {
  const pts = [ new THREE.Vector2(0, 0) ];
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + i / 6 * Math.PI / 2;
    pts.push(new THREE.Vector2(r - t * 2 + Math.cos(a) * t * 2, t * 2 + Math.sin(a) * t * 2));
  }
  pts.push(new THREE.Vector2(r, h - t));
  for (let i = 0; i <= 8; i++) {
    const a = i / 8 * Math.PI;
    pts.push(new THREE.Vector2(r - t / 2 + Math.cos(a) * t / 2, h - t + Math.sin(a) * t / 2));
  }
  pts.push(new THREE.Vector2(r - t, b + t));
  pts.push(new THREE.Vector2(r - t * 2, b));
  pts.push(new THREE.Vector2(0, b));
  return new THREE.LatheGeometry(pts, 96);
}

const shortName = n => n.replace(/^Wallet (0x[0-9a-f]{4}).*$/i, "$1");

export function makeTanks({reduced, renderer}) {
  const scene = new THREE.Scene;
  const cam = new THREE.PerspectiveCamera(20, 1, .1, 400);
  const CAM_D = 40;
  cam.position.set(0, 0, CAM_D);
  if (renderer) scene.environment = studio(renderer);
  const labelsEl = document.getElementById("vlabels");
  const radial = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d"), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(.4, "rgba(255,255,255,.4)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 16777215,
    metalness: 0,
    roughness: .03,
    transmission: 1,
    thickness: .3,
    ior: 1.5,
    specularIntensity: 1,
    envMapIntensity: 1.4,
    attenuationColor: new THREE.Color(15002879),
    attenuationDistance: 8,
    depthWrite: false
  });
  const clock = {
    value: 0
  };
  const inkShared = {
    uInkOn: {
      value: 0
    },
    tInk: {
      value: null
    },
    uInkRect: {
      value: new THREE.Vector4(0, 0, 1, 1)
    },
    uInkTx: {
      value: new THREE.Vector2
    }
  };
  const profS = {
    value: 1
  };
  const bodyGeo = new THREE.CylinderGeometry(1, 1, 1, 64, 1, true).translate(0, .5, 0);
  const surfGeo = new THREE.RingGeometry(1e-4, 1, 64, 12).rotateX(-Math.PI / 2);
  const pipeMat = new THREE.ShaderMaterial({
    vertexShader: PIPE_VERT,
    fragmentShader: PIPE_FRAG,
    transparent: true,
    depthWrite: false
  });
  const world = new THREE.Group;
  scene.add(world);
  let pipes = new THREE.Group, shelves = new THREE.Group;
  world.add(pipes, shelves);
  let steps = [], cumT = new Float64Array(0), cum = {}, cumBand = {};
  function setSteps(list) {
    steps = list;
    cumT = new Float64Array(steps.length);
    for (const k of KEYS) {
      cum[k] = new Float64Array(steps.length);
      cumBand[k] = new Float64Array(steps.length * NB);
    }
    const run = {
      B: 0,
      M: 0,
      F: 0,
      V: 0,
      R: 0,
      X: 0
    }, rb = {};
    for (const k of KEYS) rb[k] = new Float64Array(NB);
    steps.forEach((s, i) => {
      const bi = bandOf(s.key);
      if (s.a === "B") {
        run.B += s.v;
        rb.B[bi] += s.v;
      } else {
        run[s.a] -= s.v;
        rb[s.a][bi] -= s.v;
      }
      run[s.b] += s.v;
      rb[s.b][bi] += s.v;
      cumT[i] = s.t;
      for (const k of KEYS) {
        cum[k][i] = run[k];
        cumBand[k].set(rb[k], i * NB);
      }
    });
  }
  const idxAt = t => {
    let lo = 0, hi = cumT.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (cumT[m] <= t) lo = m + 1; else hi = m;
    }
    return lo - 1;
  };
  function bandsAt(t) {
    const i = idxAt(t), out = {};
    for (const k of KEYS) out[k] = i < 0 ? new Float64Array(NB) : cumBand[k].subarray(i * NB, i * NB + NB);
    return out;
  }
  function levelsAt(t) {
    const i = idxAt(t), L = {};
    for (const k of KEYS) L[k] = i < 0 ? 0 : cum[k][i];
    return L;
  }
  const finalTaken = () => cumT.length ? cum.B[cumT.length - 1] : 0;
  let model = null, SL = null, V = [], modelSig = "", routeKeys = [];
  const lv = new Float64Array(64 * 3);
  function makeVessel(m) {
    const bin = m.kind === "bin", col = bin ? [ BIN_HEX, BIN_HEX, BIN_HEX ] : KIND_HEX;
    const u = {
      uCol: {
        value: new THREE.Color(col[2])
      },
      uC0: {
        value: new THREE.Color(col[0])
      },
      uC1: {
        value: new THREE.Color(col[1])
      },
      uC2: {
        value: new THREE.Color(col[2])
      },
      uTime: clock,
      uAmp: {
        value: 0
      },
      uH: {
        value: 0
      },
      uMax: {
        value: 1
      },
      uSlope: {
        value: new THREE.Vector2
      },
      uBase: {
        value: 0
      },
      uTop: {
        value: 1
      },
      uFade: {
        value: 1
      },
      uGlow: {
        value: 0
      },
      uL1: {
        value: 0
      },
      uL2: {
        value: 0
      },
      uFloor: {
        value: 0
      },
      uIceTop: {
        value: 0
      },
      uProf: {
        value: new Float32Array(16)
      },
      uProfS: profS,
      ...inkShared
    };
    const mat = (wave, refl) => new THREE.ShaderMaterial({
      vertexShader: LIQ_VERT,
      fragmentShader: LIQ_FRAG,
      transparent: refl,
      depthWrite: !refl,
      side: refl ? THREE.DoubleSide : THREE.FrontSide,
      uniforms: {
        ...u,
        uWave: {
          value: wave ? 1 : 0
        },
        uRefl: {
          value: refl ? 1 : 0
        }
      }
    });
    const mats = [ mat(false, false), mat(true, false), mat(false, true), mat(true, true) ];
    const g = new THREE.Group;
    const body = new THREE.Mesh(bodyGeo, mats[0]), surf = new THREE.Mesh(surfGeo, mats[1]);
    const mirror = new THREE.Group;
    mirror.scale.y = -1;
    const rBody = new THREE.Mesh(bodyGeo, mats[2]), rSurf = new THREE.Mesh(surfGeo, mats[3]);
    mirror.add(rBody, rSurf);
    const glass = new THREE.Mesh(new THREE.BufferGeometry, glassMat);
    const mark = new THREE.Mesh(new THREE.TorusGeometry(1, .012, 8, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({
      color: 16777215,
      transparent: true,
      opacity: .3,
      depthWrite: false
    }));
    mark.visible = bin;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: radial,
      color: 0,
      transparent: true,
      opacity: .8,
      depthWrite: false
    }));
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: radial,
      color: col[2],
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    shadow.position.y = .002;
    pool.position.y = .004;
    shadow.renderOrder = 1;
    pool.renderOrder = 2;
    g.add(mirror, shadow, pool, body, surf, mark, glass);
    world.add(g);
    return {
      m,
      g,
      u,
      mats,
      body,
      surf,
      rBody,
      rSurf,
      glass,
      mark,
      shadow,
      pool,
      shown: 0,
      vel: 0,
      ripple: 0,
      inflow: 0,
      snap: true,
      sx: 0,
      sz: 0,
      vx: 0,
      vz: 0,
      topCol: bin ? 0 : 1,
      ice: 0
    };
  }
  function dropVessels() {
    for (const v of V) {
      world.remove(v.g);
      v.glass.geometry.dispose();
      v.mats.forEach(m => m.dispose());
      v.mark.geometry.dispose();
      v.mark.material.dispose();
      v.shadow.geometry.dispose();
      v.pool.geometry.dispose();
      v.shadow.material.dispose();
      v.pool.material.dispose();
    }
    V = [];
  }
  function setModel(m) {
    const sig = m.vessels.map(v => v.key + ":" + Math.round(v.peak / 1e6)).join("|");
    model = m;
    SL = stageLevels(m);
    const rk = new Set;
    for (const s of m.steps) if (s.a >= 0 && s.a !== s.b) rk.add(s.a * 64 + s.b);
    routeKeys = [ ...rk ];
    if (sig === modelSig && V.length) {
      if (fl) fl.resync = true;
      return;
    }
    modelSig = sig;
    dropVessels();
    V = m.vessels.map(makeVessel);
    if (G) resize(G.args);
  }
  let fl = null, flDead = !renderer || reduced;
  const dGeo = new THREE.BufferGeometry;
  let dCap = 0;
  const dAlloc = n => {
    if (n <= dCap) return;
    dCap = Math.max(4096, Math.ceil(n * 1.5));
    dGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(dCap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    dGeo.setAttribute("aCol", new THREE.BufferAttribute(new Float32Array(dCap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    dGeo.setAttribute("aVel", new THREE.BufferAttribute(new Float32Array(dCap * 3), 3).setUsage(THREE.DynamicDrawUsage));
  };
  dAlloc(1);
  dGeo.setDrawRange(0, 0);
  const liq = flDead ? null : makeLiquid(renderer, dGeo);
  const inkPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(.5, .5, 0), new THREE.ShaderMaterial({
    vertexShader: INK_VERT,
    fragmentShader: INK_FRAG,
    uniforms: {
      tInk: inkShared.tInk,
      uTx: inkShared.uInkTx,
      uT: {
        value: .6
      }
    },
    transparent: true,
    depthWrite: false
  }));
  inkPlane.renderOrder = 2;
  inkPlane.visible = false;
  inkPlane.frustumCulled = false;
  scene.add(inkPlane);
  let G = null;
  function resize(args) {
    const {w, h} = args;
    if (!model || !V.length || !w || !h) {
      G = {
        args,
        ticks: [],
        axisX: 0
      };
      return;
    }
    const R0 = args.rect || {
      x0: 0,
      x1: w,
      y0: args.top,
      y1: args.bottom
    };
    cam.aspect = w / h;
    const s = 2 * CAM_D * Math.tan(cam.fov * Math.PI / 360) / h, eyePx = R0.y0 - 6;
    cam.setViewOffset(w, h, 0, h / 2 - eyePx, w, h);
    cam.updateProjectionMatrix();
    const WX = px => (px - w / 2) * s, WY = py => -(py - eyePx) * s;
    const narrow = R0.x1 - R0.x0 < 640, pr = Math.max(2.8, Math.min(5.4, (R0.x1 - R0.x0) / 120));
    const titleH = 12, nameH = 11, tipRoom = pr * 2.6, laneGap = pr * 3.3;
    const overhead = titleH + tipRoom + 3 + nameH + pr + 2 + laneGap + pr + 5;
    const Hpx = Math.max(14, Math.min(170, (R0.y1 - R0.y0) / 4 - overhead));
    const side = Math.max(8, pr * 2.5), xL = R0.x0 + side, xR = R0.x1 - side, span = xR - xL - pr * 6;
    const rows = [ 0, 1, 2, 3 ].map(r => V.filter(v => v.m.row === r));
    const Hu = Hpx * .84, rmin = narrow ? 6.5 : 9, gmin = pr * 5.2;
    const rinOf = (q, v) => Math.max(rmin * .955, q * Math.sqrt(Math.max(0, v.m.peak) / (Math.PI * Hu)));
    const need = (q, row) => row.reduce((a, v) => a + 2 * rinOf(q, v) / .955 + gmin, 0);
    let lo = 0, hi = 1;
    for (let i = 0; i < 60; i++) {
      const m = (lo + hi) / 2;
      if (rows.every(row => need(m, row) <= span)) lo = m; else hi = m;
    }
    const q = lo;
    const rowH = overhead + Hpx, lanes = [];
    const vx = [];
    rows.forEach((row, r) => {
      const top = R0.y0 + r * rowH, rim = top + titleH + tipRoom, floor = rim + Hpx;
      const laneR = floor + 3 + nameH + pr + 2, laneL = laneR + laneGap;
      lanes[r] = {
        R: laneR,
        L: laneL,
        top,
        rim,
        floor
      };
      const tot = row.reduce((a, v) => a + 2 * rinOf(q, v) / .955, 0), g = (span - tot) / Math.max(1, row.length);
      let cur = xL + pr * 3;
      for (const v of row) {
        const rin = rinOf(q, v), rr = rin / .955;
        v.px = {
          x: cur + rr,
          r: rr,
          rin,
          rim,
          floor,
          drop: cur + 2 * rr + g / 2,
          row: r
        };
        cur += 2 * rr + g;
        vx.push(v);
      }
    });
    const prW = pr * s, simU = prW / PIPE_R, boreW = BORE * simU;
    for (const v of V) {
      const P = v.px, X = WX(P.x), F = WY(P.floor), r = P.r * s, rin = P.rin * s, H = Hpx * s;
      const t = Math.min(r * .04, prW * .6), b = Math.min(r * .12, H * .1, prW * 1.2);
      v.X = X;
      v.F = F;
      v.r = r;
      v.rin = rin;
      v.H = H;
      v.b = b;
      v.per = q * q / (Math.PI * P.rin * P.rin) * s;
      v.tip = WY(P.rim) + prW * .8;
      v.g.position.set(X, F, 0);
      v.glass.geometry.dispose();
      v.glass.geometry = glassGeo(r, H, t, b);
      for (const mm of [ v.body, v.surf, v.rBody, v.rSurf ]) {
        mm.scale.set(rin, 1, rin);
        mm.position.y = b;
      }
      v.mark.scale.set(r * 1.004, 1, r * 1.004);
      v.shadow.scale.set(r * 3, 1, r * 3);
      v.pool.scale.set(r * 4.5, 1, r * 4.5);
      v.u.uBase.value = F + b;
      v.u.uTop.value = F + H;
      v.u.uMax.value = H - b - r * .02;
      v.u.uFade.value = Math.min(r * .22, H * .18);
      v.u.uFloor.value = F;
      v.snap = true;
    }
    const Rgap = r => WY(lanes[r].R), Lgap = r => WY(lanes[r].L), xLr = WX(xL), xRr = WX(xR);
    const routes = {}, polys = [];
    for (const key of routeKeys) {
      const a = V[Math.floor(key / 64)], b = V[key % 64];
      if (!a || !b) continue;
      const ra = a.px.row, rb = b.px.row, ys = a.F + a.b + boreW * 1.05, xs = WX(a.px.drop), x0 = a.X + a.rin * .85;
      let pts = [ [ x0, ys ], [ xs, ys ] ];
      if (rb === ra + 1) {
        const y = b.X >= xs ? Rgap(ra) : Lgap(ra);
        pts.push([ xs, y ], [ b.X, y ]);
      } else if (rb > ra + 1) pts.push([ xs, Rgap(ra) ], [ xRr, Rgap(ra) ], [ xRr, Lgap(rb - 1) ], [ b.X, Lgap(rb - 1) ]); else if (rb >= 1) pts.push([ xs, Lgap(ra) ], [ xLr, Lgap(ra) ], [ xLr, Rgap(rb - 1) ], [ b.X, Rgap(rb - 1) ]); else continue;
      pts.push([ b.X, b.tip ]);
      pts = clean(pts);
      polys.push({
        pts,
        a
      });
      routes[key] = {
        a: a.m.i,
        b: b.m.i,
        pts: pts.map(([x, y]) => [ x / simU, y / simU ]),
        ppd: 0
      };
    }
    buildPipes(polys, prW, s);
    while (shelves.children.length) {
      const c = shelves.children[0];
      shelves.remove(c);
      c.geometry.dispose();
      c.material.dispose();
    }
    lanes.forEach((L, r) => {
      const row = rows[r];
      if (!row.length) return;
      const depth = Math.max(...row.map(v => v.r)) * 2.4, F = WY(L.floor), cx = (xLr + xRr) / 2, wd = xRr - xLr;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(wd * 1.1, depth * 2).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        vertexShader: SHELF_VERT,
        fragmentShader: SHELF_FRAG,
        uniforms: {
          uLift: {
            value: new THREE.Vector3(.012, .015, .028)
          },
          uStage: {
            value: new THREE.Vector4(cx, 0, wd * .52, depth * .5)
          }
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      }));
      m.position.set(cx, F - .001, 0);
      m.renderOrder = -1;
      shelves.add(m);
    });
    let bx0 = xLr - prW * 3, bx1 = xRr + prW * 3, by0 = Infinity, by1 = -Infinity;
    for (const v of V) {
      by0 = Math.min(by0, v.F);
      by1 = Math.max(by1, v.F + v.H + prW * 3);
    }
    by0 = Math.min(by0, Lgap(3) - prW * 3);
    G = {
      args,
      w,
      h,
      s,
      pr,
      prW,
      simU,
      Hpx,
      ticks: [],
      axisX: 0,
      lanes,
      xL,
      xR,
      rect: R0,
      narrow,
      routes,
      rimPx: R0.y0,
      floorPx: R0.y1
    };
    if (liq) {
      liq.layout({
        rect: [ bx0, by0, bx1, by1 ],
        r: simU,
        rp: RP
      });
      const R = liq.rect;
      inkPlane.position.set(R.x, R.y, 0);
      inkPlane.scale.set(R.z - R.x, R.w - R.y, 1);
      inkShared.uInkRect.value.copy(R);
      inkShared.uInkTx.value.set(...liq.texel);
      profS.value = simU;
    }
    const area = 2 * RP * Math.sqrt(3) * RP;
    for (const k in routes) {
      const b = V[routes[k].b];
      routes[k].ppd = 2 * (b.rin / simU) * (b.per * DROP / simU) / area;
    }
    G.geo = {
      pin: BORE,
      bend: BEND,
      rect: [ bx0 / simU, by0 / simU, bx1 / simU, by1 / simU ],
      cols: PCOL.map(c => new THREE.Color(c).toArray()),
      vessels: V.map(v => ({
        x: v.X / simU,
        rin: v.rin / simU,
        b: (v.F + v.b) / simU,
        top: v.tip / simU + .3,
        hpd: v.per * DROP / simU,
        col: v.topCol
      })),
      routes
    };
    labels();
    fluidSetup();
    clear(true);
  }
  function clean(p) {
    const q = [ p[0] ];
    for (let i = 1; i < p.length; i++) {
      const l = q[q.length - 1];
      if (Math.hypot(p[i][0] - l[0], p[i][1] - l[1]) > 1e-6) q.push(p[i]);
    }
    for (let i = q.length - 2; i >= 1; i--) {
      const [a, b, c] = [ q[i - 1], q[i], q[i + 1] ];
      if (Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9) q.splice(i, 1);
    }
    return q;
  }
  function buildPipes(polys, prW, s) {
    while (pipes.children.length) {
      const c = pipes.children[0];
      pipes.remove(c);
      c.geometry.dispose();
    }
    const runs = new Map, corners = new Map, snap = x => Math.round(x / (s * .25));
    for (const {pts, a} of polys) {
      for (let i = 0; i + 1 < pts.length; i++) {
        let [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        if (i === 0) x0 = a.X + a.r * .9;
        const hz = Math.abs(y1 - y0) < 1e-9, k = (hz ? "h" : "v") + snap(hz ? y0 : x0);
        const lo = hz ? Math.min(x0, x1) : Math.min(y0, y1), hi = hz ? Math.max(x0, x1) : Math.max(y0, y1);
        if (!runs.has(k)) runs.set(k, {
          hz,
          at: hz ? y0 : x0,
          list: []
        });
        runs.get(k).list.push([ lo, hi ]);
        if (i > 0) corners.set(snap(x0) + "," + snap(y0), [ x0, y0 ]);
      }
    }
    const tube = new THREE.CylinderGeometry(1, 1, 1, 18, 1, true), ball = new THREE.SphereGeometry(1, 18, 12);
    for (const {hz, at, list} of runs.values()) {
      list.sort((p, q) => p[0] - q[0]);
      const merged = [];
      for (const [lo, hi] of list) {
        const l = merged[merged.length - 1];
        if (l && lo <= l[1] + 1e-6) l[1] = Math.max(l[1], hi); else merged.push([ lo, hi ]);
      }
      for (const [lo, hi] of merged) {
        const m = new THREE.Mesh(tube.clone(), pipeMat);
        m.scale.set(prW, hi - lo, prW);
        if (hz) {
          m.rotation.z = Math.PI / 2;
          m.position.set((lo + hi) / 2, at, 0);
        } else m.position.set(at, (lo + hi) / 2, 0);
        m.renderOrder = 3;
        pipes.add(m);
      }
    }
    for (const [x, y] of corners.values()) {
      const m = new THREE.Mesh(ball.clone(), pipeMat);
      m.scale.setScalar(prW);
      m.position.set(x, y, 0);
      m.renderOrder = 3;
      pipes.add(m);
    }
    tube.dispose();
    ball.dispose();
  }
  function labels() {
    if (!labelsEl || !G || !G.lanes) return;
    const html = [];
    G.lanes.forEach((L, r) => html.push(`<span class="vr" style="left:${(G.xL + G.pr * 3).toFixed(1)}px;top:${L.top.toFixed(1)}px">${ROW_NAME[r]}</span>`));
    for (const v of V) {
      const P = v.px, wd = Math.max(P.r * 2, (P.drop - P.x) * 2 - G.pr * 3);
      html.push(`<span class="vn" data-k="${v.m.i}" style="left:${(P.x - wd / 2).toFixed(1)}px;top:${(P.floor + 3).toFixed(1)}px;width:${wd.toFixed(1)}px">${esc(shortName(v.m.name))}</span>`);
    }
    labelsEl.innerHTML = html.join("");
    labelsEl.classList.toggle("narrow", G.narrow);
  }
  const esc = x => String(x).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
  function fluidOff(why, e) {
    console.error("[tracker] the liquid simulation stopped (" + why + "); drawing the levels only", e || "");
    flDead = true;
    if (fl) {
      try {
        fl.w.terminate();
      } catch {}
      fl = null;
    }
    inkPlane.visible = false;
    inkShared.uInkOn.value = 0;
    dGeo.setDrawRange(0, 0);
    clear(true);
  }
  function fluidSetup() {
    if (flDead || !G || !G.geo) return;
    if (!fl) {
      const ok = renderer.capabilities.isWebGL2 && (renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float"));
      if (!ok || typeof Worker === "undefined") {
        fluidOff(ok ? "no workers" : "no float targets");
        return;
      }
      let w;
      try {
        w = new Worker(new URL("./stagefluid.js?v=3", import.meta.url));
      } catch (e) {
        fluidOff("worker", e);
        return;
      }
      fl = {
        w,
        busy: false,
        state: null,
        epoch: 0,
        resync: true,
        carry: new Map,
        lastPump: -1e9,
        pend: 0,
        pendP: 0,
        pendAtStep: 0,
        pendPAtStep: 0,
        sentAt: 0,
        counts: new Float64Array(64),
        pos: null,
        col: null,
        vel: null,
        back: 0,
        backP: 0,
        progT: 0,
        simT: 0,
        stuck: false,
        tops: ""
      };
      w.onmessage = ev => {
        const m = ev.data;
        if (!fl || fl.w !== w) return;
        if (m.type === "error") {
          fluidOff("error", m.message);
          return;
        }
        if (m.type !== "state") return;
        fl.busy = false;
        fl.pos = m.pos;
        fl.col = m.col;
        fl.vel = m.vel;
        fl.pend -= fl.pendAtStep;
        fl.pendP -= fl.pendPAtStep;
        fl.pendAtStep = fl.pendPAtStep = 0;
        if (m.epoch !== fl.epoch) return;
        fl.state = m;
        for (let k = 0; k < m.counts.length; k++) fl.counts[k] = m.counts[k];
        dAlloc(m.np);
        dGeo.attributes.position.array.set(m.pos.subarray(0, m.np * 3));
        dGeo.attributes.aCol.array.set(m.col.subarray(0, m.np * 3));
        dGeo.attributes.aVel.array.set(m.vel.subarray(0, m.np * 3));
        for (let k = 0; k < V.length; k++) for (let i = 0; i < 16; i++) {
          const at = j => m.prof[k * 16 + Math.max(0, Math.min(15, j))];
          V[k].profT = V[k].profT || new Float32Array(16);
          V[k].profT[i] = (at(i - 1) + 2 * at(i) + at(i + 1)) / 4;
        }
        dGeo.attributes.position.needsUpdate = dGeo.attributes.aCol.needsUpdate = dGeo.attributes.aVel.needsUpdate = true;
        dGeo.setDrawRange(0, m.np);
      };
      w.onerror = e => fluidOff("worker error", e.message || e);
    }
    fl.w.postMessage({
      type: "setup",
      geo: G.geo
    });
    fl.resync = true;
    fl.tops = "";
  }
  const dataAt = t => SL.at(t, lv.subarray(0, V.length * 3));
  function fluidSync(t) {
    fl.epoch++;
    fl.resync = false;
    fl.carry.clear();
    fl.pend = fl.pendP = 0;
    fl.pendAtStep = fl.pendPAtStep = 0;
    fl.state = null;
    fl.progT = fl.simT;
    fl.tops = "";
    const L = dataAt(t), c = V.map((v, k) => (L[k * 3] + L[k * 3 + 1] + L[k * 3 + 2]) / DROP);
    c.forEach((x, k) => {
      fl.counts[k] = x;
    });
    fl.w.postMessage({
      type: "counts",
      counts: c
    });
    dGeo.setDrawRange(0, 0);
  }
  function pace() {
    if (!fl || flDead || fl.stuck) return 1;
    return Math.max(0, Math.min(1, (PACE_HI - fl.backP) / (PACE_HI - PACE_LO)));
  }
  function advance(t0, t1, keep, now) {
    if (!G || !model || reduced || !fl) return;
    if (fl.resync) fluidSync(t0);
    const groups = new Map, S = model.steps;
    for (let i = SL.idx(t0) + 1; i < S.length && S[i].t <= t1; i++) {
      const s = S[i];
      if (s.a < 0 || s.a === s.b || keep && !keep(s)) continue;
      const c = model.vessels[s.a].kind === "bin" ? 0 : COL_OF[s.ca], k = (s.a * 64 + s.b) * 4 + c;
      groups.set(k, (groups.get(k) || 0) + s.v);
    }
    for (const [k, v] of groups) {
      const key = Math.floor(k / 4), c = k % 4, a = Math.floor(key / 64), b = key % 64, R = G.routes[key];
      if (!R) continue;
      const x = (fl.carry.get(k) || 0) + v / DROP, n = Math.floor(x);
      fl.carry.set(k, x - n);
      if (n < 1) continue;
      fl.w.postMessage({
        type: "pump",
        a,
        b,
        n,
        c
      });
      fl.lastPump = now;
      fl.pend += n;
      fl.pendP += n * R.ppd;
      V[a].ripple = Math.min(1, V[a].ripple + .05 + Math.log10(1 + n) * .08);
    }
  }
  function clear(snap) {
    if (fl) fl.resync = true;
    for (const v of V) {
      v.inflow = 0;
      v.ripple = 0;
      if (snap) v.snap = true;
    }
  }
  let lastNow = 0, grav = 0;
  function tilt(deg) {
    if (!G || reduced || !isFinite(deg)) return;
    grav = Math.max(-.9, Math.min(.9, Math.tan(Math.max(-60, Math.min(60, deg)) * Math.PI / 180)));
    if (fl) fl.w.postMessage({
      type: "grav",
      ang: Math.max(-60, Math.min(60, deg)) * Math.PI / 180
    });
  }
  function vesselAt(px, py) {
    if (!G || !G.lanes) return null;
    for (const v of V) {
      const P = v.px;
      if (py < P.rim - 10 || py > P.floor + 14) continue;
      const off = (px - P.x) / P.r;
      if (Math.abs(off) <= 1.15) return {
        v,
        off
      };
    }
    return null;
  }
  function poke(px, py) {
    const h = reduced ? null : vesselAt(px, py);
    if (!h) return null;
    const {v, off} = h;
    v.vx += (off >= 0 ? -1 : 1) * v.rin * (2.4 + 1.6 * Math.min(1, Math.abs(off)));
    v.vz += v.rin * 1.4 * (Math.random() - .5);
    v.ripple = Math.min(1, v.ripple + .7);
    if (fl && !fl.resync) fl.w.postMessage({
      type: "poke",
      k: v.m.i,
      dir: off >= 0 ? -1 : 1
    });
    return v.m.key;
  }
  function frame(now, t) {
    if (!G || !G.lanes || !model) return null;
    const dt = Math.min(.05, lastNow ? (now - lastNow) / 1e3 : .016);
    lastNow = now;
    clock.value = reduced ? 0 : now / 1e3;
    const L = dataAt(t), n = V.length;
    const target = new Float64Array(n);
    for (let k = 0; k < n; k++) target[k] = L[k * 3] + L[k * 3 + 1] + L[k * 3 + 2];
    const tops = [], ice = [];
    for (let k = 0; k < n; k++) {
      const v = V[k], tot = target[k], f = x => tot > 0 ? x / tot : 0;
      const top = v.m.kind === "bin" ? 0 : f(L[k * 3 + 2]) > .02 ? 1 : f(L[k * 3 + 1]) > .02 ? 2 : tot > 0 ? 3 : 1;
      tops.push(top);
      ice.push(top === 3 ? 1 : 0);
      v.topCol = top;
      v.ice = top === 3 ? 1 : 0;
    }
    if (fl) {
      const sig = tops.join("");
      if (sig !== fl.tops && !fl.resync) {
        fl.tops = sig;
        fl.w.postMessage({
          type: "tops",
          tops,
          ice
        });
      }
      fluidFrame(now, t, dt, target);
    }
    for (let k = 0; k < n; k++) {
      const v = V[k], goal = Math.max(0, target[k]);
      if (v.snap || reduced) {
        v.shown = goal;
        v.vel = 0;
        v.snap = false;
      } else {
        v.vel += ((goal - v.shown) * 22 - v.vel * 8.5) * dt;
        v.shown += v.vel * dt;
        if (Math.abs(goal - v.shown) < 1e4 && Math.abs(v.vel) < 1e5) v.shown = goal;
      }
      v.ripple *= Math.exp(-dt * .8);
      v.inflow *= Math.exp(-dt * 1.1);
      const hgt = Math.max(0, v.shown) * v.per, has = hgt > v.r * .01;
      v.body.visible = v.surf.visible = v.rBody.visible = v.rSurf.visible = has;
      if (reduced || v.ice) {
        v.sx = v.sz = v.vx = v.vz = 0;
      } else {
        v.vx += (-(v.sx - grav * v.rin) * 40 - v.vx * 1.3) * dt;
        v.vz += (-v.sz * 40 - v.vz * 1.3) * dt;
        v.sx += v.vx * dt;
        v.sz += v.vz * dt;
        const room = v.H - v.b - hgt, lim = Math.max(v.r * .02, Math.min(v.r * .9, hgt * .9, room * .9)), s = Math.hypot(v.sx, v.sz);
        if (s > lim) {
          v.sx *= lim / s;
          v.sz *= lim / s;
        }
      }
      const tot = target[k] > 0 ? target[k] : 1, h0 = hgt * Math.max(0, L[k * 3]) / tot, h1 = h0 + hgt * Math.max(0, L[k * 3 + 1]) / tot;
      const u = v.u, amp = reduced || v.ice ? 0 : (.3 + 2.6 * v.ripple) * v.r * Math.min(1, hgt / (v.r * .3));
      u.uAmp.value = amp;
      u.uGlow.value = v.inflow;
      u.uH.value = hgt;
      u.uSlope.value.set(v.sx, v.sz);
      u.uL1.value = v.m.kind === "bin" || h0 <= 0 ? -1 : h0;
      u.uL2.value = v.m.kind === "bin" ? -1 : h1;
      u.uIceTop.value = v.ice;
      u.uCol.value.setHex(v.m.kind === "bin" ? BIN_HEX : KIND_HEX[[ 2, 2, 1, 0 ][v.topCol]]);
      v.pool.material.color.copy(u.uCol.value);
      if (v.m.kind === "bin") v.mark.position.y = v.b + model.start[k][2] * v.per;
      v.pool.material.opacity = has ? Math.min(.32, .05 + hgt / v.H * .3 + v.inflow * .12) : 0;
    }
    if (fl) drawDrops(dt);
    const bands = [];
    for (let k = 0; k < n; k++) {
      const v = V[k], tot = target[k];
      if (!(tot > 5e5) && v.m.kind !== "bin") continue;
      const list = KIND_NAME.map((nm, j) => [ v.m.kind === "bin" ? "Still in this wallet" : nm, L[k * 3 + j] ]).filter(([, x]) => x > 5e5).sort((a, b) => b[1] - a[1]);
      if (v.m.kind === "bin") list.push([ "Taken from it", Math.max(0, model.start[k][2] - tot) ]);
      bands.push({
        k: v.m.key,
        name: v.m.long,
        band: null,
        list,
        v: v.m.kind === "bin" ? model.start[k][2] : tot,
        x: v.px.x - v.px.r,
        w: v.px.r * 2,
        y0: v.px.rim - 6,
        y1: v.px.floor + 13
      });
    }
    return {
      L: levelsAt(t),
      shown: null,
      bands,
      flying: fl ? fl.back : 0
    };
  }
  function fluidFrame(now, t, dt, target) {
    if (fl.resync) fluidSync(t);
    const s = fl.state;
    if (!fl.busy) {
      const pos = fl.pos, col = fl.col, vel = fl.vel;
      const span = fl.sentAt ? Math.min(.05, Math.max(dt, (now - fl.sentAt) / 1e3)) : dt;
      fl.busy = true;
      fl.pendAtStep = fl.pend;
      fl.pendPAtStep = fl.pendP;
      fl.sentAt = now;
      fl.w.postMessage({
        type: "step",
        dt: span,
        epoch: fl.epoch,
        pos,
        col,
        vel
      }, pos ? [ pos.buffer, col.buffer, vel.buffer ] : []);
      fl.pos = fl.col = fl.vel = null;
    } else if (now - fl.sentAt > 5e3) {
      fluidOff("no answer for 5 s");
      return;
    }
    const back = (s ? s.n + s.queued : 0) + fl.pend, backP = (s ? s.nP + s.queuedP : 0) + fl.pendP;
    if (s && s !== fl.seen) {
      fl.seen = s;
      let landed = false;
      for (let k = 0; k < V.length; k++) if (s.hits[k * 2]) landed = true;
      if (back < fl.back || landed || s.nP !== fl.lastN || !back || s.vt > .5) fl.progT = s.simT;
      fl.simT = s.simT;
      fl.lastN = s.nP;
    }
    fl.back = back;
    fl.backP = backP;
    if (back > 0 && fl.simT - fl.progT > 4) {
      if (!fl.stuck) console.error("[tracker] the liquid has not moved for 4 simulated seconds with " + back.toFixed(1) + " drops on their way");
      fl.stuck = true;
    } else fl.stuck = false;
    if (s && !s.n && !s.queued && !fl.pend && now - fl.lastPump > 400) {
      for (let k = 0; k < V.length; k++) {
        const d = Math.max(0, target[k]) / DROP - fl.counts[k];
        if (Math.abs(d) > .001) {
          fl.w.postMessage({
            type: "adjust",
            k,
            n: d
          });
          fl.counts[k] += d;
          fl.carry.clear();
        }
      }
    }
    for (let k = 0; k < V.length; k++) {
      const v = V[k];
      target[k] = fl.counts[k] * DROP;
      if (s && s.hits[k * 2]) {
        const n = s.hits[k * 2], sp = s.hits[k * 2 + 1] / n;
        v.ripple = Math.min(1, v.ripple + n * .003 * Math.min(2, sp / 6));
        v.inflow = Math.max(v.inflow, Math.min(1, .25 + n * .04));
        v.vz += v.rin * .02 * Math.min(4, n) * (Math.random() - .5);
      }
    }
    if (s) s.hits.fill(0);
  }
  function drawDrops(dt) {
    if (!liq) return;
    const n = dGeo.drawRange.count, e = Math.min(1, dt * 18);
    liq.draw(n);
    inkPlane.visible = n > 0;
    inkShared.uInkOn.value = n > 0 ? 1 : 0;
    inkShared.tInk.value = liq.texture;
    for (const v of V) {
      if (!v.profT) continue;
      const P = v.u.uProf.value;
      for (let i = 0; i < 16; i++) P[i] += (v.profT[i] - P[i]) * e;
    }
  }
  return {
    scene,
    cam,
    setSteps,
    setModel,
    levelsAt,
    bandsAt,
    advance,
    clear: () => clear(false),
    frame,
    finalTaken,
    resize,
    poke,
    tilt,
    hit: (px, py) => vesselAt(px, py)?.v.m.key || null,
    pace,
    get fluid() {
      return fl ? {
        on: true,
        back: fl.back,
        backP: fl.backP,
        counts: Array.from(fl.counts.subarray(0, V.length)),
        n: fl.state ? fl.state.n : 0,
        np: fl.state ? fl.state.np : 0,
        full: fl.backP >= PACE_HI,
        queued: fl.state ? fl.state.queued : 0,
        ms: fl.state ? fl.state.ms : 0,
        simT: fl.simT,
        stuck: fl.stuck
      } : {
        on: false,
        dead: flDead
      };
    },
    get layout() {
      return G;
    },
    get liquid() {
      return liq;
    },
    get steps() {
      return steps;
    },
    get vessels() {
      return V.map(v => ({
        key: v.m.key,
        row: v.m.row,
        px: v.px,
        shown: v.shown,
        per: v.per,
        H: v.H,
        ice: v.ice
      }));
    },
    get model() {
      return model;
    },
    levels(t) {
      const L = dataAt(t), o = [];
      for (let k = 0; k < V.length; k++) o.push(L[k * 3] + L[k * 3 + 1] + L[k * 3 + 2]);
      return o;
    },
    bump(s) {
      if (reduced) return;
      for (const v of V) if (v.m.key === "bin:eth" || v.m.key === "A") v.ripple = Math.min(1, v.ripple + s * .08);
    }
  };
}
