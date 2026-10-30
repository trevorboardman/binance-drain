import { addNode, isAddr, isHash, CHAINS, COINS } from "./site/core.js";

const SYM_ALIAS = {
  USDt: "USDT"
};

const ROLES = new Set([ "victim", "hub", "hop", "attacker", "venue", "recovered", "untraced" ]);

const ROLE_NAME = {
  victim: "Binance wallet",
  hub: "Attacker wallet",
  hop: "Attacker wallet",
  attacker: "Attacker wallet",
  venue: "Exchange or service",
  recovered: "Back to Binance",
  untraced: "Other wallet"
};

const text = (v, n) => typeof v === "string" ? v.slice(0, n) : "";

export function mergeChain(S, prices, r) {
  const c = r && r.chain;
  if (!CHAINS[c] || c === "eth") throw new Error("unknown chain " + c);
  const name = CHAINS[c].name, evm = CHAINS[c].addr.source.startsWith("^0x");
  const key = a => typeof a === "string" ? c + ":" + (evm ? a.toLowerCase() : a) : "";
  const nodes = [], events = [], freezes = [];
  for (const x of r.nodes || []) {
    const a = key(x && x.addr);
    const role = x && x.bucket === "frozen" ? "seized" : x && ROLES.has(x.role) ? x.role : null;
    if (!isAddr(a) || !role) continue;
    const plain = text(x.plain, 60) || (role === "seized" ? "Locked away" : ROLE_NAME[role]);
    nodes.push({
      addr: a,
      link: a,
      chain: c,
      role,
      depth: Number(x.depth) || 0,
      label: text(x.label, 80) || plain,
      plain: plain.includes(name) ? plain : plain + " (" + name + ")",
      note: text(x.note, 300),
      evidence: text(x.evidence, 300)
    });
  }
  for (const e of r.events || []) {
    const from = key(e && e.from), to = key(e && e.to), k = c + ":" + String(e && e.key).slice(0, 140);
    if (!isAddr(from) || !isAddr(to) || !isHash(e.hash, c) || !(Number(e.amt) > 0) || !(Number(e.t) > 0)) continue;
    events.push({
      key: k,
      t: Number(e.t),
      from,
      to,
      sym: SYM_ALIAS[e.sym] || text(e.sym, 12) || "?",
      amt: Number(e.amt),
      usd: Number(e.usd) || 0,
      hash: e.hash,
      block: Number(e.block) || 0,
      chain: c
    });
  }
  for (const z of r.freezes || []) {
    const addr = key(z && z.addr), k = c + ":" + String(z && z.key).slice(0, 140);
    if (!isAddr(addr) || !isHash(z.hash, c) || ![ "Tether", "Circle", "Ripple" ].includes(z.issuer) || !(Number(z.t) > 0)) continue;
    freezes.push({
      key: k,
      issuer: z.issuer,
      addr,
      t: Number(z.t),
      hash: z.hash,
      chain: c
    });
  }
  if ((r.nodes || []).length && !nodes.length) throw new Error(name + ": no wallet passed the checks");
  const had = m => [ ...m.values() ].filter(x => x.chain === c).length;
  const hadEv = had(S.events), hadFz = had(S.freezes);
  if (hadEv && events.length < hadEv / 2) throw new Error(`${name}: ${events.length} movements against ${hadEv} last time; kept the last data`);
  if (hadFz && freezes.length < hadFz / 2) throw new Error(`${name}: ${freezes.length} freezes against ${hadFz} last time; kept the last data`);
  for (const m of [ S.events, S.freezes, S.nodes ]) for (const [k, x] of m) if (x.chain === c) m.delete(k);
  for (const [k, v] of Object.entries(r.prices || {})) if (COINS.has(k) && Number(v) > 0) prices[k] = Number(v);
  let n = 0;
  for (const x of nodes) if (addNode(S, x)) n++;
  for (const e of events) S.events.set(e.key, e);
  for (const z of freezes) S.freezes.set(z.key, z);
  console.log(`${name.padEnd(18)} wallets=${n} movements=${events.length} freezes=${freezes.length}`);
}
