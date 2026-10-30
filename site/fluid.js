"use strict";

const NT = 6, PROF = 16;

const COL = [ [ .8, .333, 0 ], [ 1, .231, .188 ], [ .247, .698, 1 ], [ .604, .549, 1 ], [ .184, .839, .541 ], [ .49, .529, .6 ] ];

for (const c of COL) for (let i = 0; i < 3; i++) c[i] = c[i] <= .04045 ? c[i] / 12.92 : Math.pow((c[i] + .055) / 1.055, 2.4);

const G0 = 50, SUB = 1 / 120, VPUMP = 8, MAXRUN = 3e3;

const FLIP = .9, PITER = 60, OVER = 1.9, SEP = 5;

const MIX = 5;

const LAYER = .6;

const ff = new Float64Array(NT);

let geo = null, ox = 0, oy = 0;

let dfix, hc, ih, nX, nY, nC, u, v, du, dv, pu, pv, s, ctype, dens, rest = 0, wet, nWet = 0;

const FLUID = 0, AIR = 1, SOLID = 2;

let cap = 0, N = 0, rp, ppd, area;

let px, py, vx, vy, st, tk, rt, cs, age, fr, sg;

let gx = 0, gy = -G0;

const count = new Float64Array(NT), hits = new Float32Array(NT * 2), prof = new Float32Array(NT * PROF);

let routes = new Map, queue = [], active = null, live = new Set, liveKey = "";

const carryP = new Map;

let seed = 7;

const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;

function alloc(n) {
  if (n <= cap) return;
  const c = Math.ceil(n * 1.5) + 256;
  const grow = (a, A) => {
    const b = new A(c);
    if (a) b.set(a.subarray(0, N));
    return b;
  };
  px = grow(px, Float32Array);
  py = grow(py, Float32Array);
  vx = grow(vx, Float32Array);
  vy = grow(vy, Float32Array);
  st = grow(st, Uint8Array);
  tk = grow(tk, Uint8Array);
  rt = grow(rt, Int16Array);
  cs = grow(cs, Uint8Array);
  age = grow(age, Float32Array);
  fr = grow(fr, Uint8Array);
  sg = grow(sg, Int16Array);
  cap = c;
}

function add(x, y, ux, uy, tank) {
  alloc(N + 1);
  const i = N++;
  px[i] = x;
  py[i] = y;
  vx[i] = ux;
  vy[i] = uy;
  st[i] = 0;
  tk[i] = tank;
  rt[i] = -1;
  cs[i] = tank;
  age[i] = MIX;
  fr[i] = 0;
  sg[i] = 0;
  return i;
}

function remove(i) {
  const j = --N;
  if (i === j) return;
  px[i] = px[j];
  py[i] = py[j];
  vx[i] = vx[j];
  vy[i] = vy[j];
  st[i] = st[j];
  tk[i] = tk[j];
  rt[i] = rt[j];
  cs[i] = cs[j];
  age[i] = age[j];
  fr[i] = fr[j];
  sg[i] = sg[j];
}

const tankL = k => geo.X[k] - ox - geo.rin, tankR = k => geo.X[k] - ox + geo.rin, floorY = () => geo.b - oy, topY = () => geo.tipY + .3 - oy;

function route(a, b) {
  const key = a * 8 + b;
  if (routes.has(key)) return routes.get(key);
  const g = geo, X = g.X.map(x => x - ox), P = [];
  if (a === 0) P.push([ X[0] + g.rin * .8, g.yF - oy ], [ g.xr - ox, g.yF - oy ], [ g.xr - ox, g.yP - oy ]); else P.push([ X[a] + g.dip, g.dipLo - oy ], [ X[a] + g.dip, g.yP - oy ]);
  P.push([ X[b], g.yP - oy ], [ X[b], g.tipY - oy ]);
  const Q = [ P[0] ], len = i => Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
  for (let i = 1; i + 1 < P.length; i++) {
    const rc = Math.min(g.bend, .45 * len(i - 1), .45 * len(i)), [x, y] = P[i];
    const ax = (P[i - 1][0] - x) / len(i - 1), ay = (P[i - 1][1] - y) / len(i - 1), bx = (P[i + 1][0] - x) / len(i), by = (P[i + 1][1] - y) / len(i);
    for (let k = 0; k <= 6; k++) {
      const t = k / 6, w = 1 - t;
      Q.push([ w * w * (x + ax * rc) + 2 * w * t * x + t * t * (x + bx * rc), w * w * (y + ay * rc) + 2 * w * t * y + t * t * (y + by * rc) ]);
    }
  }
  Q.push(P[P.length - 1]);
  const seg = [];
  let L = 0;
  for (let i = 0; i + 1 < Q.length; i++) {
    const [x0, y0] = Q[i], [x1, y1] = Q[i + 1], l = Math.hypot(x1 - x0, y1 - y0);
    if (l < 1e-6) continue;
    seg.push({
      x0,
      y0,
      tx: (x1 - x0) / l,
      ty: (y1 - y0) / l,
      len: l,
      at: L
    });
    L += l;
  }
  const r = {
    key,
    a,
    b,
    seg,
    L,
    x0: Q[0][0],
    y0: Q[0][1],
    dir: Math.sign(X[b] - (a === 0 ? g.xr - ox : X[a] + g.dip)) || 1
  };
  routes.set(key, r);
  return r;
}

let cx = 0, cy = 0, ctx = 0, cty = 0, cArc = 0, ci = 0;

function nearest(R, x, y, i0) {
  let best = 1e9;
  const lo = i0 < 0 ? 0 : Math.max(0, i0 - 3), hi = i0 < 0 ? R.seg.length - 1 : Math.min(R.seg.length - 1, i0 + 3);
  for (let i = lo; i <= hi; i++) {
    const q = R.seg[i];
    let t = (x - q.x0) * q.tx + (y - q.y0) * q.ty;
    t = t < 0 ? 0 : t > q.len ? q.len : t;
    const qx = q.x0 + q.tx * t, qy = q.y0 + q.ty * t, d = (x - qx) ** 2 + (y - qy) ** 2;
    if (d <= best) {
      best = d;
      cx = qx;
      cy = qy;
      ctx = q.tx;
      cty = q.ty;
      cArc = q.at + t;
      ci = i;
    }
  }
  return Math.sqrt(best);
}

let pipeOpen;

function buildMask() {
  pipeOpen.fill(0);
  const rad = geo.pin + hc * .5;
  for (const key of live) {
    const R = routes.get(key);
    for (let i = 1; i < nX - 1; i++) for (let j = 1; j < nY - 1; j++) {
      if (pipeOpen[i * nY + j]) continue;
      if (nearest(R, (i + .5) * hc, (j + .5) * hc, -1) < rad) pipeOpen[i * nY + j] = 1;
    }
  }
}

function floors() {
  for (let k = 0; k < NT; k++) ff[k] = floorY() + Math.max(0, count[k] * geo.hpd - LAYER);
}

function applyMask() {
  for (let c = 0; c < nC; c++) s[c] = pipeOpen[c];
  for (let k = 0; k < NT; k++) {
    const i0 = Math.max(1, Math.floor(tankL(k) * ih)), i1 = Math.min(nX - 2, Math.ceil(tankR(k) * ih) - 1);
    const j0 = Math.max(1, Math.floor(ff[k] * ih)), j1 = Math.min(nY - 2, Math.ceil(topY() * ih) - 1);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) s[i * nY + j] = 1;
  }
}

function toGrid() {
  pu.set(u);
  pv.set(v);
  du.fill(0);
  dv.fill(0);
  u.fill(0);
  v.fill(0);
  for (let c = 0; c < nC; c++) ctype[c] = s[c] === 0 ? SOLID : AIR;
  for (let p = 0; p < N; p++) {
    const xi = Math.min(Math.max(Math.floor(px[p] * ih), 0), nX - 1), yi = Math.min(Math.max(Math.floor(py[p] * ih), 0), nY - 1);
    const c = xi * nY + yi;
    if (ctype[c] === AIR) ctype[c] = FLUID;
  }
  nWet = 0;
  for (let i = 1; i < nX - 1; i++) for (let j = 1; j < nY - 1; j++) if (ctype[i * nY + j] === FLUID) wet[nWet++] = i * nY + j;
  for (let comp = 0; comp < 2; comp++) {
    const dx = comp === 0 ? 0 : hc * .5, dy = comp === 0 ? hc * .5 : 0, f = comp === 0 ? u : v, d = comp === 0 ? du : dv, vel = comp === 0 ? vx : vy;
    for (let p = 0; p < N; p++) {
      const x = Math.min(Math.max(px[p], hc), (nX - 1) * hc), y = Math.min(Math.max(py[p], hc), (nY - 1) * hc);
      const x0 = Math.min(Math.floor((x - dx) * ih), nX - 2), tx = (x - dx - x0 * hc) * ih, x1 = Math.min(x0 + 1, nX - 2);
      const y0 = Math.min(Math.floor((y - dy) * ih), nY - 2), ty = (y - dy - y0 * hc) * ih, y1 = Math.min(y0 + 1, nY - 2);
      const sx = 1 - tx, sy = 1 - ty, d0 = sx * sy, d1 = tx * sy, d2 = tx * ty, d3 = sx * ty;
      const n0 = x0 * nY + y0, n1 = x1 * nY + y0, n2 = x1 * nY + y1, n3 = x0 * nY + y1, w = vel[p];
      f[n0] += w * d0;
      d[n0] += d0;
      f[n1] += w * d1;
      d[n1] += d1;
      f[n2] += w * d2;
      d[n2] += d2;
      f[n3] += w * d3;
      d[n3] += d3;
    }
    for (let c = 0; c < nC; c++) if (d[c] > 0) f[c] /= d[c];
    for (let i = 0; i < nX; i++) for (let j = 0; j < nY; j++) {
      const c = i * nY + j, solid = ctype[c] === SOLID;
      if (comp === 0 && (solid || i > 0 && ctype[c - nY] === SOLID)) u[c] = 0;
      if (comp === 1 && (solid || j > 0 && ctype[c - 1] === SOLID)) v[c] = 0;
    }
  }
}

function toParticles() {
  for (let comp = 0; comp < 2; comp++) {
    const dx = comp === 0 ? 0 : hc * .5, dy = comp === 0 ? hc * .5 : 0, f = comp === 0 ? u : v, pf = comp === 0 ? pu : pv, vel = comp === 0 ? vx : vy, off = comp === 0 ? nY : 1;
    for (let p = 0; p < N; p++) {
      const x = Math.min(Math.max(px[p], hc), (nX - 1) * hc), y = Math.min(Math.max(py[p], hc), (nY - 1) * hc);
      const x0 = Math.min(Math.floor((x - dx) * ih), nX - 2), tx = (x - dx - x0 * hc) * ih, x1 = Math.min(x0 + 1, nX - 2);
      const y0 = Math.min(Math.floor((y - dy) * ih), nY - 2), ty = (y - dy - y0 * hc) * ih, y1 = Math.min(y0 + 1, nY - 2);
      const sx = 1 - tx, sy = 1 - ty, d0 = sx * sy, d1 = tx * sy, d2 = tx * ty, d3 = sx * ty;
      const n0 = x0 * nY + y0, n1 = x1 * nY + y0, n2 = x1 * nY + y1, n3 = x0 * nY + y1;
      const ok = c => ctype[c] !== AIR || ctype[c - off] !== AIR ? 1 : 0;
      const v0 = ok(n0), v1 = ok(n1), v2 = ok(n2), v3 = ok(n3), w = v0 * d0 + v1 * d1 + v2 * d2 + v3 * d3;
      if (w <= 0) continue;
      const pic = (v0 * d0 * f[n0] + v1 * d1 * f[n1] + v2 * d2 * f[n2] + v3 * d3 * f[n3]) / w;
      const corr = (v0 * d0 * (f[n0] - pf[n0]) + v1 * d1 * (f[n1] - pf[n1]) + v2 * d2 * (f[n2] - pf[n2]) + v3 * d3 * (f[n3] - pf[n3])) / w;
      vel[p] = (1 - FLIP) * pic + FLIP * (vel[p] + corr);
    }
  }
}

function density() {
  dens.fill(0);
  for (let p = 0; p < N; p++) {
    const x = Math.min(Math.max(px[p], hc), (nX - 1) * hc), y = Math.min(Math.max(py[p], hc), (nY - 1) * hc);
    const x0 = Math.floor((x - hc * .5) * ih), tx = (x - hc * .5 - x0 * hc) * ih, x1 = Math.min(x0 + 1, nX - 2);
    const y0 = Math.floor((y - hc * .5) * ih), ty = (y - hc * .5 - y0 * hc) * ih, y1 = Math.min(y0 + 1, nY - 2);
    const sx = 1 - tx, sy = 1 - ty;
    if (x0 < nX && y0 < nY) dens[x0 * nY + y0] += sx * sy;
    if (x1 < nX && y0 < nY) dens[x1 * nY + y0] += tx * sy;
    if (x1 < nX && y1 < nY) dens[x1 * nY + y1] += tx * ty;
    if (x0 < nX && y1 < nY) dens[x0 * nY + y1] += sx * ty;
  }
}

function pressure() {
  pu.set(u);
  pv.set(v);
  for (let w = 0; w < nWet; w++) {
    const c = wet[w], k = dens[c] - rest;
    const inner = ctype[c - nY] !== AIR && ctype[c + nY] !== AIR && ctype[c - 1] !== AIR && ctype[c + 1] !== AIR;
    dfix[w] = k > 0 ? k * 2 : inner ? k * .5 : 0;
  }
  for (let it = 0; it < PITER; it++) {
    for (let w = 0; w < nWet; w++) {
      const c = wet[w];
      const l = c - nY, r = c + nY, b = c - 1, t = c + 1, sl = s[l], sr = s[r], sb = s[b], stp = s[t], ss = sl + sr + sb + stp;
      if (ss === 0) continue;
      let div = u[r] - u[c] + v[t] - v[c] - dfix[w];
      const q = -div / ss * OVER;
      u[c] -= sl * q;
      u[r] += sr * q;
      v[c] -= sb * q;
      v[t] += stp * q;
    }
  }
}

let hX, hY, hInv, hCount, hStart, hIds;

function separate() {
  const n2 = hX * hY;
  if (!hIds || hIds.length < cap) hIds = new Int32Array(cap);
  hCount.fill(0);
  for (let p = 0; p < N; p++) {
    const xi = Math.min(Math.max(Math.floor(px[p] * hInv), 0), hX - 1), yi = Math.min(Math.max(Math.floor(py[p] * hInv), 0), hY - 1);
    hCount[xi * hY + yi]++;
  }
  let f = 0;
  for (let c = 0; c < n2; c++) {
    f += hCount[c];
    hStart[c] = f;
  }
  hStart[n2] = f;
  for (let p = 0; p < N; p++) {
    const xi = Math.min(Math.max(Math.floor(px[p] * hInv), 0), hX - 1), yi = Math.min(Math.max(Math.floor(py[p] * hInv), 0), hY - 1);
    hIds[--hStart[xi * hY + yi]] = p;
  }
  const min = 2 * rp, min2 = min * min;
  for (let it = 0; it < SEP; it++) {
    for (let p = 0; p < N; p++) {
      const pxi = Math.floor(px[p] * hInv), pyi = Math.floor(py[p] * hInv);
      const x0 = Math.max(pxi - 1, 0), y0 = Math.max(pyi - 1, 0), x1 = Math.min(pxi + 1, hX - 1), y1 = Math.min(pyi + 1, hY - 1);
      for (let xi = x0; xi <= x1; xi++) for (let yi = y0; yi <= y1; yi++) {
        const c = xi * hY + yi;
        for (let k = hStart[c]; k < hStart[c + 1]; k++) {
          const q = hIds[k];
          if (q === p) continue;
          if (st[p] !== st[q] && !(fr[p] || fr[q])) continue;
          const dx = px[q] - px[p], dy = py[q] - py[p], d2 = dx * dx + dy * dy;
          if (d2 > min2 || d2 === 0) continue;
          const d = Math.sqrt(d2), m = .5 * (min - d) / d;
          px[p] -= dx * m;
          py[p] -= dy * m;
          px[q] += dx * m;
          py[q] += dy * m;
        }
      }
    }
  }
}

function startNext() {
  if (active || !queue.length) return;
  const q = queue[0], R = route(q.a, q.b);
  for (let i = 0; i < N; i++) if (st[i] === 1 && routes.get(rt[i]).dir !== R.dir) return;
  active = {
    R,
    left: q.n * ppd + (carryP.get(R.key) || 0)
  };
  carryP.delete(R.key);
  queue.shift();
}

let running = 0, mouth = [];

function pumpStep(dt) {
  startNext();
  if (!active) return;
  const A = active, R = A.R, a = R.a, s0 = R.seg[0], nx = -s0.ty, ny = s0.tx, clear2 = (1.8 * rp) ** 2;
  const rows = Math.max(1, Math.ceil(VPUMP * dt / (Math.sqrt(3) * rp)));
  for (let k = 0; k < rows; k++) for (const w of mouth) {
    if (A.left < 1 || count[a] < 1 / ppd - 1e-9 || running >= MAXRUN) break;
    const along = rp + k * Math.sqrt(3) * rp, off = k % 2 ? rp : 0;
    const x = R.x0 + s0.tx * along + nx * (w + off), y = Math.max(floorY() + rp, R.y0 + s0.ty * along + ny * (w + off));
    let free = true;
    for (let i = 0; i < N && free; i++) if (st[i] === 1 && (px[i] - x) ** 2 + (py[i] - y) ** 2 < clear2) free = false;
    if (!free) continue;
    const i = add(x, y, s0.tx * VPUMP, s0.ty * VPUMP, a);
    st[i] = 1;
    rt[i] = R.key;
    sg[i] = 0;
    age[i] = 0;
    count[a] -= 1 / ppd;
    A.left -= 1;
    running++;
  }
  if (A.left < 1) {
    carryP.set(R.key, A.left);
    active = null;
    return;
  }
  if (count[a] < 1 / ppd) {
    for (let i = 0; i < N; i++) if (st[i] === 1 && routes.get(rt[i]).b === a) return;
    active = null;
  }
}

function substep(dt) {
  running = 0;
  for (let i = 0; i < N; i++) if (st[i] === 1) running++;
  pumpStep(dt);
  const want = new Set;
  if (active) want.add(active.R.key);
  for (let i = 0; i < N; i++) if (st[i] === 1) want.add(rt[i]);
  const key = [ ...want ].sort().join(",");
  if (key !== liveKey) {
    live = want;
    liveKey = key;
    buildMask();
  }
  floors();
  applyMask();
  const kp = 1 - Math.exp(-dt * 25);
  for (let i = 0; i < N; i++) {
    vx[i] += gx * dt;
    vy[i] += gy * dt;
    if (st[i] === 1) {
      const R = routes.get(rt[i]);
      nearest(R, px[i], py[i], sg[i]);
      sg[i] = ci;
      const vt = vx[i] * ctx + vy[i] * cty, dv0 = (VPUMP - vt) * kp + cty * G0 * dt;
      vx[i] += ctx * dv0;
      vy[i] += cty * dv0;
      const vn = -vx[i] * cty + vy[i] * ctx;
      vx[i] += cty * vn * kp;
      vy[i] -= ctx * vn * kp;
    }
    px[i] += vx[i] * dt;
    py[i] += vy[i] * dt;
  }
  separate();
  collide(dt);
  toGrid();
  density();
  pressure();
  toParticles();
}

function collide(dt) {
  const rad = geo.pin - rp, fy = floorY() + rp, ty = topY() - rp;
  for (let i = N - 1; i >= 0; i--) {
    if (st[i] === 1) {
      const R = routes.get(rt[i]), d = nearest(R, px[i], py[i], sg[i]);
      sg[i] = ci;
      if (d > rad) {
        const nx = (px[i] - cx) / d, ny = (py[i] - cy) / d, vn = vx[i] * nx + vy[i] * ny;
        px[i] = cx + nx * rad;
        py[i] = cy + ny * rad;
        if (vn > 0) {
          vx[i] -= vn * nx;
          vy[i] -= vn * ny;
        }
      }
      if (py[i] < fy) {
        py[i] = fy;
        if (vy[i] < 0) vy[i] = 0;
      }
      if (cArc >= R.L - .01) {
        st[i] = 0;
        tk[i] = R.b;
        rt[i] = -1;
        fr[i] = 1;
        age[i] = 0;
        count[R.b] += 1 / ppd;
      }
      continue;
    }
    const k = tk[i], l = tankL(k) + rp, r = tankR(k) - rp, fk = ff[k] + rp;
    if (px[i] < l) {
      px[i] = l;
      if (vx[i] < 0) vx[i] = 0;
    }
    if (px[i] > r) {
      px[i] = r;
      if (vx[i] > 0) vx[i] = 0;
    }
    if (py[i] < fk) {
      py[i] = fk;
      if (vy[i] < 0) vy[i] = 0;
    }
    if (py[i] > ty) {
      py[i] = ty;
      if (vy[i] > 0) vy[i] = 0;
    }
  }
}

const colH = new Float32Array(NT * PROF);

function columns() {
  colH.fill(0);
  for (let i = 0; i < N; i++) {
    if (st[i] !== 0 || fr[i]) continue;
    const k = tk[i], b = Math.min(PROF - 1, Math.max(0, Math.floor((px[i] - tankL(k)) / (2 * geo.rin) * PROF)));
    colH[k * PROF + b] += area / (2 * geo.rin / PROF);
  }
}

function landings() {
  for (let i = 0; i < N; i++) {
    if (!fr[i]) continue;
    const k = tk[i], b = Math.min(PROF - 1, Math.max(0, Math.floor((px[i] - tankL(k)) / (2 * geo.rin) * PROF)));
    if (py[i] - ff[k] < colH[k * PROF + b] + rp * 2 || py[i] < ff[k] + rp * 1.5) {
      fr[i] = 0;
      hits[k * 2]++;
      hits[k * 2 + 1] += Math.max(0, -vy[i]);
    }
  }
}

const layerN = k => Math.max(0, Math.round(Math.min(count[k] * geo.hpd, LAYER) * 2 * geo.rin / area + 1e-6));

function settle() {
  floors();
  const have = new Int32Array(NT);
  for (let i = 0; i < N; i++) if (st[i] === 0) have[tk[i]]++;
  for (let k = 0; k < NT; k++) {
    let d = layerN(k) - have[k];
    while (d < 0) {
      let low = -1;
      for (let i = 0; i < N; i++) if (st[i] === 0 && tk[i] === k && !fr[i] && (low < 0 || py[i] < py[low])) low = i;
      if (low < 0) break;
      remove(low);
      d++;
    }
    if (d > 0) fill(k, d);
  }
}

function fill(k, d) {
  const l = tankL(k) + rp, r = tankR(k) - rp, dx = 2 * rp, dy = Math.sqrt(3) * rp, per = Math.max(1, Math.floor((r - l) / dx));
  let y = ff[k] + rp;
  for (let i = 0; i < N; i++) if (st[i] === 0 && tk[i] === k && !fr[i]) y = Math.max(y, py[i] + dy);
  for (let n = 0; n < d; n++) {
    const row = Math.floor(n / per), col = n % per;
    add(l + col * dx + (row % 2 ? rp : 0) + rnd() * rp * .1, y + row * dy, 0, 0, k);
  }
}

function setCounts(c) {
  N = 0;
  queue = [];
  active = null;
  carryP.clear();
  for (let k = 0; k < NT; k++) count[k] = c[k];
  floors();
  for (let k = 0; k < NT; k++) fill(k, layerN(k));
  u.fill(0);
  v.fill(0);
}

function setup(g) {
  geo = g;
  routes = new Map;
  queue = [];
  active = null;
  N = 0;
  live = new Set;
  liveKey = "-";
  hc = g.pin / 2.4;
  ih = 1 / hc;
  rp = .3 * hc;
  area = 2 * rp * Math.sqrt(3) * rp;
  ppd = 2 * g.rin * g.hpd / area;
  ox = Math.min(...g.X) - g.rin - 2 * hc;
  oy = g.b - 2 * hc;
  nX = Math.ceil((Math.max(...g.X) + g.dip + g.pout + 2 * hc - ox) * ih) + 1;
  nY = Math.ceil((g.yP + g.pout + 2 * hc - oy) * ih) + 1;
  nC = nX * nY;
  u = new Float32Array(nC);
  v = new Float32Array(nC);
  du = new Float32Array(nC);
  dv = new Float32Array(nC);
  pu = new Float32Array(nC);
  pv = new Float32Array(nC);
  s = new Float32Array(nC);
  ctype = new Int32Array(nC);
  dens = new Float32Array(nC);
  wet = new Int32Array(nC);
  dfix = new Float32Array(nC);
  pipeOpen = new Uint8Array(nC);
  mouth = [];
  for (let w = -(g.pin - 2 * rp); w <= g.pin - 2 * rp + 1e-9; w += 2 * rp) mouth.push(w);
  hInv = 1 / (2.2 * rp);
  hX = Math.floor(nX * hc * hInv) + 1;
  hY = Math.floor(nY * hc * hInv) + 1;
  hCount = new Int32Array(hX * hY);
  hStart = new Int32Array(hX * hY + 1);
  rest = hc * hc / area;
}

self.onmessage = ev => {
  const m = ev.data;
  try {
    if (m.type === "setup") {
      setup(m.geo);
      self.postMessage({
        type: "ready"
      });
    } else if (m.type === "counts") setCounts(m.counts); else if (m.type === "adjust") {
      count[m.k] = Math.max(0, count[m.k] + m.n);
    } else if (m.type === "pump") {
      const last = queue[queue.length - 1];
      if (last && last.a === m.a && last.b === m.b) last.n += m.n; else queue.push({
        a: m.a,
        b: m.b,
        n: m.n
      });
    } else if (m.type === "poke") {
      const k = m.k;
      let top = -1e9;
      for (let i = 0; i < N; i++) if (st[i] === 0 && tk[i] === k) top = Math.max(top, py[i]);
      for (let i = 0; i < N; i++) {
        if (st[i] !== 0 || tk[i] !== k || py[i] < top - .35) continue;
        const f = 1 - (top - py[i]) / .35;
        vy[i] += (3 + rnd() * 3) * f;
        vx[i] += m.dir * (1.5 + rnd() * 2) * f;
      }
    } else if (m.type === "grav") {
      const a = Math.max(-.6, Math.min(.6, m.ang));
      gx = Math.sin(a) * G0;
      gy = -Math.cos(a) * G0;
    } else if (m.type === "step") {
      if (!geo) return;
      const t0 = performance.now();
      hits.fill(0);
      settle();
      const dt = Math.min(m.dt, 1 / 20), n = Math.min(6, Math.max(1, Math.ceil(dt / SUB)));
      for (let k = 0; k < n; k++) substep(dt / n);
      columns();
      landings();
      for (let k = 0; k < NT; k++) {
        let mean = 0;
        for (let b = 0; b < PROF; b++) mean += colH[k * PROF + b];
        mean /= PROF;
        for (let b = 0; b < PROF; b++) prof[k * PROF + b] = colH[k * PROF + b] - mean;
      }
      const need = Math.max(N, 1) * 3, size = Math.max(cap, 64) * 3;
      const pos = m.pos && m.pos.length >= need ? m.pos : new Float32Array(size);
      const col = m.col && m.col.length >= need ? m.col : new Float32Array(size);
      const vel = m.vel && m.vel.length >= need ? m.vel : new Float32Array(size);
      let moving = 0;
      for (let i = 0; i < N; i++) {
        pos[i * 3] = px[i] + ox;
        pos[i * 3 + 1] = py[i] + oy;
        pos[i * 3 + 2] = 0;
        vel[i * 3] = vx[i];
        vel[i * 3 + 1] = vy[i];
        vel[i * 3 + 2] = 0;
        if (st[i] === 0 && !fr[i]) age[i] += dt;
        const A = COL[cs[i]], B = COL[st[i] === 1 ? cs[i] : tk[i]], t = Math.min(1, age[i] / MIX);
        if (t >= 1) cs[i] = tk[i];
        col[i * 3] = A[0] + (B[0] - A[0]) * t;
        col[i * 3 + 1] = A[1] + (B[1] - A[1]) * t;
        col[i * 3 + 2] = A[2] + (B[2] - A[2]) * t;
        if (st[i] === 1) moving++;
      }
      const queued = queue.reduce((a, q) => a + q.n, 0) + (active ? Math.max(0, active.left) / ppd : 0);
      self.postMessage({
        type: "state",
        epoch: m.epoch,
        pos,
        col,
        vel,
        np: N,
        n: moving / ppd,
        counts: Array.from(count),
        queued,
        hits: Array.from(hits),
        prof: Array.from(prof),
        ppd,
        ms: performance.now() - t0
      }, [ pos.buffer, col.buffer, vel.buffer ]);
    }
  } catch (e) {
    self.postMessage({
      type: "error",
      message: String(e && e.stack || e)
    });
  }
};
