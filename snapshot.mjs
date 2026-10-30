import fs from "node:fs";

import { makeState, makeClient, addNode, loadData, isSide, isAddr, isHash, CHAINS, COINS, SEEDS, SINCE, ATTACK_BLOCK } from "./site/core.js";

const FILE = new URL("./site/data.json", import.meta.url);

const full = process.argv.includes("--full") || !fs.existsSync(FILE);

const S = makeState();

const C = makeClient(S, {
  gap: 120
});

let prevBlock = ATTACK_BLOCK, prev = null;

if (!full) {
  prev = JSON.parse(fs.readFileSync(FILE, "utf8"));
  loadData(S, prev);
  prevBlock = prev.block || ATTACK_BLOCK;
}

SEEDS.forEach(s => addNode(S, {
  ...s
}));

const t0 = Date.now();

await C.price();

if (!S.ethPrice) {
  console.error("no ETH price from Blockscout; writing nothing rather than zero-dollar events");
  process.exit(1);
}

await C.head();

await C.pollVictims();

const done = new Set;

for (;;) {
  const next = [ ...S.nodes.values() ].filter(n => isSide(n) && !done.has(n.addr) && n.addr.startsWith("0x"));
  if (!next.length) break;
  for (const n of next) {
    done.add(n.addr);
    await C.pollNode(n, full || !n.polled ? 40 : 3);
    console.log(`${n.plain.padEnd(18)} ${n.addr}  events=${S.events.size} nodes=${S.nodes.size}`);
  }
}

const ATTACK_T = Date.parse("2026-10-29T20:18:00Z");

const checks = [];

for (const n of S.nodes.values()) {
  if (n.role !== "hop") continue;
  const before = [ ...S.events.values() ].filter(e => e.t < ATTACK_T && (e.from === n.addr || e.to === n.addr)).length;
  if (before >= 10) checks.push(`CHECK: ${n.addr} (${n.label}) has ${before} movements before the attack; is it really the attacker's?`);
}

const CHAIN_SINCE = Date.parse("2026-10-29T20:00:00Z");

const CHAIN_MODS = [ "btc", "tron", "xrpl", "sol", "evm" ];

const prices = {
  ...prev && prev.prices || {}
};

const chainFail = [];

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

function mergeChain(r) {
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
  for (const m of [ S.events, S.freezes, S.nodes ]) for (const [k, x] of m) if (x.chain === c) m.delete(k);
  for (const [k, v] of Object.entries(r.prices || {})) if (COINS.has(k) && Number(v) > 0) prices[k] = Number(v);
  let n = 0;
  for (const x of nodes) if (addNode(S, x)) n++;
  for (const e of events) S.events.set(e.key, e);
  for (const z of freezes) S.freezes.set(z.key, z);
  console.log(`${name.padEnd(18)} wallets=${n} movements=${events.length} freezes=${freezes.length}`);
}

for (const id of CHAIN_MODS) {
  try {
    const t0 = Date.now();
    const m = await (import(`./chains/${id}.mjs`));
    for (const r of [].concat(await m.fetchChain({
      since: CHAIN_SINCE
    }))) mergeChain(r);
    console.log(id + " took " + Math.round((Date.now() - t0) / 1e3) + " s");
    S.health.ok++;
  } catch (e) {
    S.health.fail++;
    S.health.lastErr = id + ": " + e.message;
    chainFail.push(id);
    console.error(`chain ${id} failed: ${e.message}`);
  }
}

if (full && chainFail.length) {
  console.error("a chain failed on a full run; wrote nothing");
  process.exit(1);
}

await C.pollBlacklist();

await C.pollFreezeLogs(full ? ATTACK_BLOCK : Math.max(ATTACK_BLOCK, prevBlock - 20));

await C.watch();

const calls = S.health.ok + S.health.fail;

if (S.health.fail) console.error(`${S.health.fail} of ${calls} calls failed, last: ${S.health.lastErr}`);

if (checks.length) {
  checks.forEach(c => console.error(c));
  console.error("wrote nothing");
  process.exit(1);
}

if (S.health.fail * 20 > calls) {
  console.error("too many failed calls; wrote nothing");
  process.exit(1);
}

const data = {
  generatedAt: (new Date).toISOString(),
  block: S.block,
  ethPrice: S.ethPrice,
  prices,
  nodes: [ ...S.nodes.values() ],
  alias: [ ...S.alias ],
  events: [ ...S.events.values() ].sort((a, b) => a.t - b.t),
  freezes: [ ...S.freezes.values() ].sort((a, b) => a.t - b.t),
  watch: S.watch,
  failures: S.health.fail
};

fs.writeFileSync(FILE, JSON.stringify(data));

console.log(`wrote site/data.json (${full ? "full" : "update"}): ${data.nodes.length} wallets, ${data.events.length} movements, ${data.freezes.length} freezes, block ${S.block}, ${((Date.now() - t0) / 1e3).toFixed(0)} s, ${S.health.fail} of ${calls} calls failed`);
