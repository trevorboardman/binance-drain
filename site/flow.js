import * as THREE from "three";

import { makeLiquid } from "./liquid.js?v=2";

export const DOT = 1e6;

export const COLS = [ "B", "M", "F", "V", "R", "X" ];

const KEYS = COLS;

const HEX = {
  B: 13391104,
  M: 16726832,
  F: 4174591,
  V: 10128639,
  R: 3135114,
  X: 8226713
};

export const TANK_HEX = HEX;

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

const GROUND = [ .0012, .0015, .003 ];

const FLOW_U = .8, SPOUT_T = .12;

const durOf = v => Math.min(1.1, .3 + .28 * Math.log10(1 + v / 1e7));

export const DROP = 1e6;

const D_SPACE = .14, BORE = .24, PIPE_R = .27, DIP = .6, BEND = .3;

const RP = .3 * BORE / 2.4;

const PACE_LO = 500, PACE_HI = 1100;

const INK_VERT = `\nvarying vec2 vUv;\nvoid main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const INK_FRAG = `\nuniform sampler2D tInk;\nuniform vec2 uTx;\nuniform float uT;\nvarying vec2 vUv;\nvoid main() {\n  vec4 c = texture2D(tInk, vUv);\n  float a = c.a, fw = max(fwidth(a) * 0.8, 0.02), edge = smoothstep(uT - fw, uT + fw, a);\n  if (edge < 0.01) discard;\n  float hL = texture2D(tInk, vUv - vec2(uTx.x * 1.5, 0.0)).a, hR = texture2D(tInk, vUv + vec2(uTx.x * 1.5, 0.0)).a;\n  float hB = texture2D(tInk, vUv - vec2(0.0, uTx.y * 1.5)).a, hT = texture2D(tInk, vUv + vec2(0.0, uTx.y * 1.5)).a;\n  float thick = smoothstep(uT, uT + 1.3, a);\n  vec3 n = normalize(vec3(-(hR - hL) * 1.4, -(hT - hB) * 1.4, 0.25 + thick * 0.75));\n  vec3 col = c.rgb / max(a, 1e-4), V = vec3(0.0, 0.0, 1.0), Ld = normalize(vec3(-0.4, 0.65, 0.65));\n  vec3 base = mix(col * 1.05, col * 0.5, thick);\n  float diff = 0.6 + 0.4 * max(dot(n, Ld), 0.0);\n  vec3 R = reflect(-V, n);\n  float spec = pow(max(dot(R, Ld), 0.0), 70.0) * 1.4;\n  float boxes = smoothstep(0.62, 0.95, R.y) * 0.5 + smoothstep(0.86, 0.985, abs(R.x)) * (R.x < 0.0 ? 0.9 : 0.5);\n  float fres = pow(1.0 - max(n.z, 0.0), 2.0);\n  vec3 o = base * diff + vec3(1.0, 0.97, 0.92) * spec + vec3(0.85, 0.9, 1.0) * boxes * 0.18 + col * fres * 0.15;\n  gl_FragColor = vec4(o, edge * 0.97);\n}`;

const LIQ_VERT = `\nuniform float uTime, uAmp, uWave, uH, uMax, uProfS;\nuniform float uProf[16];\nuniform vec2 uSlope;\nvarying vec3 vW, vN, vL;\nfloat prof(float x) {\n  float f = clamp((x * 0.5 + 0.5) * 16.0 - 0.5, 0.0, 15.0);\n  int i = int(floor(f));\n  return mix(uProf[i], uProf[min(i + 1, 15)], f - float(i)) * uProfS;\n}\nvoid main() {\n  vec3 p = position;\n\n\n  float lvl = clamp(uH + dot(uSlope, p.xz) + prof(p.x), 0.0, uMax);\n  if (uWave < 0.5) p.y = position.y * lvl;\n  else {\n    float rr = length(p.xz);\n    p.y = lvl + uAmp * (sin(rr * 11.0 - uTime * 5.0) * 0.55 + sin(p.x * 4.0 + uTime * 1.7) * 0.25 + sin(p.z * 5.0 - uTime * 2.1) * 0.2) * smoothstep(1.0, 0.6, rr) * 0.05;\n  }\n  vL = p;\n  vec4 w = modelMatrix * vec4(p, 1.0);\n  vW = w.xyz;\n  vN = normalize(mat3(modelMatrix) * normal);\n  gl_Position = projectionMatrix * viewMatrix * w;\n}`;

const LIQ_FRAG = `\nuniform vec3 uCol;\nuniform float uTime, uBase, uTop, uWave, uRefl, uFade, uGlow, uInkOn;\nuniform sampler2D tInk;\nuniform vec4 uInkRect;\nuniform vec2 uInkTx;\nvarying vec3 vW, vN, vL;\nvoid main() {\n  vec3 W = vW;\n  if (uRefl > 0.5) W.y = -W.y;\n  vec3 V = normalize(cameraPosition - vW);\n  vec3 N = uWave > 0.5 ? normalize(cross(dFdx(vW), dFdy(vW))) : normalize(vN);\n  if (dot(N, V) < 0.0) N = -N;\n  float ndv = max(dot(N, V), 0.0), fres = pow(1.0 - ndv, 3.0);\n  float h = clamp((W.y - uBase) / max(uTop - uBase, 1e-3), 0.0, 1.0);\n\n  vec3 c = mix(uCol * 0.2, uCol * 0.72, pow(h, 1.25));\n  float sw = sin(W.y * 5.0 + uTime * 0.55 + sin(W.x * 2.6 + uTime * 0.35) * 1.6) * 0.5 + 0.5;\n  c *= 0.82 + 0.36 * sw;\n\n  if (uInkOn > 0.5 && uRefl < 0.5) {\n    vec2 iu = (vW.xy - uInkRect.xy) / (uInkRect.zw - uInkRect.xy);\n    vec4 d = texture2D(tInk, iu);\n    float ia = 1.0 - exp(-d.a * 2.2);\n    if (ia > 0.003) {\n      float gx = texture2D(tInk, iu + vec2(uInkTx.x, 0.0)).a - texture2D(tInk, iu - vec2(uInkTx.x, 0.0)).a;\n      float gy = texture2D(tInk, iu + vec2(0.0, uInkTx.y)).a - texture2D(tInk, iu - vec2(0.0, uInkTx.y)).a;\n      vec3 ic = d.rgb / max(d.a, 1e-4);\n\n      float lit = 0.75 + 0.6 * clamp(-gx * 3.0 + gy * 3.0, -0.6, 0.8);\n      float other = clamp(length(ic - uCol) * 1.8, 0.0, 1.0);\n      c = mix(c, mix(ic * 0.25, ic * 0.8, pow(h, 1.1)) * lit * (0.85 + 0.3 * sw), ia * 0.7 * other);\n    }\n  }\n\n  vec3 R = reflect(-V, N);\n  float boxes = smoothstep(0.62, 0.95, R.y) * 0.35 + smoothstep(0.86, 0.985, abs(R.x)) * (R.x < 0.0 ? 0.75 : 0.45);\n  c += vec3(0.85, 0.9, 1.0) * boxes * 0.35;\n  c += uCol * fres * (0.7 + 0.5 * uGlow);\n  if (uWave > 0.5) {\n    float rr = length(vL.xz);\n    c = mix(c, uCol * 1.05, 0.55);\n    c += mix(uCol, vec3(1.0), 0.35) * smoothstep(0.82, 0.99, rr) * (0.9 + uGlow);\n  }\n  float a = 1.0;\n  if (uRefl > 0.5) a = 0.11 * exp(vW.y / uFade);\n  gl_FragColor = vec4(c, a);\n}`;

const PIPE_VERT = `\nvarying vec2 vUv;\nvarying vec3 vW, vN;\nvoid main() {\n  vUv = uv;\n  vec4 w = modelMatrix * vec4(position, 1.0);\n  vW = w.xyz;\n  vN = normalize(mat3(modelMatrix) * normal);\n  gl_Position = projectionMatrix * viewMatrix * w;\n}`;

const PIPE_FRAG = `\nuniform float uTime, uMode, uL, uSpd, uRun, uDir;\nuniform vec2 uSeg;\nuniform sampler2D uFlow;\nuniform vec3 uCols[6];\nuniform vec3 uCol;\nvarying vec2 vUv;\nvarying vec3 vW, vN;\n\nvec3 liquid(vec3 ink, float ndv, float q) {\n  float band = sin(q * 6.2832 + sin(q * 2.3) * 0.9) * 0.5 + 0.5;\n  return ink * (0.16 + 0.52 * pow(ndv, 0.8)) * (0.72 + 0.46 * band) + mix(ink, vec3(1.0), 0.45) * pow(ndv, 14.0) * 0.28;\n}\nvoid main() {\n  vec3 V = normalize(cameraPosition - vW), N = normalize(vN);\n  float ndv = abs(dot(N, V)), fres = pow(1.0 - ndv, 2.2);\n  if (uMode > 1.5) {\n    float q = (vW.y + uTime * uSpd) * uL;\n    gl_FragColor = vec4(liquid(uCol, ndv, q) * 1.15 + vec3(0.2) * fres, smoothstep(0.0, 0.35, ndv));\n    return;\n  }\n  float pres, front = 0.0, dir = uDir;\n  vec3 ink = uCol;\n  if (uMode < 0.5) {\n    vec4 f = texture2D(uFlow, vec2(vUv.x, 0.5));\n    int ci = int(f.b * 5.0 + 0.5);\n    ink = uCols[0];\n    for (int i = 0; i < 6; i++) if (i == ci) ink = uCols[i];\n    pres = f.r; front = f.g; dir = f.a > 0.5 ? 1.0 : -1.0;\n  } else {\n\n    float lo = uSeg.x <= 0.0 ? 1e3 : vUv.x - uSeg.x, hi = uSeg.y >= 1.0 ? 1e3 : uSeg.y - vUv.x;\n    pres = clamp(min(lo, hi) / uRun, 0.0, 1.0);\n  }\n\n  float s2 = 1.0 - ndv * ndv, th = 0.12 + 0.76 * s2;\n  float fill = smoothstep(th - 0.1, th + 0.1, pres) * smoothstep(0.92, 0.8, sqrt(s2));\n  vec3 liq = liquid(ink, ndv, (vUv.x - dir * uTime * uSpd) * uL) + ink * front * 0.8;\n  float hi = pow(max(N.y, 0.0), 10.0) * 0.55 + smoothstep(0.86, 0.98, abs(reflect(-V, N).x)) * 0.25;\n  vec3 glass = vec3(0.55, 0.62, 0.75) * fres * 0.55 + vec3(0.9, 0.94, 1.0) * hi;\n  float ga = clamp(0.06 + fres * 0.6 + hi, 0.0, 1.0);\n  gl_FragColor = vec4(mix(glass, liq + glass * 0.5, fill), max(ga, fill * 0.96));\n}`;

const FLOOR_VERT = `\nvarying vec3 vW;\nvoid main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;

const FLOOR_FRAG = `\nuniform vec3 uBg, uLift;\nuniform vec4 uStage;\nvarying vec3 vW;\nvoid main() {\n  float d = exp(-pow((vW.x - uStage.x) / uStage.z, 2.0) - pow((vW.z - uStage.y) / uStage.w, 2.0));\n  gl_FragColor = vec4(uBg + uLift * d, 1.0);\n}`;

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

export function makeTanks({reduced, renderer}) {
  const scene = new THREE.Scene;
  const cam = new THREE.PerspectiveCamera(20, 1, .1, 400);
  cam.position.set(0, 7.5, 40);
  cam.lookAt(0, 3.2, 0);
  if (renderer) scene.environment = studio(renderer);
  const floorU = {
    uBg: {
      value: new THREE.Vector3(...GROUND)
    },
    uLift: {
      value: new THREE.Vector3(.011, .014, .026)
    },
    uStage: {
      value: new THREE.Vector4(0, 0, 10, 4)
    }
  };
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    uniforms: floorU,
    depthWrite: false
  }));
  floor.renderOrder = -1;
  scene.add(floor);
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
    thickness: .6,
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
  const profU = KEYS.map(() => ({
    value: new Float32Array(16)
  })), profS = {
    value: 1
  }, profT = KEYS.map(() => new Float32Array(16));
  const liquidMat = (k, wave, refl) => new THREE.ShaderMaterial({
    vertexShader: LIQ_VERT,
    fragmentShader: LIQ_FRAG,
    transparent: refl,
    depthWrite: !refl,
    side: refl ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      uCol: {
        value: new THREE.Color(HEX[k])
      },
      uTime: clock,
      uAmp: {
        value: 0
      },
      uWave: {
        value: wave ? 1 : 0
      },
      uRefl: {
        value: refl ? 1 : 0
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
      ...inkShared,
      uProf: profU[KEYS.indexOf(k)],
      uProfS: profS
    }
  });
  const tanks = {};
  const bodyGeo = new THREE.CylinderGeometry(1, 1, 1, 96, 1, true).translate(0, .5, 0);
  const surfGeo = new THREE.RingGeometry(1e-4, 1, 96, 16).rotateX(-Math.PI / 2);
  for (const k of KEYS) {
    const g = new THREE.Group;
    scene.add(g);
    const mats = [ liquidMat(k, false, false), liquidMat(k, true, false), liquidMat(k, false, true), liquidMat(k, true, true) ];
    const body = new THREE.Mesh(bodyGeo, mats[0]), surf = new THREE.Mesh(surfGeo, mats[1]);
    const mirror = new THREE.Group;
    mirror.scale.y = -1;
    const rBody = new THREE.Mesh(bodyGeo, mats[2]), rSurf = new THREE.Mesh(surfGeo, mats[3]);
    mirror.add(rBody, rSurf);
    const glass = new THREE.Mesh(new THREE.BufferGeometry, glassMat);
    const mark = new THREE.Mesh(new THREE.TorusGeometry(1, .01, 8, 128).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({
      color: 16777215,
      transparent: true,
      opacity: .3,
      depthWrite: false
    }));
    mark.visible = k === "B";
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: radial,
      color: 0,
      transparent: true,
      opacity: .8,
      depthWrite: false
    }));
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
      map: radial,
      color: HEX[k],
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    }));
    shadow.position.y = .002;
    pool.position.y = .004;
    mirror.renderOrder = 0;
    shadow.renderOrder = 1;
    pool.renderOrder = 2;
    rBody.renderOrder = rSurf.renderOrder = 0;
    g.add(mirror, shadow, pool, body, surf, mark, glass);
    tanks[k] = {
      g,
      body,
      surf,
      rBody,
      rSurf,
      glass,
      mark,
      shadow,
      pool,
      mats,
      shown: 0,
      vel: 0,
      ripple: 0,
      inflow: 0,
      snap: true,
      sx: 0,
      sz: 0,
      vx: 0,
      vz: 0
    };
  }
  const tankGeo = (r, h) => {
    const t = r * .04, b = r * .12, pts = [];
    pts.push(new THREE.Vector2(0, 0));
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
    return new THREE.LatheGeometry(pts, 128);
  };
  const FW = 512;
  const flowData = new Uint8Array(FW * 4), flowTex = new THREE.DataTexture(flowData, FW, 1, THREE.RGBAFormat);
  flowTex.magFilter = flowTex.minFilter = THREE.LinearFilter;
  flowTex.needsUpdate = true;
  const shared = {
    uTime: clock,
    uFlow: {
      value: flowTex
    },
    uCols: {
      value: KEYS.map(k => new THREE.Color(HEX[k]))
    }
  };
  const pipeMat = (mode, col) => new THREE.ShaderMaterial({
    vertexShader: PIPE_VERT,
    fragmentShader: PIPE_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...shared,
      uMode: {
        value: mode
      },
      uCol: {
        value: new THREE.Color(col)
      },
      uSeg: {
        value: new THREE.Vector2
      },
      uRun: {
        value: .1
      },
      uDir: {
        value: 1
      },
      uL: {
        value: 1
      },
      uSpd: {
        value: 0
      }
    }
  });
  const pipe = new THREE.Mesh(new THREE.BufferGeometry, pipeMat(0, 16777215));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), pipeMat(1, 16777215));
  pipe.renderOrder = cap.renderOrder = 3;
  scene.add(pipe, cap);
  const spouts = {};
  for (const k of KEYS.slice(1)) {
    const m = new THREE.Mesh(new THREE.BufferGeometry, pipeMat(1, HEX[k]));
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.5, .4, 1, 24, 8, true).translate(0, -.5, 0), pipeMat(2, HEX[k]));
    m.renderOrder = 3;
    st.renderOrder = 4;
    st.visible = false;
    scene.add(m, st);
    spouts[k] = {
      m,
      st
    };
  }
  const dips = {};
  for (const k of KEYS.slice(1)) {
    const m = new THREE.Mesh(new THREE.BufferGeometry, pipeMat(1, HEX[k]));
    m.renderOrder = 3;
    m.visible = false;
    scene.add(m);
    dips[k] = m;
  }
  let sources = new Set;
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
    sources = new Set(steps.filter(s => s.a !== "B").map(s => s.a));
    for (const k of KEYS.slice(1)) dips[k].visible = sources.has(k) && !flDead;
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
  let G = null;
  const ray = new THREE.Raycaster, ndc = new THREE.Vector2, ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3, v3 = new THREE.Vector3;
  const onFloor = (px, py, w, h) => {
    ndc.set(px / w * 2 - 1, -(py / h) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    return ray.ray.intersectPlane(ground, hit) ? hit.clone() : null;
  };
  const toPx = (p, w, h) => {
    v3.copy(p).project(cam);
    return [ (v3.x + 1) / 2 * w, (1 - v3.y) / 2 * h ];
  };
  function resize({w, h, top, bottom, centers, cellW}) {
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    const colW = Math.max(22, Math.min(cellW * (cellW < 90 ? .72 : .6), 150)), base = bottom - 18;
    const pB = onFloor(centers.B, base, w, h), pE = onFloor(centers.B + colW / 2, base, w, h);
    if (!pB || !pE) {
      console.error("[tracker] the tanks found no floor under the figures");
      return;
    }
    const z = pB.z, r = Math.abs(pE.x - pB.x);
    const X = {};
    for (const k of KEYS) X[k] = onFloor(centers[k], base, w, h).x;
    const pr = r * PIPE_R, tipUp = r * .07, spoutL = r * .2, pipeOver = H => H + tipUp + spoutL + pr;
    const highest = H => Math.min(toPx(new THREE.Vector3(X.M, pipeOver(H) + pr, z), w, h)[1], toPx(new THREE.Vector3(X.B, H, z - r), w, h)[1]);
    let lo = 0, hi = 60;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (highest(m) > top + 8) lo = m; else hi = m;
    }
    const H = Math.max(r * 1.2, Math.min(lo, r * 7)), b = r * .12, cap0 = Math.max(1, finalTaken() * 1.06), per = (H - b) * .96 / cap0;
    const inner = r * .955;
    for (const k of KEYS) {
      const T = tanks[k];
      T.g.position.set(X[k], 0, z);
      T.glass.geometry.dispose();
      T.glass.geometry = tankGeo(r, H);
      for (const m of [ T.body, T.surf, T.rBody, T.rSurf ]) m.scale.set(inner, 1, inner);
      T.mark.scale.set(r * 1.004, 1, r * 1.004);
      T.shadow.scale.set(r * 3.2, 1, r * 3.2);
      T.pool.scale.set(r * 5, 1, r * 5);
      for (const m of [ T.body, T.surf, T.rBody, T.rSurf ]) m.position.y = b;
      for (const m of T.mats) {
        m.uniforms.uBase.value = b;
        m.uniforms.uTop.value = H;
        m.uniforms.uMax.value = H - b - r * .02;
        m.uniforms.uFade.value = r * .22;
      }
    }
    floorU.uStage.value.set((X.B + X.X) / 2, z, (X.X - X.B) * .75 + r * 3, r * 4.5);
    const yP = pipeOver(H), yF = b + r * BORE, xr = (X.B + r + X.M - r) / 2, x0 = X.B + inner * .95, bend = r * BEND;
    const rb1 = Math.min(bend, .45 * (xr - x0), .45 * (yP - yF)), rb = Math.min(bend, .45 * (yP - yF), .45 * (X.M - xr));
    const V = (x, y) => new THREE.Vector3(x, y, z), xEnd = X.X + r * DIP + pr * 1.2;
    const path = new THREE.CurvePath;
    path.add(new THREE.LineCurve3(V(x0, yF), V(xr - rb1, yF)));
    path.add(new THREE.QuadraticBezierCurve3(V(xr - rb1, yF), V(xr, yF), V(xr, yF + rb1)));
    path.add(new THREE.LineCurve3(V(xr, yF + rb1), V(xr, yP - rb)));
    path.add(new THREE.QuadraticBezierCurve3(V(xr, yP - rb), V(xr, yP), V(xr + rb, yP)));
    path.add(new THREE.LineCurve3(V(xr + rb, yP), V(xEnd, yP)));
    const lens = path.getCurveLengths(), total = lens[lens.length - 1], before = lens[3];
    pipe.geometry.dispose();
    pipe.geometry = new THREE.TubeGeometry(path, 600, pr, 24, false);
    cap.position.copy(V(xEnd, yP));
    cap.scale.setScalar(pr);
    const dipLo = b + r * .2;
    for (const k of KEYS.slice(1)) {
      dips[k].geometry.dispose();
      dips[k].geometry = new THREE.TubeGeometry(new THREE.LineCurve3(V(X[k] + r * DIP, dipLo), V(X[k] + r * DIP, yP)), 8, pr, 20, false);
    }
    pipe.material.uniforms.uL.value = total / (r * .5);
    pipe.material.uniforms.uSpd.value = FLOW_U;
    const uOf = x => x <= xr ? 0 : (before + (x - xr - rb)) / total;
    const tipY = H + tipUp, spoutLen = yP - tipY;
    for (const k of KEYS.slice(1)) {
      const S = spouts[k], u = S.m.material.uniforms, us = S.st.material.uniforms;
      S.m.geometry.dispose();
      S.m.geometry = new THREE.TubeGeometry(new THREE.LineCurve3(V(X[k], yP), V(X[k], tipY)), 4, pr, 20, false);
      u.uL.value = spoutLen / (r * .5);
      u.uSpd.value = 1 / SPOUT_T;
      u.uRun.value = pr * 1.5 / spoutLen;
      S.st.position.set(X[k], tipY, z);
      S.st.scale.set(pr * .85, 1, pr * .85);
      us.uL.value = 1 / (r * .5);
      us.uSpd.value = H * 2;
    }
    const ticks = [];
    for (let bb = 1; bb * 1e9 <= cap0; bb++) ticks.push({
      y: toPx(new THREE.Vector3(X.B - r, b + bb * 1e9 * per, z), w, h)[1],
      b: bb
    });
    const left = toPx(new THREE.Vector3(X.B - r, 0, z), w, h)[0];
    G = {
      w,
      h,
      X,
      z,
      r,
      H,
      per,
      b,
      cap: cap0,
      ticks,
      axisX: Math.max(2, left - 52),
      x: {},
      colW,
      uOf,
      tipY,
      inner,
      pr,
      ramp: pr * 2.5 / total,
      rimPx: toPx(new THREE.Vector3(X.B, H, z - r), w, h)[1],
      floorPx: toPx(new THREE.Vector3(X.B, 0, z + r), w, h)[1]
    };
    for (const k of KEYS) G.x[k] = centers[k] - colW / 2;
    G.geo = {
      X: KEYS.map(k => X[k] / r),
      rin: inner / r,
      b: b / r,
      H: H / r,
      d: D_SPACE,
      pin: BORE,
      pout: PIPE_R,
      yF: yF / r,
      xr: xr / r,
      yP: yP / r,
      tipY: tipY / r,
      dip: DIP,
      dipLo: dipLo / r,
      bend: BEND,
      hpd: per * DROP / r
    };
    if (liq) {
      liq.layout({
        rect: [ X.B - r * 1.1, 0, xEnd + r * .2, yP + pr + r * .15 ],
        r,
        rp: RP
      });
      const R = liq.rect;
      inkPlane.position.set(R.x, R.y, z);
      inkPlane.scale.set(R.z - R.x, R.w - R.y, 1);
      inkShared.uInkRect.value.copy(R);
      inkShared.uInkTx.value.set(...liq.texel);
      profS.value = r;
    }
    fluidSetup();
    clear(true);
  }
  function fluidOff(why, e) {
    console.error("[tracker] the liquid simulation stopped (" + why + "); drawing the simple flow instead", e || "");
    flDead = true;
    if (fl) {
      try {
        fl.w.terminate();
      } catch {}
      fl = null;
    }
    inkPlane.visible = false;
    inkShared.uInkOn.value = 0;
    for (const k of KEYS.slice(1)) dips[k].visible = false;
    clear(true);
  }
  function fluidSetup() {
    if (flDead || !G) return;
    if (!fl) {
      const ok = renderer.capabilities.isWebGL2 && (renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float"));
      if (!ok || typeof Worker === "undefined") {
        fluidOff(ok ? "no workers" : "no float targets");
        return;
      }
      let w;
      try {
        w = new Worker(new URL("./fluid.js?v=4", import.meta.url));
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
        pendAtStep: 0,
        sentAt: 0,
        counts: new Float64Array(6),
        pos: null,
        col: null,
        back: 0,
        progressAt: 0,
        stuck: false
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
        fl.pendAtStep = 0;
        if (m.epoch !== fl.epoch) return;
        fl.state = m;
        fl.ppd = m.ppd;
        for (let k = 0; k < 6; k++) fl.counts[k] = m.counts[k];
        dAlloc(m.np);
        dGeo.attributes.position.array.set(m.pos.subarray(0, m.np * 3));
        dGeo.attributes.aCol.array.set(m.col.subarray(0, m.np * 3));
        dGeo.attributes.aVel.array.set(m.vel.subarray(0, m.np * 3));
        for (let k = 0; k < 6; k++) for (let i = 0; i < 16; i++) {
          const at = j => m.prof[k * 16 + Math.max(0, Math.min(15, j))];
          profT[k][i] = (at(i - 1) + 2 * at(i) + at(i + 1)) / 4;
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
    for (const k of KEYS.slice(1)) dips[k].visible = sources.has(k);
    fl.resync = true;
  }
  function dataCounts(t) {
    const L = levelsAt(t), ft = finalTaken();
    return KEYS.map(k => Math.max(0, k === "B" ? ft - L.B : L[k]) / DROP);
  }
  function fluidSync(t) {
    fl.epoch++;
    fl.resync = false;
    fl.carry.clear();
    fl.pend = 0;
    fl.pendAtStep = 0;
    fl.state = null;
    fl.progressAt = performance.now();
    const c = dataCounts(t);
    for (let k = 0; k < 6; k++) fl.counts[k] = c[k];
    fl.w.postMessage({
      type: "counts",
      counts: c
    });
    dGeo.setDrawRange(0, 0);
  }
  function pace() {
    if (!fl || flDead) return 1;
    if (fl.stuck) return 1;
    return Math.max(0, Math.min(1, (PACE_HI - fl.back * (fl.ppd || 1)) / (PACE_HI - PACE_LO)));
  }
  const flowP = new Float32Array(FW), flowF = new Float32Array(FW), flowC = new Uint8Array(FW), flowD = new Uint8Array(FW);
  const pulses = [];
  function advance(t0, t1, keep, now) {
    if (!G || reduced) return;
    const groups = new Map;
    for (let i = idxAt(t0) + 1; i < steps.length && steps[i].t <= t1; i++) {
      const s = steps[i];
      if (keep && !keep(s)) continue;
      const k = s.a + s.b;
      groups.set(k, (groups.get(k) || 0) + s.v);
    }
    if (fl) {
      if (fl.resync) fluidSync(t0);
      for (const [k, v] of groups) {
        const a = KEYS.indexOf(k[0]), b = KEYS.indexOf(k[1]);
        if (a === b || b <= 0) continue;
        const c = (fl.carry.get(k) || 0) + v / DROP, n = Math.floor(c);
        fl.carry.set(k, c - n);
        if (n < 1) continue;
        fl.w.postMessage({
          type: "pump",
          a,
          b,
          n
        });
        fl.lastPump = now;
        fl.pend += n;
        tanks[k[0]].ripple = Math.min(1, tanks[k[0]].ripple + .05 + Math.log10(1 + n) * .08);
      }
      return;
    }
    for (const [k, v] of groups) {
      const a = k[0], b = k[1];
      if (v < 2e5 || a === b || !spouts[b]) continue;
      let last = null;
      for (let i = pulses.length - 1; i >= 0 && !last; i--) if (pulses[i].a === a && pulses[i].b === b) last = pulses[i];
      if (last && now - last.born < 150) {
        last.amt += v;
        last.dur = durOf(last.amt);
        continue;
      }
      pulses.push({
        a,
        b,
        amt: v,
        dur: durOf(v),
        born: now,
        landed: false
      });
      const ta = tanks[a], s = Math.log10(1 + v / 1e7);
      ta.vx += G.r * s * .3;
      ta.ripple = Math.min(1, ta.ripple + .1 + s * .15);
    }
    if (pulses.length > 200) pulses.splice(0, pulses.length - 200);
  }
  const fallD = t => t <= 0 ? 0 : G.H * (.8 * t + 2.5 * t * t);
  const fallT = d => (-.8 + Math.sqrt(.64 + 10 * Math.max(0, d) / G.H)) / 5;
  function where(p, age) {
    const ua = p.a === "B" ? 0 : G.uOf(G.X[p.a]), ub = G.uOf(G.X[p.b]), span = Math.abs(ub - ua), dir = ub >= ua ? 1 : -1;
    const d0 = p.a === "B" ? 0 : SPOUT_T, tA = d0 + span / FLOW_U, tTip = tA + SPOUT_T;
    const cl = x => Math.max(0, Math.min(1, x));
    const head = ua + dir * Math.min(span, FLOW_U * Math.max(0, age - d0));
    const tail = ua + dir * Math.min(span, FLOW_U * Math.max(0, age - d0 - p.dur));
    const surf = G.b + Math.max(0, tanks[p.b].shown) * G.per, drop = Math.max(0, G.tipY - surf), tLand = tTip + fallT(drop);
    return {
      ua,
      dir,
      head,
      tail,
      solidTail: age < d0 + p.dur,
      moving: age < tA,
      inSeg: [ cl((age - tA - p.dur) / SPOUT_T), cl((age - tA) / SPOUT_T) ],
      outSeg: p.a === "B" ? null : [ 1 - cl(age / SPOUT_T), 1 - cl((age - p.dur) / SPOUT_T) ],
      bot: G.tipY - Math.min(drop, fallD(age - tTip)),
      top: G.tipY - Math.min(drop, fallD(age - tTip - p.dur)),
      streaming: age > tTip,
      left: cl(age / p.dur),
      arrived: cl((age - tLand) / p.dur),
      landing: age >= tLand,
      done: age > tLand + p.dur + .05
    };
  }
  function clear(snap) {
    pulses.length = 0;
    if (fl) fl.resync = true;
    for (const k of KEYS) {
      tanks[k].inflow = 0;
      tanks[k].ripple = 0;
      if (snap) tanks[k].snap = true;
    }
  }
  let lastNow = 0, grav = 0;
  function tilt(deg) {
    if (!G || reduced || !isFinite(deg)) return;
    grav = Math.max(-.9, Math.min(.9, Math.tan(Math.max(-60, Math.min(60, deg)) * Math.PI / 180))) * G.inner;
    if (fl) fl.w.postMessage({
      type: "grav",
      ang: Math.max(-60, Math.min(60, deg)) * Math.PI / 180
    });
  }
  function tankAt(px, py) {
    if (!G || py < G.rimPx - 24 || py > G.floorPx + 12) return null;
    for (const k of KEYS) {
      const off = (px - (G.x[k] + G.colW / 2)) / (G.colW / 2);
      if (Math.abs(off) <= 1.15) return {
        k,
        off
      };
    }
    return null;
  }
  function poke(px, py) {
    const h = reduced ? null : tankAt(px, py);
    if (h) {
      const {k, off} = h, T = tanks[k];
      T.vx += (off >= 0 ? -1 : 1) * G.r * (2.4 + 1.6 * Math.min(1, Math.abs(off)));
      T.vz += G.r * 1.4 * (Math.random() - .5);
      T.ripple = Math.min(1, T.ripple + .7);
      if (fl && !fl.resync) fl.w.postMessage({
        type: "poke",
        k: KEYS.indexOf(k),
        dir: off >= 0 ? -1 : 1,
        n: 14
      });
      return k;
    }
    return null;
  }
  function frame(now, t) {
    if (!G) return;
    const dt = Math.min(.05, lastNow ? (now - lastNow) / 1e3 : .016);
    lastNow = now;
    clock.value = reduced ? 0 : now / 1e3;
    const L = levelsAt(t), ft = finalTaken();
    const ages = pulses.map(p => (now - p.born) / 1e3), at = pulses.map((p, i) => where(p, ages[i]));
    const notOut = {
      B: 0,
      M: 0,
      F: 0,
      V: 0,
      R: 0,
      X: 0
    }, notIn = {
      B: 0,
      M: 0,
      F: 0,
      V: 0,
      R: 0,
      X: 0
    };
    pulses.forEach((p, i) => {
      notOut[p.a] += p.amt * (1 - at[i].left);
      notIn[p.b] += p.amt * (1 - at[i].arrived);
    });
    const target = {
      B: Math.max(0, ft - L.B),
      M: L.M,
      F: L.F,
      V: L.V,
      R: L.R,
      X: L.X
    };
    for (const k of KEYS) target[k] += notOut[k] - notIn[k];
    if (fl) fluidFrame(now, t, dt, target);
    for (const k of KEYS) {
      const T = tanks[k], goal = Math.max(0, target[k]);
      if (T.snap || reduced) {
        T.shown = goal;
        T.vel = 0;
        T.snap = false;
      } else {
        T.vel += ((goal - T.shown) * 22 - T.vel * 8.5) * dt;
        T.shown += T.vel * dt;
        if (Math.abs(goal - T.shown) < 1e4 && Math.abs(T.vel) < 1e5) T.shown = goal;
      }
      T.ripple *= Math.exp(-dt * .8);
      T.inflow *= Math.exp(-dt * 1.1);
      const hgt = Math.max(0, T.shown) * G.per, has = hgt > G.r * .01;
      T.body.visible = T.surf.visible = T.rBody.visible = T.rSurf.visible = has;
      if (reduced) {
        T.sx = T.sz = T.vx = T.vz = 0;
      } else {
        T.vx += (-(T.sx - grav) * 40 - T.vx * 1.3) * dt;
        T.vz += (-T.sz * 40 - T.vz * 1.3) * dt;
        T.sx += T.vx * dt;
        T.sz += T.vz * dt;
        const room = G.H - G.b - hgt, lim = Math.max(G.r * .02, Math.min(G.r * .9, hgt * .9, room * .9)), s = Math.hypot(T.sx, T.sz);
        if (s > lim) {
          T.sx *= lim / s;
          T.sz *= lim / s;
        }
      }
      const amp = reduced ? 0 : (.3 + 2.6 * T.ripple) * G.r * Math.min(1, hgt / (G.r * .3));
      for (const m of T.mats) {
        const u = m.uniforms;
        u.uAmp.value = amp;
        u.uGlow.value = T.inflow;
        u.uH.value = hgt;
        u.uSlope.value.set(T.sx, T.sz);
      }
      if (k === "B") T.mark.position.y = G.b + ft * G.per;
      T.pool.material.opacity = has ? Math.min(.32, .05 + hgt / G.H * .3 + T.inflow * .12) : 0;
    }
    flowP.fill(0);
    flowF.fill(0);
    flowC.fill(0);
    flowD.fill(1);
    const segs = {}, falls = {};
    const ramp = G.ramp, ix = u => Math.max(0, Math.min(FW - 1, Math.round(u * (FW - 1))));
    const join = (k, s, dir) => {
      if (s[1] <= s[0]) return;
      const o = segs[k];
      segs[k] = o ? {
        s: [ Math.min(o.s[0], s[0]), Math.max(o.s[1], s[1]) ],
        dir: o.dir
      } : {
        s,
        dir
      };
    };
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i], w = at[i];
      if (w.done) {
        pulses.splice(i, 1);
        continue;
      }
      const ci = KEYS.indexOf(p.b), s = Math.log10(1 + p.amt / 1e7);
      const j0 = ix(Math.min(w.head, w.tail, w.ua) - ramp * 2), j1 = ix(Math.max(w.head, w.tail, w.ua) + ramp * 2);
      for (let j = j0; j <= j1; j++) {
        const u = j / (FW - 1), dHead = (w.head - u) * w.dir, dTail = w.solidTail ? (u - w.ua) * w.dir + ramp : (u - w.tail) * w.dir;
        const d = Math.min(dHead, dTail);
        if (d <= 0) continue;
        const pr = Math.min(1, d / ramp);
        if (pr > flowP[j]) {
          flowP[j] = pr;
          flowC[j] = ci;
          flowD[j] = w.dir > 0 ? 1 : 0;
        }
        if (w.moving) flowF[j] = Math.max(flowF[j], Math.exp(-dHead / (ramp * 2.5)) * pr);
      }
      join(p.b, w.inSeg, 1);
      if (w.outSeg) join(p.a, [ w.outSeg[0], w.outSeg[1] ], -1);
      if (w.streaming && w.top > w.bot) {
        const f = falls[p.b];
        falls[p.b] = f ? {
          top: Math.max(f.top, w.top),
          bot: Math.min(f.bot, w.bot),
          s: Math.max(f.s, s)
        } : {
          top: w.top,
          bot: w.bot,
          s
        };
      }
      const T = tanks[p.b];
      if (w.landing && !p.landed) {
        p.landed = true;
        T.vz += G.r * (.3 + s * .4);
        T.ripple = Math.min(1, T.ripple + .25 + s * .3);
      }
      if (w.landing && w.arrived < 1) {
        T.inflow = Math.max(T.inflow, Math.min(1, .35 + s * .35));
        T.ripple = Math.max(T.ripple, Math.min(.8, .2 + s * .25));
      }
    }
    if (fl) drawDrops(dt, now);
    for (let j = 0; j < FW; j++) {
      flowData[j * 4] = flowP[j] * 255;
      flowData[j * 4 + 1] = flowF[j] * 255;
      flowData[j * 4 + 2] = flowC[j] / 5 * 255;
      flowData[j * 4 + 3] = flowD[j] * 255;
    }
    flowTex.needsUpdate = true;
    for (const k of KEYS.slice(1)) {
      const S = spouts[k], u = S.m.material.uniforms, sg = segs[k], f = falls[k];
      u.uSeg.value.set(sg ? sg.s[0] : 0, sg ? sg.s[1] : 0);
      u.uDir.value = sg ? sg.dir : 1;
      S.st.visible = !!f;
      if (f) {
        const th = G.pr * (.95 + .4 * Math.min(1, f.s / 2));
        S.st.position.y = f.top;
        S.st.scale.set(th, Math.max(.001, f.top - f.bot), th);
      }
    }
    const BA = bandsAt(t), bands = [];
    for (const k of KEYS) {
      const v = L[k];
      if (v < 5e5) continue;
      const list = BANDS.map((b, i) => [ BAND_NAME[b], BA[k][i] ]).filter(([, x]) => x > 5e5).sort((a, b) => b[1] - a[1]);
      const topY = toPx(new THREE.Vector3(G.X[k], G.b + (k === "B" ? ft : Math.max(0, tanks[k].shown)) * G.per, G.z), G.w, G.h)[1];
      const botY = toPx(new THREE.Vector3(G.X[k], 0, G.z + G.r), G.w, G.h)[1];
      bands.push({
        k,
        band: null,
        list,
        v,
        x: G.x[k],
        w: G.colW,
        y0: Math.min(topY, botY - 12) - 10,
        y1: botY
      });
    }
    return {
      L,
      shown: Object.fromEntries(KEYS.map(k => [ k, tanks[k].shown ])),
      bands,
      flying: fl ? fl.back : pulses.length
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
    const back = (s ? s.n + s.queued : 0) + fl.pend;
    const gap = now - (fl.frameAt || now);
    fl.frameAt = now;
    if (gap > 500) fl.progressAt += gap;
    let landed = false;
    if (s && s !== fl.seen) {
      fl.seen = s;
      for (let k = 0; k < 6; k++) if (s.hits[k * 2]) landed = true;
    }
    if (back < fl.back || landed || s && s.n !== fl.lastN) fl.progressAt = now;
    fl.back = back;
    fl.lastN = s ? s.n : 0;
    if (back > 0 && now - fl.progressAt > 4e3) {
      if (!fl.stuck) console.error("[tracker] the liquid has not moved for 4 s with " + back + " drops on their way");
      fl.stuck = true;
    } else fl.stuck = false;
    if (s && !s.n && !s.queued && !fl.pend && now - fl.lastPump > 400) {
      const want = KEYS.map(k => Math.max(0, target[k]) / DROP);
      for (let k = 0; k < 6; k++) {
        const d = want[k] - fl.counts[k];
        if (Math.abs(d) > .001) {
          fl.w.postMessage({
            type: "adjust",
            k,
            n: d
          });
          fl.counts[k] = want[k];
          fl.carry.clear();
        }
      }
    }
    for (let k = 0; k < 6; k++) {
      const T = tanks[KEYS[k]];
      target[KEYS[k]] = fl.counts[k] * DROP;
      if (s && s.hits[k * 2]) {
        const n = s.hits[k * 2], v = s.hits[k * 2 + 1] / n;
        T.ripple = Math.min(1, T.ripple + n * .003 * Math.min(2, v / 6));
        T.inflow = Math.max(T.inflow, Math.min(1, .25 + n * .04));
        T.vz += G.r * .02 * Math.min(4, n) * (Math.random() - .5);
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
    for (let k = 0; k < 6; k++) {
      const P = profU[k].value, T = profT[k];
      for (let i = 0; i < 16; i++) P[i] += (T[i] - P[i]) * e;
    }
  }
  return {
    scene,
    cam,
    setSteps,
    levelsAt,
    bandsAt,
    advance,
    clear: () => clear(false),
    frame,
    finalTaken,
    resize,
    poke,
    tilt,
    hit: (px, py) => tankAt(px, py)?.k || null,
    pace,
    get fluid() {
      return fl ? {
        on: true,
        back: fl.back,
        counts: Array.from(fl.counts),
        n: fl.state ? fl.state.n : 0,
        np: fl.state ? fl.state.np : 0,
        full: fl.back * (fl.ppd || 1) >= PACE_HI,
        queued: fl.state ? fl.state.queued : 0,
        ms: fl.state ? fl.state.ms : 0,
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
    bump(s) {
      if (reduced) return;
      for (const k of [ "B", "M" ]) tanks[k].ripple = Math.min(1, tanks[k].ripple + s * .08);
    }
  };
}
