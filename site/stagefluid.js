"use strict";

const PROF = 16;

const G0 = 50, SUB = 1 / 120, VPUMP = 11, MAXRUN = 2500;

const FLIP = .9, PITER = 50, OVER = 1.9, SEP = 4;

const MIX = 5, BUSY = 4;

const LAYER = .3;

let geo = null, NV = 0, COL = [];

let hc, ih, nX, nY, nC, ox, oy;

let u, v, du, dv, pu, pv, s, ctype, dens, stamp, wet, nWet = 0, dfix, pipeN, vesOpen;

let touched, nTouch = 0, stampId = 1;

const FLUID = 0, AIR = 1, SOLID = 2;

let openList = new Int32Array(0), nOpen = 0, rest = 0;

let cap = 0, N = 0, rp, area;

let px, py, vx, vy, st, tk, rt, cs, age, fr, sg, pw;

let gx = 0, gy = -G0, simT = 0, vtSum = 0, vtN = 0;

let count, ff, hits, prof, colH, busyUntil, top, iceTop, queues, active, carryP;

const routes = new Map;

let live = new Set, liveKey = "";

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
  rt = grow(rt, Int32Array);
  cs = grow(cs, Uint8Array);
  age = grow(age, Float32Array);
  fr = grow(fr, Uint8Array);
  sg = grow(sg, Int16Array);
  pw = grow(pw, Float32Array);
  cap = c;
}

function add(x, y, ux, uy, k, col) {
  alloc(N + 1);
  const i = N++;
  px[i] = x;
  py[i] = y;
  vx[i] = ux;
  vy[i] = uy;
  st[i] = 0;
  tk[i] = k;
  rt[i] = -1;
  cs[i] = col;
  age[i] = MIX;
  fr[i] = 0;
  sg[i] = 0;
  pw[i] = 0;
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
  pw[i] = pw[j];
}

const V = k => geo.vessels[k];

const vL = k => V(k).x - ox - V(k).rin, vR = k => V(k).x - ox + V(k).rin, vFloor = k => V(k).b - oy, vTop = k => V(k).top - oy;

function route(key) {
  if (routes.has(key)) return routes.get(key);
  const src = geo.routes[key];
  if (!src) return null;
  const P = src.pts.map(([x, y]) => [ x - ox, y - oy ]), Q = [ P[0] ], len = i => Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]);
  for (let i = 1; i + 1 < P.length; i++) {
    const rc = Math.min(geo.bend, .45 * len(i - 1), .45 * len(i)), [x, y] = P[i];
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
  const rad = geo.pin + hc * .75, cells = [], id = ++stampId;
  for (const q of seg) for (let d = 0; d <= q.len + 1e-9; d += hc * .5) {
    const cx0 = q.x0 + q.tx * d, cy0 = q.y0 + q.ty * d;
    for (let i = Math.floor((cx0 - rad) * ih); i <= Math.floor((cx0 + rad) * ih); i++) for (let j = Math.floor((cy0 - rad) * ih); j <= Math.floor((cy0 + rad) * ih); j++) {
      if (i < 1 || j < 1 || i >= nX - 1 || j >= nY - 1) continue;
      const c = i * nY + j;
      if (stamp[c] === id) continue;
      if (((i + .5) * hc - cx0) ** 2 + ((j + .5) * hc - cy0) ** 2 > rad * rad) continue;
      stamp[c] = id;
      cells.push(c);
    }
  }
  const R = {
    key,
    a: src.a,
    b: src.b,
    seg,
    L,
    ppd: src.ppd,
    x0: Q[0][0],
    y0: Q[0][1],
    cells: Int32Array.from(cells)
  };
  routes.set(key, R);
  return R;
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

function setLive(want) {
  const key = [ ...want ].sort((a, b) => a - b).join(",");
  if (key === liveKey) return;
  for (const k of live) {
    const R = route(k);
    if (R) for (const c of R.cells) pipeN[c]--;
  }
  for (const k of want) {
    const R = route(k);
    if (R) for (const c of R.cells) pipeN[c]++;
  }
  live = want;
  liveKey = key;
}

function floors() {
  for (let k = 0; k < NV; k++) ff[k] = vFloor(k) + Math.max(0, count[k] * V(k).hpd - LAYER);
}

const busy = k => busyUntil[k] > simT;

function openCells() {
  for (let n = 0; n < nOpen; n++) {
    const c = openList[n];
    s[c] = 0;
    vesOpen[c] = 0;
    ctype[c] = SOLID;
  }
  nOpen = 0;
  const id = ++stampId;
  const push = c => {
    if (stamp[c] === id) return;
    stamp[c] = id;
    if (nOpen >= openList.length) {
      const b = new Int32Array(openList.length * 2 + 4096);
      b.set(openList);
      openList = b;
    }
    openList[nOpen++] = c;
  };
  for (const k of live) {
    const R = routes.get(k);
    if (R) for (const c of R.cells) if (pipeN[c] > 0) push(c);
  }
  for (let k = 0; k < NV; k++) {
    if (!busy(k)) continue;
    const i0 = Math.max(1, Math.floor(vL(k) * ih)), i1 = Math.min(nX - 2, Math.ceil(vR(k) * ih) - 1);
    const j0 = Math.max(1, Math.floor(ff[k] * ih)), j1 = Math.min(nY - 2, Math.ceil(vTop(k) * ih) - 1);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const c = i * nY + j;
      vesOpen[c] = 1;
      push(c);
    }
  }
  for (let n = 0; n < nOpen; n++) {
    const c = openList[n];
    s[c] = 1;
    ctype[c] = AIR;
  }
}

const touch = c => {
  if (stamp[c] !== stampId) {
    stamp[c] = stampId;
    touched[nTouch++] = c;
  }
};

function clearTouched() {
  for (let n = 0; n < nTouch; n++) {
    const c = touched[n];
    u[c] = v[c] = du[c] = dv[c] = pu[c] = pv[c] = dens[c] = 0;
  }
  nTouch = 0;
  ++stampId;
}

function toGrid() {
  clearTouched();
  nWet = 0;
  for (let p = 0; p < N; p++) {
    const xi = Math.min(Math.max(Math.floor(px[p] * ih), 0), nX - 1), yi = Math.min(Math.max(Math.floor(py[p] * ih), 0), nY - 1);
    const c = xi * nY + yi;
    if (ctype[c] === AIR) {
      ctype[c] = FLUID;
      if (xi > 0 && yi > 0 && xi < nX - 1 && yi < nY - 1) wet[nWet++] = c;
    }
  }
  for (let w = 0; w < nWet; w++) {
    const c = wet[w];
    touch(c);
    touch(c + nY);
    touch(c + 1);
    touch(c - nY);
    touch(c - 1);
  }
  for (let comp = 0; comp < 2; comp++) {
    const dx = comp === 0 ? 0 : hc * .5, dy = comp === 0 ? hc * .5 : 0, f = comp === 0 ? u : v, d = comp === 0 ? du : dv, vel = comp === 0 ? vx : vy;
    for (let p = 0; p < N; p++) {
      const x = Math.min(Math.max(px[p], hc), (nX - 1) * hc), y = Math.min(Math.max(py[p], hc), (nY - 1) * hc);
      const x0 = Math.min(Math.floor((x - dx) * ih), nX - 2), tx = (x - dx - x0 * hc) * ih, x1 = Math.min(x0 + 1, nX - 2);
      const y0 = Math.min(Math.floor((y - dy) * ih), nY - 2), ty = (y - dy - y0 * hc) * ih, y1 = Math.min(y0 + 1, nY - 2);
      const sx = 1 - tx, sy = 1 - ty, d0 = sx * sy, d1 = tx * sy, d2 = tx * ty, d3 = sx * ty;
      const n0 = x0 * nY + y0, n1 = x1 * nY + y0, n2 = x1 * nY + y1, n3 = x0 * nY + y1, w = vel[p];
      touch(n0);
      touch(n1);
      touch(n2);
      touch(n3);
      f[n0] += w * d0;
      d[n0] += d0;
      f[n1] += w * d1;
      d[n1] += d1;
      f[n2] += w * d2;
      d[n2] += d2;
      f[n3] += w * d3;
      d[n3] += d3;
    }
  }
  for (let n = 0; n < nTouch; n++) {
    const c = touched[n];
    if (du[c] > 0) u[c] /= du[c];
    if (dv[c] > 0) v[c] /= dv[c];
    if (ctype[c] === SOLID || ctype[c - nY] === SOLID) u[c] = 0;
    if (ctype[c] === SOLID || ctype[c - 1] === SOLID) v[c] = 0;
    pu[c] = u[c];
    pv[c] = v[c];
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
  for (let p = 0; p < N; p++) {
    const x = Math.min(Math.max(px[p], hc), (nX - 1) * hc), y = Math.min(Math.max(py[p], hc), (nY - 1) * hc);
    const x0 = Math.floor((x - hc * .5) * ih), tx = (x - hc * .5 - x0 * hc) * ih, x1 = Math.min(x0 + 1, nX - 2);
    const y0 = Math.floor((y - hc * .5) * ih), ty = (y - hc * .5 - y0 * hc) * ih, y1 = Math.min(y0 + 1, nY - 2);
    const sx = 1 - tx, sy = 1 - ty, a = x0 * nY + y0, b = x1 * nY + y0, c = x1 * nY + y1, d = x0 * nY + y1;
    touch(a);
    touch(b);
    touch(c);
    touch(d);
    dens[a] += sx * sy;
    dens[b] += tx * sy;
    dens[c] += tx * ty;
    dens[d] += sx * ty;
  }
}

function pressure() {
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
      const div = u[r] - u[c] + v[t] - v[c] - dfix[w], q = -div / ss * OVER;
      u[c] -= sl * q;
      u[r] += sr * q;
      v[c] -= sb * q;
      v[t] += stp * q;
    }
  }
}

const HB = 1 << 15, hStart = new Int32Array(HB + 1), hFill = new Int32Array(HB);

let hSorted = new Int32Array(0), hKey = new Int32Array(0), hX = new Int32Array(0), hY = new Int32Array(0);

const hkey = (xi, yi) => (xi * 73856093 ^ yi * 19349663) & HB - 1;

function separate() {
  const hs = 2.2 * rp, hI = 1 / hs, min = 2 * rp, min2 = min * min;
  if (hSorted.length < cap) {
    hSorted = new Int32Array(cap);
    hKey = new Int32Array(cap);
    hX = new Int32Array(cap);
    hY = new Int32Array(cap);
  }
  for (let it = 0; it < SEP; it++) {
    hStart.fill(0);
    for (let p = 0; p < N; p++) {
      const xi = Math.floor(px[p] * hI), yi = Math.floor(py[p] * hI), k = hkey(xi, yi);
      hX[p] = xi;
      hY[p] = yi;
      hKey[p] = k;
      hStart[k + 1]++;
    }
    for (let k = 0; k < HB; k++) {
      hStart[k + 1] += hStart[k];
      hFill[k] = hStart[k];
    }
    for (let p = 0; p < N; p++) hSorted[hFill[hKey[p]]++] = p;
    for (let p = 0; p < N; p++) {
      const pxi = hX[p], pyi = hY[p], sp = st[p], fp = fr[p];
      for (let xi = pxi - 1; xi <= pxi + 1; xi++) for (let yi = pyi - 1; yi <= pyi + 1; yi++) {
        const k = hkey(xi, yi), e = hStart[k + 1];
        for (let j = hStart[k]; j < e; j++) {
          const q = hSorted[j];
          if (q <= p) continue;
          if (sp !== st[q] && !(fp || fr[q])) continue;
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

let mouth = [], running = 0;

function startNext(a) {
  if (active[a] || !queues[a].length) return;
  const q = queues[a][0], R = route(q.key);
  queues[a].shift();
  if (!R) return;
  active[a] = {
    R,
    c: q.c,
    left: q.n * R.ppd + (carryP.get(R.key) || 0)
  };
  carryP.delete(R.key);
  busyUntil[a] = Math.max(busyUntil[a], simT + BUSY);
  busyUntil[R.b] = Math.max(busyUntil[R.b], simT + BUSY);
}

function pumpStep(dt) {
  for (let a = 0; a < NV; a++) {
    startNext(a);
    const A = active[a];
    if (!A) continue;
    const R = A.R, s0 = R.seg[0], nx = -s0.ty, ny = s0.tx, clear2 = (1.8 * rp) ** 2, w1 = 1 / R.ppd;
    busyUntil[a] = Math.max(busyUntil[a], simT + BUSY);
    busyUntil[R.b] = Math.max(busyUntil[R.b], simT + BUSY);
    const rows = Math.max(1, Math.ceil(VPUMP * dt / (Math.sqrt(3) * rp)));
    for (let k = 0; k < rows; k++) for (const w of mouth) {
      if (A.left < 1 || count[a] < w1 - 1e-9 || running >= MAXRUN) break;
      const along = rp + k * Math.sqrt(3) * rp, off = k % 2 ? rp : 0;
      const x = R.x0 + s0.tx * along + nx * (w + off), y = R.y0 + s0.ty * along + ny * (w + off);
      let free = true;
      for (let i = N - 1; i >= 0 && free; i--) if (st[i] === 1 && rt[i] === R.key && (px[i] - x) ** 2 + (py[i] - y) ** 2 < clear2) free = false;
      if (!free) continue;
      const i = add(x, y, s0.tx * VPUMP, s0.ty * VPUMP, a, A.c);
      st[i] = 1;
      rt[i] = R.key;
      sg[i] = 0;
      age[i] = 0;
      pw[i] = w1;
      count[a] -= w1;
      A.left -= 1;
      running++;
    }
    if (A.left < 1) {
      carryP.set(R.key, A.left);
      active[a] = null;
      continue;
    }
    if (count[a] < w1) {
      let coming = false;
      for (let i = 0; i < N && !coming; i++) if (st[i] === 1 && routes.get(rt[i]).b === a) coming = true;
      if (!coming) active[a] = null;
    }
  }
}

function substep(dt) {
  running = 0;
  for (let i = 0; i < N; i++) if (st[i] === 1) running++;
  pumpStep(dt);
  const want = new Set;
  for (let a = 0; a < NV; a++) if (active[a]) want.add(active[a].R.key);
  for (let i = 0; i < N; i++) if (st[i] === 1) want.add(rt[i]);
  setLive(want);
  floors();
  openCells();
  const kp = 1 - Math.exp(-dt * 25);
  vtSum = vtN = 0;
  for (let i = 0; i < N; i++) {
    if (st[i] === 0 && iceTop[tk[i]] && !fr[i]) {
      vx[i] = vy[i] = 0;
      continue;
    }
    vx[i] += gx * dt;
    vy[i] += gy * dt;
    if (st[i] === 1) {
      const R = routes.get(rt[i]);
      nearest(R, px[i], py[i], sg[i]);
      sg[i] = ci;
      const vt = vx[i] * ctx + vy[i] * cty, dv0 = (VPUMP - vt) * kp + cty * G0 * dt;
      vtSum += vt;
      vtN++;
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
  collide();
  toGrid();
  density();
  pressure();
  toParticles();
}

function collide() {
  const rad = geo.pin - rp;
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
      if (cArc >= R.L - .01) {
        st[i] = 0;
        tk[i] = R.b;
        rt[i] = -1;
        fr[i] = 1;
        age[i] = 0;
        count[R.b] += pw[i];
        busyUntil[R.b] = Math.max(busyUntil[R.b], simT + BUSY);
      }
      continue;
    }
    const k = tk[i], l = vL(k) + rp, r = vR(k) - rp, fk = ff[k] + rp, ty = vTop(k) - rp;
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

function columns() {
  colH.fill(0);
  for (let i = 0; i < N; i++) {
    if (st[i] !== 0 || fr[i]) continue;
    const k = tk[i], w = 2 * V(k).rin, b = Math.min(PROF - 1, Math.max(0, Math.floor((px[i] - vL(k)) / w * PROF)));
    colH[k * PROF + b] += area / (w / PROF);
  }
}

function landings() {
  for (let i = 0; i < N; i++) {
    if (!fr[i]) continue;
    const k = tk[i], w = 2 * V(k).rin, b = Math.min(PROF - 1, Math.max(0, Math.floor((px[i] - vL(k)) / w * PROF)));
    if (py[i] - ff[k] < colH[k * PROF + b] + rp * 2 || py[i] < ff[k] + rp * 1.5) {
      fr[i] = 0;
      hits[k * 2]++;
      hits[k * 2 + 1] += Math.max(0, -vy[i]);
    }
  }
}

const layerN = k => busy(k) && !iceTop[k] ? Math.max(0, Math.round(Math.min(count[k] * V(k).hpd, LAYER) * 2 * V(k).rin / area + 1e-6)) : 0;

function settle() {
  floors();
  const have = new Int32Array(NV);
  for (let i = 0; i < N; i++) if (st[i] === 0 && !fr[i]) have[tk[i]]++;
  for (let k = 0; k < NV; k++) {
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
  const l = vL(k) + rp, r = vR(k) - rp, dx = 2 * rp, dy = Math.sqrt(3) * rp, per = Math.max(1, Math.floor((r - l) / dx));
  let y = ff[k] + rp;
  for (let i = 0; i < N; i++) if (st[i] === 0 && tk[i] === k && !fr[i]) y = Math.max(y, py[i] + dy);
  for (let n = 0; n < d; n++) {
    const row = Math.floor(n / per), col = n % per;
    add(l + col * dx + (row % 2 ? rp : 0) + rnd() * rp * .1, y + row * dy, 0, 0, k, top[k]);
  }
}

function setCounts(c) {
  N = 0;
  carryP.clear();
  for (let k = 0; k < NV; k++) {
    count[k] = c[k];
    queues[k] = [];
    active[k] = null;
    busyUntil[k] = 0;
  }
  setLive(new Set);
  floors();
}

function setup(g) {
  geo = g;
  NV = g.vessels.length;
  COL = g.cols;
  routes.clear();
  N = 0;
  live = new Set;
  liveKey = "";
  hc = g.pin / 2.4;
  ih = 1 / hc;
  rp = .3 * hc;
  area = 2 * rp * Math.sqrt(3) * rp;
  rest = hc * hc / area;
  ox = g.rect[0] - 2 * hc;
  oy = g.rect[1] - 2 * hc;
  nX = Math.ceil((g.rect[2] - ox + 2 * hc) * ih) + 1;
  nY = Math.ceil((g.rect[3] - oy + 2 * hc) * ih) + 1;
  nC = nX * nY;
  u = new Float32Array(nC);
  v = new Float32Array(nC);
  du = new Float32Array(nC);
  dv = new Float32Array(nC);
  pu = new Float32Array(nC);
  pv = new Float32Array(nC);
  s = new Float32Array(nC);
  dens = new Float32Array(nC);
  ctype = new Uint8Array(nC).fill(SOLID);
  stamp = new Int32Array(nC);
  stampId = 1;
  wet = new Int32Array(nC);
  dfix = new Float32Array(nC);
  pipeN = new Int16Array(nC);
  vesOpen = new Uint8Array(nC);
  touched = new Int32Array(nC);
  nTouch = 0;
  nOpen = 0;
  mouth = [];
  for (let w = -(g.pin - 2 * rp); w <= g.pin - 2 * rp + 1e-9; w += 2 * rp) mouth.push(w);
  count = new Float64Array(NV);
  ff = new Float64Array(NV);
  hits = new Float32Array(NV * 2);
  prof = new Float32Array(NV * PROF);
  colH = new Float32Array(NV * PROF);
  busyUntil = new Float64Array(NV);
  top = new Uint8Array(NV);
  iceTop = new Uint8Array(NV);
  queues = Array.from({
    length: NV
  }, () => []);
  active = new Array(NV).fill(null);
  carryP = new Map;
  for (let k = 0; k < NV; k++) top[k] = g.vessels[k].col || 0;
}

self.onmessage = ev => {
  const m = ev.data;
  try {
    if (m.type === "setup") {
      setup(m.geo);
      self.postMessage({
        type: "ready",
        nC,
        cells: [ nX, nY ]
      });
    } else if (m.type === "counts") setCounts(m.counts); else if (m.type === "adjust") count[m.k] = Math.max(0, count[m.k] + m.n); else if (m.type === "tops") {
      for (let k = 0; k < NV; k++) {
        top[k] = m.tops[k];
        iceTop[k] = m.ice[k] ? 1 : 0;
      }
    } else if (m.type === "pump") {
      const key = m.a * 64 + m.b, Q = queues[m.a], last = Q[Q.length - 1];
      if (last && last.key === key && last.c === m.c) last.n += m.n; else Q.push({
        key,
        n: m.n,
        c: m.c
      });
    } else if (m.type === "poke") {
      const k = m.k;
      if (iceTop[k]) return;
      busyUntil[k] = Math.max(busyUntil[k], simT + BUSY);
      settle();
      let hi = -1e9;
      for (let i = 0; i < N; i++) if (st[i] === 0 && tk[i] === k) hi = Math.max(hi, py[i]);
      for (let i = 0; i < N; i++) {
        if (st[i] !== 0 || tk[i] !== k || py[i] < hi - .35) continue;
        const f = 1 - (hi - py[i]) / .35;
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
      const dt = Math.min(m.dt, 1 / 20), n = Math.min(6, Math.max(1, Math.ceil(dt / SUB)));
      settle();
      for (let k = 0; k < n; k++) {
        substep(dt / n);
        simT += dt / n;
      }
      columns();
      landings();
      for (let k = 0; k < NV; k++) {
        let mean = 0;
        for (let b = 0; b < PROF; b++) mean += colH[k * PROF + b];
        mean /= PROF;
        for (let b = 0; b < PROF; b++) prof[k * PROF + b] = colH[k * PROF + b] > 0 ? colH[k * PROF + b] - mean : 0;
      }
      const need = Math.max(N, 1) * 3, size = Math.max(cap, 64) * 3;
      const pos = m.pos && m.pos.length >= need ? m.pos : new Float32Array(size);
      const col = m.col && m.col.length >= need ? m.col : new Float32Array(size);
      const vel = m.vel && m.vel.length >= need ? m.vel : new Float32Array(size);
      let moving = 0, movingP = 0;
      for (let i = 0; i < N; i++) {
        pos[i * 3] = px[i] + ox;
        pos[i * 3 + 1] = py[i] + oy;
        pos[i * 3 + 2] = 0;
        vel[i * 3] = vx[i];
        vel[i * 3 + 1] = vy[i];
        vel[i * 3 + 2] = 0;
        if (st[i] === 0 && !fr[i]) age[i] += dt;
        const A = COL[cs[i]] || COL[0], B = COL[st[i] === 1 ? cs[i] : top[tk[i]]] || A, t = Math.min(1, age[i] / MIX);
        if (t >= 1 && st[i] === 0) cs[i] = top[tk[i]];
        col[i * 3] = A[0] + (B[0] - A[0]) * t;
        col[i * 3 + 1] = A[1] + (B[1] - A[1]) * t;
        col[i * 3 + 2] = A[2] + (B[2] - A[2]) * t;
        if (st[i] === 1) {
          moving += pw[i];
          movingP++;
        }
      }
      let queued = 0, queuedP = 0;
      for (let a = 0; a < NV; a++) {
        for (const q of queues[a]) {
          queued += q.n;
          const R = route(q.key);
          queuedP += q.n * (R ? R.ppd : 0);
        }
        if (active[a]) {
          queued += Math.max(0, active[a].left) / active[a].R.ppd;
          queuedP += Math.max(0, active[a].left);
        }
      }
      self.postMessage({
        type: "state",
        epoch: m.epoch,
        pos,
        col,
        vel,
        np: N,
        n: moving,
        nP: movingP,
        counts: Array.from(count),
        queued,
        queuedP,
        hits: Array.from(hits),
        prof: Array.from(prof),
        simT,
        vt: vtN ? vtSum / vtN : 0,
        open: nOpen,
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
