import fs from "node:fs";

import { makeState, makeClient, addNode, loadData, isSide, SEEDS, ATTACK_BLOCK } from "./site/core.js";

import { mergeChain } from "./merge.mjs";

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

const chainT0 = Date.now();

const got = await Promise.allSettled(CHAIN_MODS.map(async id => {
  const t0 = Date.now();
  const m = await (import(`./chains/${id}.mjs`));
  const r = await m.fetchChain({
    since: CHAIN_SINCE
  });
  console.log(id + " took " + Math.round((Date.now() - t0) / 1e3) + " s");
  return r;
}));

CHAIN_MODS.forEach((id, i) => {
  try {
    if (got[i].status === "rejected") throw got[i].reason;
    for (const r of [].concat(got[i].value)) mergeChain(S, prices, r);
    S.health.ok++;
  } catch (e) {
    S.health.fail++;
    S.health.lastErr = id + ": " + e.message;
    chainFail.push(id);
    console.error(`chain ${id} failed: ${e.message}`);
  }
});

console.log("chains took " + Math.round((Date.now() - chainT0) / 1e3) + " s together");

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

try {
  const MFILE = new URL("./site/market.json", import.meta.url);
  const prevM = fs.existsSync(MFILE) ? JSON.parse(fs.readFileSync(MFILE, "utf8")) : null;
  const {fetchMarket} = await (import("./market.mjs"));
  const m = await fetchMarket({
    prev: prevM,
    withReserves: false
  });
  const pts = rows => Array.isArray(rows) && rows.length > 10 && rows.every(r => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[1] > 0);
  if (!pts(m.series.BNB) || !pts(m.series.BTC) || !pts(m.relative["BNB/BTC"])) throw new Error("BNB, BTC or BNB/BTC missing or malformed");
  const keep = {
    generatedAt: m.generatedAt,
    since: m.since,
    base: m.base,
    series: m.series,
    relative: m.relative,
    summary: m.summary,
    perps: m.perps,
    sources: m.sources,
    notes: m.notes
  };
  fs.writeFileSync(MFILE, JSON.stringify(keep));
  console.log(`wrote site/market.json: ${(JSON.stringify(keep).length / 1024).toFixed(0)} KB in ${(m.tookMs / 1e3).toFixed(1)} s` + (m.notes.length ? "; notes: " + m.notes.join(" | ") : ""));
} catch (e) {
  console.error("market failed, kept the last market.json: " + e.message);
}
