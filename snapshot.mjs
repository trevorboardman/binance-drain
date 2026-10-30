import fs from "node:fs";

import { makeState, makeClient, addNode, loadData, isSide, SEEDS, ATTACK_BLOCK } from "./site/core.js";

const FILE = new URL("./site/data.json", import.meta.url);

const full = process.argv.includes("--full") || !fs.existsSync(FILE);

const S = makeState();

const C = makeClient(S, {
  gap: 120
});

let prevBlock = ATTACK_BLOCK;

if (!full) {
  const prev = JSON.parse(fs.readFileSync(FILE, "utf8"));
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
  nodes: [ ...S.nodes.values() ],
  alias: [ ...S.alias ],
  events: [ ...S.events.values() ].sort((a, b) => a.t - b.t),
  freezes: [ ...S.freezes.values() ].sort((a, b) => a.t - b.t),
  watch: S.watch,
  failures: S.health.fail
};

fs.writeFileSync(FILE, JSON.stringify(data));

console.log(`wrote site/data.json (${full ? "full" : "update"}): ${data.nodes.length} wallets, ${data.events.length} movements, ${data.freezes.length} freezes, block ${S.block}, ${((Date.now() - t0) / 1e3).toFixed(0)} s, ${S.health.fail} of ${calls} calls failed`);
