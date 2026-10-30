import { node, isSide, chainOf, STABLE, assetClass } from "./core.js?v=12";

export const ROWS = 4;

const BIN = [ "eth", "btc", "tron", "xrpl", "sol", "arb", "avax", "op", "base" ];

const TICK = {
  eth: "ETH",
  btc: "BTC",
  tron: "TRX",
  xrpl: "XRP",
  sol: "SOL",
  arb: "ARB",
  avax: "AVAX",
  op: "OP",
  base: "BASE"
};

const CHAIN_NAME = {
  eth: "Ethereum",
  btc: "Bitcoin",
  tron: "Tron",
  xrpl: "XRP Ledger",
  sol: "Solana",
  arb: "Arbitrum",
  avax: "Avalanche",
  op: "Optimism",
  base: "Base"
};

export const HOPS = 8;

const ISSUER_OF = {
  USDT: "Tether",
  USDC: "Circle",
  RLUSD: "Ripple"
};

export const A_ADDR = "0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c", B_PREFIX = "0x8532fa14acaf";

export const CLS = {
  ice: 0,
  usd: 1,
  coin: 2
};

function net(x, out = x, o = 0) {
  const a = x[o], b = x[o + 1], c = x[o + 2], sum = a + b + c;
  if (a >= 0 && b >= 0 && c >= 0) {
    out[o] = a;
    out[o + 1] = b;
    out[o + 2] = c;
    return sum;
  }
  const pos = Math.max(0, a) + Math.max(0, b) + Math.max(0, c), k = pos > 0 ? Math.max(0, sum) / pos : 0;
  out[o] = Math.max(0, a) * k;
  out[o + 1] = Math.max(0, b) * k;
  out[o + 2] = Math.max(0, c) * k;
  return Math.max(0, sum);
}

const shown = x => net(x, [ 0, 0, 0 ]);

export function stageModel(S, since) {
  const B_ADDR = [ ...S.nodes.keys() ].find(a => a.startsWith(B_PREFIX)) || B_PREFIX;
  const value = e => e.sym === "ETH" || e.sym === "WETH" ? e.amt * S.ethPrice : S.prices[e.sym] ? e.amt * S.prices[e.sym] : STABLE.has((e.sym || "").toUpperCase()) ? e.amt : e.usd;
  const evs = [ ...S.events.values() ].filter(e => e.t >= since && e.usd > 0).sort((a, b) => a.t - b.t || (a.key < b.key ? -1 : 1));
  const V = [], byKey = new Map;
  const add = (key, row, name, sub, kind, extra) => {
    const v = {
      key,
      row,
      name,
      sub,
      kind,
      i: V.length,
      peak: 0,
      ...extra
    };
    V.push(v);
    byKey.set(key, v);
    return v;
  };
  for (const c of BIN) add("bin:" + c, 0, TICK[c], "Binance", "bin", {
    chain: c,
    long: "Binance on " + CHAIN_NAME[c]
  });
  add("A", 1, "Wallet A", "Ethereum", "att", {
    long: "Wallet A, the attacker’s first Ethereum wallet"
  });
  add("B", 1, "Wallet B", "Ethereum", "att", {
    long: "Wallet B, where 195,460 Ether was parked"
  });
  add("att:btc", 1, "Bitcoin", "attacker", "att", {
    long: "The attacker’s Bitcoin wallets"
  });
  add("att:tron", 1, "Tron", "attacker", "att", {
    long: "The attacker’s Tron wallets"
  });
  add("att:xrpl", 1, "XRP", "attacker", "att", {
    long: "The attacker’s XRP Ledger wallets"
  });
  add("att:more", 1, "Others", "attacker", "att", {
    long: "The attacker’s wallets on Solana, Arbitrum, Avalanche, Optimism and Base"
  });
  const cat = n => !n ? "other" : n.role === "victim" ? "victim" : isSide(n) ? "side" : n.role === "venue" ? "venue" : n.role === "recovered" ? "back" : n.role === "seized" ? "back" : "other";
  const peakOf = new Map, run = new Map;
  for (const e of evs) {
    const fn = node(S, e.from), tn = node(S, e.to), v = value(e);
    if (!(v > 0)) continue;
    if (cat(fn) === "side") run.set(fn.addr, (run.get(fn.addr) || 0) - v);
    if (cat(tn) === "side") {
      const b = (run.get(tn.addr) || 0) + v;
      run.set(tn.addr, b);
      peakOf.set(tn.addr, Math.max(peakOf.get(tn.addr) || 0, b));
    }
  }
  const hops = [ ...peakOf.entries() ].filter(([a]) => chainOf(a) === "eth" && a !== A_ADDR && a !== B_ADDR).sort((p, q) => q[1] - p[1]).slice(0, HOPS);
  for (const [a] of hops) {
    const n = S.nodes.get(a);
    add("hop:" + a, 2, n.mini || n.label || a.slice(0, 6), "", "hop", {
      addr: a,
      long: n.plain || n.label || a
    });
  }
  add("more", 2, "More", "wallets", "hop", {
    long: "Every other wallet the attacker used"
  });
  add("svc:swap", 3, "Swaps", "", "svc", {
    long: "Swapped on exchanges and pools"
  });
  add("svc:loan", 3, "Loans", "", "svc", {
    long: "Put into lending markets, net of what was borrowed out"
  });
  add("svc:other", 3, "Services", "", "svc", {
    long: "Other contracts, net of what came back"
  });
  add("svc:back", 3, "Returned", "", "svc", {
    long: "Given back (Synthetix, The Sandbox) or held by the Arbitrum Security Council"
  });
  add("svc:gone", 3, "Untraced", "", "svc", {
    long: "Sent on in amounts under $1M, net"
  });
  const vesselOf = n => {
    const c = cat(n);
    if (c === "victim") return byKey.get("bin:" + chainOf(n.addr)) || byKey.get("bin:eth");
    if (c === "side") {
      if (n.addr === A_ADDR) return byKey.get("A");
      if (n.addr === B_ADDR) return byKey.get("B");
      const ch = chainOf(n.addr);
      if (ch !== "eth") return byKey.get("att:" + ch) || byKey.get("att:more");
      return byKey.get("hop:" + n.addr) || byKey.get("more");
    }
    if (c === "venue") {
      const s = (n.label || n.addr) + " " + (n.mini || "");
      return byKey.get(/swap|dex|router|pool/i.test(s) ? "svc:swap" : /lend|loan|aave|jusdt/i.test(s) ? "svc:loan" : "svc:other");
    }
    if (c === "back") return byKey.get("svc:back");
    return byKey.get("svc:gone");
  };
  const fzs = [ ...S.freezes.values() ].map(z => ({
    z,
    n: node(S, z.addr)
  })).filter(x => isSide(x.n)).sort((a, b) => a.z.t - b.z.t);
  const frozen = new Set, bal = new Map, steps = [];
  const bk = (n, sym) => n.addr + "|" + sym;
  const isFz = (n, sym) => !!ISSUER_OF[sym] && frozen.has(n.addr + "|" + ISSUER_OF[sym]);
  const lvl = V.map(() => [ 0, 0, 0 ]);
  const push = (t, a, b, v, ca, cb, key) => {
    if (!(v > 0) || a === b && ca === cb) return;
    steps.push({
      t,
      a,
      b,
      v,
      ca,
      cb,
      key
    });
    if (a >= 0) lvl[a][ca] -= v;
    lvl[b][cb] += v;
    V[b].peak = Math.max(V[b].peak, shown(lvl[b]));
  };
  let fi = 0;
  const freezeUpTo = t => {
    for (;fi < fzs.length && fzs[fi].z.t <= t; fi++) {
      const {z, n} = fzs[fi], k = n.addr + "|" + z.issuer;
      if (frozen.has(k)) continue;
      frozen.add(k);
      const sym = Object.keys(ISSUER_OF).find(s => ISSUER_OF[s] === z.issuer), v = vesselOf(n).i;
      push(z.t, v, v, Math.max(0, bal.get(bk(n, sym)) || 0), CLS.usd, CLS.ice, z.key);
    }
  };
  const taken = {};
  for (const e of evs) {
    freezeUpTo(e.t);
    const fn = node(S, e.from), tn = node(S, e.to), fc = cat(fn), tc = cat(tn), v = value(e);
    if (!(v > 0)) continue;
    const kind = assetClass(e.sym) === "usd" ? CLS.usd : CLS.coin;
    const ca = fc === "side" && kind === CLS.usd && isFz(fn, e.sym) ? CLS.ice : kind, cb = tc === "side" && kind === CLS.usd && isFz(tn, e.sym) || tn && tn.role === "seized" ? CLS.ice : kind;
    if (fc === "side") bal.set(bk(fn, e.sym), (bal.get(bk(fn, e.sym)) || 0) - v);
    if (tc === "side") bal.set(bk(tn, e.sym), (bal.get(bk(tn, e.sym)) || 0) + v);
    if (fc === "victim" && tc === "side") {
      const a = vesselOf(fn).i;
      taken[a] = (taken[a] || 0) + v;
      push(e.t, a, vesselOf(tn).i, v, CLS.coin, cb, e.key);
    } else if (fc === "side" || tc === "side") {
      const a = vesselOf(fn).i, b = vesselOf(tn).i;
      if (a !== b) push(e.t, a, b, v, ca, cb, e.key); else if (ca !== cb) push(e.t, a, b, v, ca, cb, e.key);
    }
  }
  freezeUpTo(Infinity);
  const start = V.map(() => [ 0, 0, 0 ]);
  for (const [a, v] of Object.entries(taken)) {
    start[a][CLS.coin] = v;
    V[a].peak = v;
  }
  return {
    vessels: V,
    steps,
    start,
    byKey,
    vesselOf: n => n ? vesselOf(n) : null,
    taken: Object.values(taken).reduce((s, v) => s + v, 0)
  };
}

export function stageLevels(model) {
  const {vessels, steps, start} = model, n = vessels.length;
  const T = new Float64Array(steps.length), cum = new Float64Array(steps.length * n * 3), cur = new Float64Array(n * 3);
  start.forEach((s, k) => {
    cur[k * 3] = s[0];
    cur[k * 3 + 1] = s[1];
    cur[k * 3 + 2] = s[2];
  });
  const base = cur.slice();
  steps.forEach((s, i) => {
    if (s.a >= 0) cur[s.a * 3 + s.ca] -= s.v;
    cur[s.b * 3 + s.cb] += s.v;
    T[i] = s.t;
    cum.set(cur, i * n * 3);
  });
  const idx = t => {
    let lo = 0, hi = T.length;
    while (lo < hi) {
      const m = lo + hi >> 1;
      if (T[m] <= t) lo = m + 1; else hi = m;
    }
    return lo - 1;
  };
  const at = (t, out = new Float64Array(n * 3)) => {
    const i = idx(t);
    out.set(i < 0 ? base : cum.subarray(i * n * 3, (i + 1) * n * 3));
    for (let k = 0; k < n; k++) net(out, out, k * 3);
    return out;
  };
  return {
    at,
    idx,
    T
  };
}
