import { createHash } from "node:crypto";

import fs from "node:fs";

const TG = "https://api.trongrid.io";

const USDT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

const START = Date.UTC(2026, 9, 29, 20, 18);

const VICTIMS = {
  TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf: "Binance hot wallet TDqSqu"
};

const SEEDS = {
  TG5iBMQPrDzJJAUM8GMVBf1hRaJ1wvzsGi: 1
};

const VENUES = {
  TQqgNg13s2DjvXhW1ky4v6TsR8wZGvb7Y4: "DEX universal router (UniversalRouter)",
  TSUUVjysXV8YqHytSNjfkNXnnB49QDvZpx: "DEX pool USDT/TRX (CreatedByContract)",
  TFGDbUyP8xez44C76fin3bn3Ss6jugoUwJ: "DEX pool (CreatedByContract)",
  TVjuTE3V5bMVdpfNhid8kD2v35T2k1u1Br: "DEX pool manager (PoolManager)",
  TTJxU3P8rHycAyFY4kVtGNfmnMH4ezcuM9: "DEX Permit2 (Permit2)",
  TXJgMdjVX5dKiQaUi9QobwNxtSQaFqccvd: "JustLend lending market jUSDT (CErc20Delegator)",
  TE2RzoSV3wFK99w6J9UnnZ4vLfXYoxvRwP: "JustLend lending market jTRX (CEther)",
  TGjYzgCyPobsNS9n6WcbdLVR9dH7mWqFx7: "JustLend lending comptroller (Unitroller)"
};

const STABLES = {
  USDT: 1,
  USDC: 1,
  USDD: 1,
  TUSD: 1,
  USD1: 1
};

const MIN_EVT = 1e4, FOLLOW = 1e6, MAX_DEPTH = 5;

const ALPH = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const sha = b => createHash("sha256").update(b).digest();

export function hexToB58(hex) {
  hex = String(hex).replace(/^0x/, "");
  if (hex.length === 40) hex = "41" + hex;
  const raw = Buffer.from(hex, "hex"), buf = Buffer.concat([ raw, sha(sha(raw)).subarray(0, 4) ]);
  let n = BigInt("0x" + buf.toString("hex")), s = "";
  while (n > 0n) {
    s = ALPH[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of buf) {
    if (b) break;
    s = "1" + s;
  }
  return s;
}

let last = 0;

async function get(url, gap = 1100) {
  for (let i = 0; i < 8; i++) {
    const w = last + gap - Date.now();
    if (w > 0) await new Promise(r => setTimeout(r, w));
    last = Date.now();
    let r, t;
    try {
      r = await fetch(url, {
        headers: {
          accept: "application/json"
        },
        signal: AbortSignal.timeout(3e4)
      });
      t = await r.text();
    } catch (e) {
      await new Promise(r => setTimeout(r, 3e3));
      continue;
    }
    if (r.status === 429 || /allowed_rps|suspended/.test(t)) {
      await new Promise(r => setTimeout(r, 6e3));
      continue;
    }
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}: ${t.slice(0, 200)}`);
    return JSON.parse(t);
  }
  throw new Error("gave up (rate limit or network): " + url);
}

async function pages(url, max) {
  const out = [];
  let u = url, n = 0;
  for (;u && n < max; n++) {
    const j = await get(u);
    out.push(...j.data || []);
    u = j.meta?.links?.next;
  }
  if (u) console.error(`[tron] WARNING: stopped after ${max} pages, more data exists: ${url}`);
  return out;
}

async function trxPrices(since) {
  const j = await get(`https://api.kraken.com/0/public/OHLC?pair=TRXUSD&interval=60&since=${Math.floor(since / 1e3) - 3600}`, 1100);
  if (j.error?.length) throw new Error("Kraken: " + j.error.join(","));
  const rows = Object.values(j.result).find(Array.isArray) || [];
  const hours = rows.map(r => [ r[0] * 1e3, Number(r[4]) ]);
  if (!hours.length) throw new Error("Kraken returned no TRX prices");
  const at = t => {
    let p = hours[0][1];
    for (const [h, c] of hours) {
      if (h <= t) p = c; else break;
    }
    return p;
  };
  return {
    at,
    now: hours.at(-1)[1]
  };
}

const accounts = new Map;

async function account(a) {
  if (!accounts.has(a)) {
    const j = await get(`${TG}/v1/accounts/${a}`);
    accounts.set(a, j.data?.[0] || null);
  }
  return accounts.get(a);
}

const CACHE = new URL("../cache/tron.json", import.meta.url);

const cache = (() => {
  try {
    return JSON.parse(fs.readFileSync(CACHE, "utf8"));
  } catch {
    return {};
  }
})();

cache.kind ||= {};

cache.logs ||= {};

function saveCache() {
  fs.mkdirSync(new URL(".", CACHE), {
    recursive: true
  });
  fs.writeFileSync(CACHE, JSON.stringify(cache));
}

async function kind(a) {
  if (!cache.kind[a]) {
    const acc = await account(a);
    if (!acc) return null;
    cache.kind[a] = {
      type: acc.type,
      account_name: acc.account_name,
      create_time: acc.create_time
    };
  }
  return cache.kind[a];
}

const isContract = acc => acc?.type === "Contract";

const nameOf = acc => {
  try {
    return acc?.account_name ? Buffer.from(acc.account_name, "hex").toString() : "";
  } catch {
    return "";
  }
};

async function logIndex(txid, from, to, value) {
  if (!cache.logs[txid]) {
    const evs = (await get(`${TG}/v1/transactions/${txid}/events`)).data || [];
    const tr = evs.filter(e => e.event_name === "Transfer").map(e => [ hexToB58(e.result.from), hexToB58(e.result.to), String(e.result.value), e.event_index, e.block_number ]);
    if (!tr.length) {
      console.error(`[tron] WARNING: no Transfer log found for ${txid}`);
      return {
        i: "x",
        block: null
      };
    }
    cache.logs[txid] = tr;
  }
  const e = cache.logs[txid].find(([f, t, v]) => f === from && t === to && v === String(value));
  if (!e) console.error(`[tron] WARNING: no Transfer log found for ${txid}`);
  return e ? {
    i: e[3],
    block: e[4]
  } : {
    i: "x",
    block: null
  };
}

export async function fetchChain(o) {
  try {
    return await read(o);
  } finally {
    saveCache();
  }
}

async function read({since = START} = {}) {
  const px = await trxPrices(since);
  const priceOf = (sym, t) => STABLES[sym] ?? (sym === "TRX" || sym === "WTRX" ? px.at(t) : null);
  const nodes = new Map, events = new Map, freezes = [];
  const side = new Map;
  const addNode = (addr, o) => {
    if (!nodes.has(addr)) nodes.set(addr, {
      addr,
      ...o
    });
    return nodes.get(addr);
  };
  for (const [a, label] of Object.entries(VICTIMS)) addNode(a, {
    label,
    plain: "Binance wallet",
    role: "victim",
    note: "Busy exchange hot wallet (hundreds of USDT transfers every 10 min); sent 612.7M USDT and 46.4M TRX to a wallet created two minutes earlier.",
    evidence: 'History: ~4,000 TRC-20 transfers an hour before the attack, regular 20-minute sweeps of 30-45M USDT to other Binance-pattern wallets; amount matches Whale Alert\'s 612.7M USDT "from Binance". No explorer label could be read keylessly.'
  });
  for (const [a, d] of Object.entries(SEEDS)) side.set(a, d);
  const push = async (ev, raw) => {
    if (ev.usd < MIN_EVT || events.has(ev.key)) return;
    events.set(ev.key, ev);
  };
  const fresh = async a => {
    const acc = await kind(a);
    return acc && !isContract(acc) && (acc.create_time || 0) >= since - 36e5;
  };
  for (const v of Object.keys(VICTIMS)) {
    const tr = await pages(`${TG}/v1/accounts/${v}/transactions/trc20?limit=200&only_from=true&min_timestamp=${since}&order_by=block_timestamp,asc`, 150);
    for (const t of tr) {
      if (t.type !== "Transfer") continue;
      const sym = t.token_info.symbol, amt = Number(t.value) / 10 ** t.token_info.decimals, p = priceOf(sym, t.block_timestamp);
      if (p == null || amt * p < FOLLOW) continue;
      if (!side.has(t.to) && !await fresh(t.to)) continue;
      if (!side.has(t.to)) side.set(t.to, 1);
      const li = await logIndex(t.transaction_id, t.from, t.to, t.value);
      await push({
        key: `${t.transaction_id}:${li.i}`,
        t: t.block_timestamp,
        from: t.from,
        to: t.to,
        sym,
        amt,
        usd: amt * p,
        hash: t.transaction_id,
        block: li.block
      });
    }
    const nat = await pages(`${TG}/v1/accounts/${v}/transactions?limit=200&only_from=true&min_timestamp=${since}&order_by=block_timestamp,asc`, 80);
    for (const t of nat) {
      const c = t.raw_data?.contract?.[0];
      if (c?.type !== "TransferContract" || t.ret?.[0]?.contractRet !== "SUCCESS") continue;
      const to = hexToB58(c.parameter.value.to_address), amt = c.parameter.value.amount / 1e6, usd = amt * px.at(t.block_timestamp);
      if (usd < FOLLOW) continue;
      if (!side.has(to) && !await fresh(to)) continue;
      if (!side.has(to)) side.set(to, 1);
      await push({
        key: `${t.txID}:0`,
        t: t.block_timestamp,
        from: v,
        to,
        sym: "TRX",
        amt,
        usd,
        hash: t.txID,
        block: t.blockNumber ?? null
      });
    }
  }
  const done = new Set, notFollowed = new Map;
  const queue = () => [ ...side.entries() ].filter(([a]) => !done.has(a)).sort((x, y) => x[1] - y[1]);
  for (let q = queue(); q.length; q = queue()) {
    const [a, depth] = q[0];
    done.add(a);
    const out = new Map;
    const tr = await pages(`${TG}/v1/accounts/${a}/transactions/trc20?limit=200&min_timestamp=${since}&order_by=block_timestamp,asc`, 30);
    for (const t of tr) {
      if (t.type !== "Transfer") continue;
      const sym = t.token_info.symbol, amt = Number(t.value) / 10 ** t.token_info.decimals, p = priceOf(sym, t.block_timestamp);
      if (p == null) continue;
      const usd = amt * p;
      if (usd < MIN_EVT) continue;
      if (t.from === a) out.set(t.to, (out.get(t.to) || 0) + usd);
      const li = await logIndex(t.transaction_id, t.from, t.to, t.value);
      await push({
        key: `${t.transaction_id}:${li.i}`,
        t: t.block_timestamp,
        from: t.from,
        to: t.to,
        sym,
        amt,
        usd,
        hash: t.transaction_id,
        block: li.block
      });
    }
    const nat = await pages(`${TG}/v1/accounts/${a}/transactions?limit=200&min_timestamp=${since}&order_by=block_timestamp,asc`, 30);
    for (const t of nat) {
      if (t.ret?.[0]?.contractRet !== "SUCCESS") continue;
      const c = t.raw_data?.contract?.[0];
      if (c?.type === "TransferContract") {
        const from = hexToB58(c.parameter.value.owner_address), to = hexToB58(c.parameter.value.to_address);
        const amt = c.parameter.value.amount / 1e6, usd = amt * px.at(t.block_timestamp);
        if (from === a) out.set(to, (out.get(to) || 0) + usd);
        await push({
          key: `${t.txID}:0`,
          t: t.block_timestamp,
          from,
          to,
          sym: "TRX",
          amt,
          usd,
          hash: t.txID,
          block: t.blockNumber ?? null
        });
      }
      for (const [i, it] of (t.internal_transactions || []).entries()) {
        const v = Number(it.data?.call_value?._ || 0);
        if (!v || it.data?.rejected) continue;
        const from = hexToB58(it.from_address), to = hexToB58(it.to_address);
        if (from !== a && to !== a) continue;
        const amt = v / 1e6, usd = amt * px.at(t.block_timestamp);
        if (from === a) out.set(to, (out.get(to) || 0) + usd);
        await push({
          key: `${t.txID}:i${i}`,
          t: t.block_timestamp,
          from,
          to,
          sym: "TRX",
          amt,
          usd,
          hash: t.txID,
          block: t.blockNumber ?? null,
          internal: true
        });
      }
    }
    for (const [to, usd] of out) {
      if (side.has(to) || VICTIMS[to]) continue;
      if (usd < MIN_EVT) {
        notFollowed.set(to, (notFollowed.get(to) || 0) + usd);
        continue;
      }
      const acc = await kind(to);
      if (VENUES[to] || isContract(acc)) {
        addNode(to, {
          label: VENUES[to] || `Contract ${nameOf(acc) || to}`,
          plain: "Service",
          role: "venue",
          note: "",
          evidence: `on-chain contract, account_name "${nameOf(acc)}"`
        });
        continue;
      }
      if (usd >= FOLLOW && depth < MAX_DEPTH) side.set(to, depth + 1); else notFollowed.set(to, (notFollowed.get(to) || 0) + usd);
    }
  }
  for (const e of events.values()) for (const x of [ e.from, e.to ]) {
    if (nodes.has(x) || side.has(x) || VICTIMS[x]) continue;
    const acc = await kind(x);
    if (VENUES[x] || isContract(acc)) addNode(x, {
      label: VENUES[x] || `Contract ${nameOf(acc) || x}`,
      plain: "Service",
      role: "venue",
      note: "",
      evidence: `on-chain contract, account_name "${nameOf(acc)}"`
    });
  }
  const bl = await pages(`${TG}/v1/contracts/${USDT}/events?event_name=AddedBlackList&min_block_timestamp=${since}&limit=200&order_by=block_timestamp,asc`, 20);
  const rm = await pages(`${TG}/v1/contracts/${USDT}/events?event_name=RemovedBlackList&min_block_timestamp=${since}&limit=200&order_by=block_timestamp,asc`, 20);
  const unfrozen = new Set(rm.map(e => hexToB58(e.result._user)));
  const seenFz = new Set;
  for (const e of bl) {
    const addr = hexToB58(e.result._user);
    if (!side.has(addr) || seenFz.has(addr)) continue;
    seenFz.add(addr);
    freezes.push({
      key: `${e.transaction_id}:${e.event_index}`,
      issuer: "Tether",
      addr,
      t: e.block_timestamp,
      hash: e.transaction_id,
      sym: "USDT",
      ...unfrozen.has(addr) ? {
        removedLater: true
      } : {}
    });
  }
  for (const [a, depth] of side) {
    const acc = await account(a);
    const usdt = Number((acc?.trc20 || []).find(o => o[USDT])?.[USDT] || 0) / 1e6, trx = (acc?.balance || 0) / 1e6;
    const fz = freezes.find(f => f.addr === a);
    addNode(a, {
      label: `Wallet ${a.slice(0, 5)}…${a.slice(-4)}`,
      plain: "Attacker wallet",
      role: depth === 1 ? "hub" : "hop",
      depth,
      note: `Holds ${Math.round(usdt).toLocaleString("en-US")} USDT${fz ? " (Tether-frozen)" : ""} and ${Math.round(trx).toLocaleString("en-US")} TRX now.`,
      evidence: depth === 1 ? "Created minutes before it received the Binance outflow; swapped and split the funds within the hour." : "Received $1M+ from an attacker wallet.",
      holdings: {
        USDT: usdt,
        TRX: trx
      },
      created: acc?.create_time || null,
      frozenUSDT: !!fz
    });
  }
  return {
    chain: "tron",
    prices: {
      USDT: 1,
      TRX: px.now
    },
    priceNote: "usd = TRX at the Kraken TRXUSD hourly close of the hour it moved; USDT at $1; prices.TRX is the latest hourly close.",
    nodes: [ ...nodes.values() ],
    events: [ ...events.values() ].sort((a, b) => a.t - b.t || (a.key < b.key ? -1 : 1)),
    freezes,
    notFollowed: [ ...notFollowed ].map(([addr, usd]) => ({
      addr,
      usd
    }))
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1]?.endsWith("fetch.mjs")) {
  fetchChain({
    since: START
  }).then(r => process.stdout.write(JSON.stringify(r, null, 1)), e => {
    console.error("[tron] FAILED:", e);
    process.exit(1);
  });
}
