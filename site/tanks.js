import * as THREE from "three";

export const DOT = 1e6;

export const COLS = [ "B", "M", "F", "V", "R", "X" ];

const HEX = {
  B: 15970874,
  M: 16727347,
  F: 9426687,
  R: 4186255,
  X: 9279398,
  V: 14015460
};

const KEYS = [ "B", "M", "F", "V", "R", "X" ];

const CAP = 16e3;

const VERT = `\nattribute vec3 aCol; attribute float aA; attribute float aSize;\nuniform float uDpr;\nvarying vec3 vCol; varying float vA;\nvoid main() {\n  vCol = aCol; vA = aA;\n  gl_PointSize = aSize * uDpr;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n}`;

const FRAG = `\nvarying vec3 vCol; varying float vA;\nvoid main() {\n  vec2 d = gl_PointCoord - 0.5;\n  float r = length(d);\n  if (r > 0.5) discard;\n  float g = smoothstep(0.5, 0.18, r);\n\n  gl_FragColor = vec4(pow(vCol, vec3(2.2)) * g, vA * g);\n}`;

export function makeTanks({reduced}) {
  const scene = new THREE.Scene;
  const cam = new THREE.OrthographicCamera(0, 100, 0, 100, -10, 10);
  cam.position.z = 5;
  const geo = new THREE.BufferGeometry;
  const pos = new Float32Array(CAP * 3), col = new Float32Array(CAP * 3), alpha = new Float32Array(CAP), size = new Float32Array(CAP);
  const attr = (k, a, n) => {
    const b = new THREE.BufferAttribute(a, n);
    b.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(k, b);
    return b;
  };
  const aPos = attr("position", pos, 3), aCol = attr("aCol", col, 3), aA = attr("aA", alpha, 1), aS = attr("aSize", size, 1);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3, 1e6);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uDpr: {
        value: 1
      }
    }
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 2;
  scene.add(points);
  const lineMat = (c, o) => new THREE.LineBasicMaterial({
    color: c,
    transparent: true,
    opacity: o,
    depthWrite: false,
    depthTest: false
  });
  const grid = new THREE.LineSegments(new THREE.BufferGeometry, lineMat(16777215, .07));
  const base = new THREE.LineSegments(new THREE.BufferGeometry, lineMat(16777215, .22));
  const hole = new THREE.LineSegments(new THREE.BufferGeometry, lineMat(HEX.B, .75));
  const holeFill = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    color: HEX.B,
    transparent: true,
    opacity: .06,
    depthWrite: false,
    depthTest: false
  }));
  [ grid, base, holeFill, hole ].forEach(o => {
    o.frustumCulled = false;
    scene.add(o);
  });
  let steps = [], cumT = new Float64Array(0), cum = {};
  function setSteps(list) {
    steps = list;
    cumT = new Float64Array(steps.length);
    for (const k of KEYS) cum[k] = new Float64Array(steps.length);
    const run = {
      B: 0,
      M: 0,
      F: 0,
      V: 0,
      R: 0,
      X: 0
    };
    steps.forEach((s, i) => {
      if (s.a === "B") run.B += s.v; else run[s.a] -= s.v;
      run[s.b] += s.v;
      cumT[i] = s.t;
      for (const k of KEYS) cum[k][i] = run[k];
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
  function levelsAt(t) {
    const i = idxAt(t), L = {};
    for (const k of KEYS) L[k] = i < 0 ? 0 : cum[k][i];
    return L;
  }
  const finalTaken = () => cumT.length ? cum.B[cumT.length - 1] : 0;
  let G = null;
  function resize({w, h, dpr, top, bottom, centers, cellW}) {
    cam.left = 0;
    cam.right = w;
    cam.top = 0;
    cam.bottom = h;
    cam.updateProjectionMatrix();
    mat.uniforms.uDpr.value = dpr;
    const maxDots = Math.max(200, Math.ceil(finalTaken() * 1.04 / DOT));
    const band = Math.max(80, bottom - top), colMax = Math.min(cellW * .72, 210);
    let best = null;
    for (const per of [ 10, 20, 25, 40, 50 ]) {
      const rows = Math.ceil(maxDots / per), pitch = Math.min(colMax / per, band / rows);
      if (!best || pitch > best.pitch + .05) best = {
        per,
        pitch
      };
    }
    const per = best.per, pitch = Math.max(1, Math.floor(best.pitch * dpr)) / dpr, colW = per * pitch;
    const x = {};
    COLS.forEach(k => x[k] = Math.round((centers[k] - colW / 2) * dpr) / dpr);
    bottom = Math.round(bottom * dpr) / dpr;
    const pxPerB = 1e9 / DOT / per * pitch, stepB = pxPerB >= 44 ? .5 : 1;
    const ticks = [];
    for (let b = stepB; b * 1e9 <= maxDots * DOT && b * pxPerB <= bottom - top + 1; b += stepB) ticks.push({
      y: bottom - b * pxPerB,
      b
    });
    G = {
      w,
      h,
      base: bottom,
      top,
      per,
      pitch,
      x,
      colW,
      ticks,
      dpr,
      axisX: Math.max(2, x.B - 52)
    };
    const L = new Float32Array(ticks.length * 12);
    ticks.forEach((t, i) => L.set([ G.axisX + 34, t.y, 0, x.B - 3, t.y, 0, x.B + colW + 3, t.y, 0, w, t.y, 0 ], i * 12));
    grid.geometry.dispose();
    grid.geometry = new THREE.BufferGeometry;
    grid.geometry.setAttribute("position", new THREE.BufferAttribute(L, 3));
    base.geometry.dispose();
    base.geometry = (new THREE.BufferGeometry).setFromPoints([ new THREE.Vector3(G.axisX + 34, bottom + .5, 0), new THREE.Vector3(w, bottom + .5, 0) ]);
    flights.length = 0;
  }
  const slotXY = (k, j) => [ G.x[k] + (j % G.per + .5) * G.pitch, G.base - (Math.floor(j / G.per) + .5) * G.pitch ];
  const heightOf = v => v / DOT / G.per * G.pitch;
  const flights = [];
  const pend = {
    B: 0,
    M: 0,
    F: 0,
    V: 0,
    R: 0,
    X: 0
  };
  let seq = 0, carry = new Map;
  const rnd = (() => {
    let s = 99991;
    return () => {
      s = s * 1664525 + 1013904223 >>> 0;
      return s / 4294967296;
    };
  })();
  function advance(t0, t1, keep, now) {
    if (!G || reduced) return;
    let i = idxAt(t0) + 1;
    const groups = new Map;
    for (;i < steps.length && steps[i].t <= t1; i++) {
      const s = steps[i];
      if (keep && !keep(s)) continue;
      const k = s.a + s.b, c = (carry.get(k) || 0) + s.v / DOT, n = Math.floor(c);
      carry.set(k, c - n);
      if (n > 0) groups.set(k, (groups.get(k) || 0) + n);
    }
    for (const [k, n] of [ ...groups ]) {
      const r = k[1] + k[0], m = Math.min(n, groups.get(r) || 0);
      if (!m || !(k[1] === "V" || k[1] === "X")) continue;
      groups.set(k, n - m);
      groups.set(r, groups.get(r) - m);
      const o = k[0], from = levelsAt(t0)[o], c = Math.min(m, CAP - 6e3 - flights.length), spread = Math.min(2.6, .2 + c / 900);
      for (let j = 0; j < c; j++) {
        const [sx, sy] = slotXY(o, Math.max(0, Math.round(from / DOT) - 1 - j));
        flights.push({
          a: o,
          b: o,
          via: k[1],
          sx,
          sy,
          t0: now + j / c * spread * 1e3,
          dur: 1500 + rnd() * 700,
          seq: seq++
        });
      }
    }
    for (const [k, n0] of groups) {
      const a = k[0], b = k[1];
      const n = Math.min(n0, CAP - 6e3 - flights.length);
      if (n <= 0) continue;
      const spread = Math.min(2.6, .2 + n / 900);
      const from = levelsAt(t0)[a];
      for (let j = 0; j < n; j++) {
        let sx, sy;
        if (a === "B") [sx, sy] = slotXY("B", Math.round(from / DOT) + n - 1 - j); else [sx, sy] = slotXY(a, Math.max(0, Math.round(from / DOT) - 1 - j));
        flights.push({
          a,
          b,
          sx,
          sy,
          t0: now + j / n * spread * 1e3,
          dur: 900 + rnd() * 600,
          seq: seq++
        });
        pend[b]++;
      }
    }
  }
  function clear() {
    flights.length = 0;
    for (const k of KEYS) pend[k] = 0;
    carry.clear();
  }
  let shake = 0;
  const C = {};
  KEYS.forEach(k => C[k] = new THREE.Color(HEX[k]));
  const tmp = new THREE.Color;
  function frame(now, t) {
    if (!G) return;
    const L = levelsAt(t);
    let n = 0;
    const put = (x, y, c, a, s) => {
      pos[n * 3] = x;
      pos[n * 3 + 1] = y;
      pos[n * 3 + 2] = 0;
      col[n * 3] = c.r;
      col[n * 3 + 1] = c.g;
      col[n * 3 + 2] = c.b;
      alpha[n] = a;
      size[n] = s;
      n++;
    };
    const pd = G.pitch * G.dpr, gap = pd >= 5 ? Math.round(pd * .22) : pd >= 3 ? 1 : 0;
    const dot = (pd - gap) / G.dpr, fly = Math.max(dot, 2.4), clock = now / 1e3;
    for (const k of KEYS) pend[k] = 0;
    for (let i = flights.length - 1; i >= 0; i--) if (now >= flights[i].t0 + flights[i].dur) {
      flights.splice(i, 1);
    }
    for (const f of flights) pend[f.b]++;
    const shown = {};
    for (const k of [ "M", "F", "V", "R", "X" ]) shown[k] = Math.max(0, Math.round(L[k] / DOT) - pend[k]);
    shown.B = Math.max(0, Math.round(L.B / DOT));
    const nextSlot = {
      ...shown
    };
    for (const f of flights) {
      const p = (now - f.t0) / f.dur;
      let ex, ey;
      if (f.b === "B") {
        ex = f.sx;
        ey = f.sy;
      } else [ex, ey] = slotXY(f.b, nextSlot[f.b]++);
      if (p < 0) {
        put(f.sx, f.sy, C[f.a], .95, fly);
        continue;
      }
      let ax = f.sx, ay = f.sy, q = p, ca = C[f.a], cb = C[f.b];
      if (f.via) {
        const [vx, vy] = slotXY(f.via, shown[f.via]);
        if (p < .5) {
          ex = vx;
          ey = vy;
          q = p * 2;
          cb = C[f.via];
        } else {
          ax = vx;
          ay = vy;
          q = p * 2 - 1;
          ca = C[f.via];
        }
      }
      const e = q * q * (3 - 2 * q), u = 1 - e;
      const lift = 30 + .22 * Math.abs(ex - ax) + .15 * Math.abs(ey - ay);
      const cx = (ax + ex) / 2, cy = Math.min(ay, ey) - lift;
      const x = u * u * ax + 2 * u * e * cx + e * e * ex, y = u * u * ay + 2 * u * e * cy + e * e * ey;
      tmp.copy(ca).lerp(cb, e);
      put(x, y, tmp, .9, fly * (1 + .3 * Math.sin(q * Math.PI)));
      if (n >= CAP - 1) break;
    }
    const tw = k => k === "B" ? .45 : k === "F" ? .7 + .06 * Math.sin(clock * 1.3) : k === "X" ? .45 : .85;
    for (const k of [ "B", "M", "F", "V", "R", "X" ]) {
      const a0 = tw(k);
      for (let j = 0; j < shown[k] && n < CAP - 1; j++) {
        const [x, y] = slotXY(k, j);
        const a = k === "F" ? a0 + .05 * Math.sin(clock * 2.1 + j * 1.7) : a0;
        put(x, y, C[k], a, dot);
      }
    }
    geo.setDrawRange(0, n);
    aPos.needsUpdate = aCol.needsUpdate = aA.needsUpdate = aS.needsUpdate = true;
    const hB = heightOf(L.B), x0 = G.x.B, x1 = G.x.B + G.colW, y0 = G.base, y1 = G.base - hB;
    hole.geometry.dispose();
    hole.geometry = new THREE.BufferGeometry;
    hole.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([ x0, y0, 0, x0, y1, 0, x0, y1, 0, x1, y1, 0, x1, y1, 0, x1, y0, 0 ]), 3));
    holeFill.position.set((x0 + x1) / 2, (y0 + y1) / 2, 0);
    holeFill.scale.set(G.colW, Math.max(.01, hB), 1);
    if (shake > 0) {
      cam.position.x = (Math.random() - .5) * shake;
      cam.position.y = (Math.random() - .5) * shake;
      shake *= .9;
      if (shake < .05) {
        shake = 0;
        cam.position.x = cam.position.y = 0;
      }
    }
    return {
      L,
      shown,
      flying: flights.length
    };
  }
  return {
    scene,
    cam,
    setSteps,
    levelsAt,
    advance,
    clear,
    frame,
    finalTaken,
    resize,
    get layout() {
      return G;
    },
    get steps() {
      return steps;
    },
    bump(s) {
      if (!reduced) shake = Math.min(6, shake + s);
    }
  };
}
