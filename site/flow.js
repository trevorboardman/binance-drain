import * as THREE from "three";

export const DOT = 1e6;

export const COLS = [ "B", "M", "F", "V", "R", "X" ];

const KEYS = COLS;

const HEX = {
  B: 16747034,
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

const LIQ_VERT = `\nuniform float uTime, uAmp, uWave, uH, uMax;\nuniform vec2 uSlope;\nvarying vec3 vW, vN, vL;\nvoid main() {\n  vec3 p = position;\n\n  float lvl = clamp(uH + dot(uSlope, p.xz), 0.0, uMax);\n  if (uWave < 0.5) p.y = position.y * lvl;\n  else {\n    float rr = length(p.xz);\n    p.y = lvl + uAmp * (sin(rr * 11.0 - uTime * 5.0) * 0.55 + sin(p.x * 4.0 + uTime * 1.7) * 0.25 + sin(p.z * 5.0 - uTime * 2.1) * 0.2) * smoothstep(1.0, 0.6, rr) * 0.05;\n  }\n  vL = p;\n  vec4 w = modelMatrix * vec4(p, 1.0);\n  vW = w.xyz;\n  vN = normalize(mat3(modelMatrix) * normal);\n  gl_Position = projectionMatrix * viewMatrix * w;\n}`;

const LIQ_FRAG = `\nuniform vec3 uCol;\nuniform float uTime, uBase, uTop, uWave, uRefl, uFade, uGlow;\nvarying vec3 vW, vN, vL;\nvoid main() {\n  vec3 W = vW;\n  if (uRefl > 0.5) W.y = -W.y;\n  vec3 V = normalize(cameraPosition - vW);\n  vec3 N = uWave > 0.5 ? normalize(cross(dFdx(vW), dFdy(vW))) : normalize(vN);\n  if (dot(N, V) < 0.0) N = -N;\n  float ndv = max(dot(N, V), 0.0), fres = pow(1.0 - ndv, 3.0);\n  float h = clamp((W.y - uBase) / max(uTop - uBase, 1e-3), 0.0, 1.0);\n\n  vec3 c = mix(uCol * 0.2, uCol * 0.72, pow(h, 1.25));\n  float sw = sin(W.y * 5.0 + uTime * 0.55 + sin(W.x * 2.6 + uTime * 0.35) * 1.6) * 0.5 + 0.5;\n  c *= 0.82 + 0.36 * sw;\n\n  vec3 R = reflect(-V, N);\n  float boxes = smoothstep(0.62, 0.95, R.y) * 0.35 + smoothstep(0.86, 0.985, abs(R.x)) * (R.x < 0.0 ? 0.75 : 0.45);\n  c += vec3(0.85, 0.9, 1.0) * boxes * 0.35;\n  c += uCol * fres * (0.7 + 0.5 * uGlow);\n  if (uWave > 0.5) {\n    float rr = length(vL.xz);\n    c = mix(c, uCol * 1.05, 0.55);\n    c += mix(uCol, vec3(1.0), 0.35) * smoothstep(0.82, 0.99, rr) * (0.9 + uGlow);\n  }\n  float a = 1.0;\n  if (uRefl > 0.5) a = 0.11 * exp(vW.y / uFade);\n  gl_FragColor = vec4(c, a);\n}`;

const PIPE_VERT = `\nvarying vec2 vUv;\nvarying vec3 vW, vN;\nvoid main() {\n  vUv = uv;\n  vec4 w = modelMatrix * vec4(position, 1.0);\n  vW = w.xyz;\n  vN = normalize(mat3(modelMatrix) * normal);\n  gl_Position = projectionMatrix * viewMatrix * w;\n}`;

const PIPE_FRAG = `\nuniform float uTime, uLen, uConst, uStream;\nuniform sampler2D uFlow;\nuniform vec3 uCols[6];\nuniform vec3 uCol;\nvarying vec2 vUv;\nvarying vec3 vW, vN;\nvoid main() {\n  vec3 V = normalize(cameraPosition - vW), N = normalize(vN);\n  float ndv = abs(dot(N, V)), fres = pow(1.0 - ndv, 2.2);\n  float on, dir = 1.0;\n  vec3 ink;\n  if (uConst >= 0.0) { on = uConst; ink = uCol; }\n  else {\n    vec4 f = texture2D(uFlow, vec2(vUv.x, 0.5));\n    int ci = int(f.b * 5.0 + 0.5);\n    ink = uCols[0];\n    for (int i = 0; i < 6; i++) if (i == ci) ink = uCols[i];\n    on = max(f.r, f.g); dir = f.r >= f.g ? 1.0 : -1.0;\n  }\n  float x = vUv.x * uLen * dir - uTime * (1.4 + 3.0 * on);\n  float dash = smoothstep(0.15, 0.6, fract(x * 1.6)) * smoothstep(1.0, 0.7, fract(x * 1.6));\n  float core = smoothstep(0.25, 0.75, ndv);\n  float lit = on * (0.55 + 0.45 * dash) * core;\n  if (uStream > 0.5) {\n    float s = fract(vUv.y * 3.0 + uTime * 2.4 + sin(vUv.x * 6.2832 * 2.0 + uTime * 3.0) * 0.08);\n    lit = on * (0.72 + 0.28 * smoothstep(0.0, 0.5, s) * smoothstep(1.0, 0.5, s)) * smoothstep(0.05, 0.6, ndv);\n    gl_FragColor = vec4(ink * (1.1 + 1.4 * lit) + vec3(0.25) * fres * on, clamp(lit * 1.1, 0.0, 1.0));\n    return;\n  }\n  float hi = pow(max(N.y, 0.0), 10.0) * 0.55 + smoothstep(0.86, 0.98, abs(reflect(-V, N).x)) * 0.25;\n  vec3 glass = vec3(0.55, 0.62, 0.75) * fres * 0.55 + vec3(0.9, 0.94, 1.0) * hi;\n  vec3 c = glass + ink * lit * 2.2 + ink * on * 0.12;\n  float a = clamp(0.06 + fres * 0.6 + hi + lit * 0.95, 0.0, 1.0);\n  gl_FragColor = vec4(c, a);\n}`;

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
      }
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
    uLen: {
      value: 1
    },
    uFlow: {
      value: flowTex
    },
    uCols: {
      value: KEYS.map(k => new THREE.Color(HEX[k]))
    }
  };
  const pipeMat = (cnst, col, stream) => new THREE.ShaderMaterial({
    vertexShader: PIPE_VERT,
    fragmentShader: PIPE_FRAG,
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...shared,
      uConst: {
        value: cnst
      },
      uCol: {
        value: new THREE.Color(col)
      },
      uStream: {
        value: stream ? 1 : 0
      }
    }
  });
  const pipe = new THREE.Mesh(new THREE.BufferGeometry, pipeMat(-1, 16777215, false));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), pipeMat(0, 16777215, false));
  pipe.renderOrder = cap.renderOrder = 3;
  scene.add(pipe, cap);
  const spouts = {};
  for (const k of KEYS.slice(1)) {
    const m = new THREE.Mesh(new THREE.BufferGeometry, pipeMat(0, HEX[k], false));
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.5, .4, 1, 24, 8, true).translate(0, -.5, 0), pipeMat(0, HEX[k], true));
    m.renderOrder = 3;
    st.renderOrder = 4;
    st.visible = false;
    scene.add(m, st);
    spouts[k] = {
      m,
      st
    };
  }
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
    const colW = Math.max(22, Math.min(cellW * (cellW < 90 ? .8 : .6), 150)), base = bottom - 18;
    const pB = onFloor(centers.B, base, w, h), pE = onFloor(centers.B + colW / 2, base, w, h);
    if (!pB || !pE) {
      console.error("[tracker] the tanks found no floor under the figures");
      return;
    }
    const z = pB.z, r = Math.abs(pE.x - pB.x);
    const X = {};
    for (const k of KEYS) X[k] = onFloor(centers[k], base, w, h).x;
    const pr = r * .1, tipUp = r * .07, spoutL = r * .2, pipeOver = H => H + tipUp + spoutL + pr;
    const highest = H => Math.min(toPx(new THREE.Vector3(X.M, pipeOver(H) + pr, z), w, h)[1], toPx(new THREE.Vector3(X.B, H, z - r), w, h)[1]);
    let lo = 0, hi = 60;
    for (let i = 0; i < 40; i++) {
      const m = (lo + hi) / 2;
      if (highest(m) > top + 8) lo = m; else hi = m;
    }
    const H = Math.min(lo, r * 7), b = r * .12, cap0 = Math.max(1, finalTaken() * 1.06), per = (H - b) * .96 / cap0;
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
    const yP = pipeOver(H), yF = Math.max(b * .55, pr * 1.25), xr = (X.B + r + X.M - r) / 2, rb = Math.min(pr * 2.4, (xr - X.B - r) * .8);
    const V = (x, y) => new THREE.Vector3(x, y, z);
    const path = new THREE.CurvePath;
    path.add(new THREE.LineCurve3(V(X.B + r * .4, yF), V(xr - rb, yF)));
    path.add(new THREE.QuadraticBezierCurve3(V(xr - rb, yF), V(xr, yF), V(xr, yF + rb)));
    path.add(new THREE.LineCurve3(V(xr, yF + rb), V(xr, yP - rb)));
    path.add(new THREE.QuadraticBezierCurve3(V(xr, yP - rb), V(xr, yP), V(xr + rb, yP)));
    path.add(new THREE.LineCurve3(V(xr + rb, yP), V(X.X + pr * 1.2, yP)));
    const lens = path.getCurveLengths(), total = lens[lens.length - 1], before = lens[3];
    pipe.geometry.dispose();
    pipe.geometry = new THREE.TubeGeometry(path, 600, pr, 24, false);
    cap.position.copy(V(X.X + pr * 1.2, yP));
    cap.scale.setScalar(pr);
    shared.uLen.value = total / (r * .9);
    const uOf = x => x <= xr ? 0 : (before + (x - xr - rb)) / total;
    const tipY = H + tipUp;
    for (const k of KEYS.slice(1)) {
      const S = spouts[k];
      S.m.geometry.dispose();
      S.m.geometry = new THREE.TubeGeometry(new THREE.LineCurve3(V(X[k], yP), V(X[k], tipY)), 4, pr * .62, 20, false);
      S.st.position.set(X[k], tipY, z);
      S.st.scale.set(pr * .85, 1, pr * .85);
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
      rimPx: toPx(new THREE.Vector3(X.B, H, z - r), w, h)[1],
      floorPx: toPx(new THREE.Vector3(X.B, 0, z + r), w, h)[1]
    };
    for (const k of KEYS) G.x[k] = centers[k] - colW / 2;
    clear(true);
  }
  const flowR = new Float32Array(FW), flowL = new Float32Array(FW), flowC = new Uint8Array(FW);
  const pulses = [];
  function advance(t0, t1, keep, now) {
    if (!G) return;
    const groups = new Map;
    for (let i = idxAt(t0) + 1; i < steps.length && steps[i].t <= t1; i++) {
      const s = steps[i];
      if (keep && !keep(s)) continue;
      const k = s.a + s.b;
      groups.set(k, (groups.get(k) || 0) + s.v);
    }
    for (const [k, v] of groups) {
      if (v < 2e5) continue;
      pulses.push({
        a: k[0],
        b: k[1],
        amt: v,
        born: now
      });
      if (reduced) continue;
      const tb = tanks[k[1]], ta = tanks[k[0]], s = Math.log10(1 + v / 1e7);
      tb.inflow = Math.min(1, tb.inflow + .3 + s * .3);
      tb.vz += G.r * s * .6;
      ta.vx += G.r * s * .3;
      tb.ripple = Math.min(1, tb.ripple + .2 + s * .3);
      ta.ripple = Math.min(1, ta.ripple + .1 + s * .15);
    }
    if (pulses.length > 200) pulses.splice(0, pulses.length - 200);
  }
  function clear(snap) {
    pulses.length = 0;
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
  }
  function poke(px, py) {
    if (!G || reduced || py < G.rimPx - 24 || py > G.floorPx + 12) return null;
    for (const k of KEYS) {
      const x0 = G.x[k], off = (px - (x0 + G.colW / 2)) / (G.colW / 2);
      if (Math.abs(off) > 1.15) continue;
      const T = tanks[k];
      T.vx += (off >= 0 ? -1 : 1) * G.r * (2.4 + 1.6 * Math.min(1, Math.abs(off)));
      T.vz += G.r * 1.4 * (Math.random() - .5);
      T.ripple = Math.min(1, T.ripple + .7);
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
    const target = {
      B: Math.max(0, ft - L.B),
      M: L.M,
      F: L.F,
      V: L.V,
      R: L.R,
      X: L.X
    };
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
      if (k !== "B") {
        const S = spouts[k], on = reduced ? 0 : T.inflow;
        S.m.material.uniforms.uConst.value = on;
        S.st.visible = on > .03;
        S.st.scale.y = Math.max(.001, G.tipY - (G.b + hgt));
        S.st.material.uniforms.uConst.value = on;
      }
    }
    flowR.fill(0);
    flowL.fill(0);
    flowC.fill(0);
    const ix = u => Math.max(0, Math.min(FW - 1, Math.round(u * (FW - 1))));
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i], age = (now - p.born) / 1e3, life = 2.6;
      if (age > life) {
        pulses.splice(i, 1);
        continue;
      }
      if (reduced) continue;
      const k = Math.min(1, .4 + Math.log10(1 + p.amt / 1e7) * .3) * (1 - age / life) * Math.min(1, age * 5);
      const ua = p.a === "B" ? 0 : G.uOf(G.X[p.a]), ub = G.uOf(G.X[p.b]);
      const xa = ix(ua), xb = ix(ub), right = xb > xa, ci = KEYS.indexOf(p.b);
      for (let j = Math.min(xa, xb); j <= Math.max(xa, xb); j++) {
        if (right) {
          if (k > flowR[j]) {
            flowR[j] = k;
            flowC[j] = ci;
          }
        } else if (k > flowL[j]) {
          flowL[j] = k;
          flowC[j] = ci;
        }
      }
    }
    for (let j = 0; j < FW; j++) {
      flowData[j * 4] = flowR[j] * 255;
      flowData[j * 4 + 1] = flowL[j] * 255;
      flowData[j * 4 + 2] = flowC[j] / 5 * 255;
      flowData[j * 4 + 3] = 255;
    }
    flowTex.needsUpdate = true;
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
      flying: pulses.length
    };
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
    get layout() {
      return G;
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
