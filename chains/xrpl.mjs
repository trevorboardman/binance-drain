const RPCS = [ "https://s1.ripple.com:51234", "https://xrplcluster.com", "https://s2.ripple.com:51234" ];

const RIPPLE_EPOCH = 946684800;

const MIN_USD = 1e4;

const FOLLOW_USD = 1e6;

const MAX_DEPTH = 4;

const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

const RLUSD_HEX = "524C555344000000000000000000000000000000";

const VICTIMS = [ {
  addr: "rDAE53VfMvftPB4ogpWGWvzkQxfht6JPxr",
  label: "Binance 6",
  verified: true
}, {
  addr: "rBtttd61FExHC68vsZ8dqmS3DfjFEceA1A",
  label: "Binance 9",
  verified: true
}, {
  addr: "rNU4eAowPuixS5ZCWaRL72UUeKgxcKExpK",
  label: "Binance 10",
  verified: true
}, {
  addr: "rarG6FaeYhnzSKSS5EEPofo4gFsPn2bZKk",
  label: "Binance 15",
  verified: false
}, {
  addr: "rfQ9EcLkU6WnNmkS3EwUkFeXeN47Rk8Cvi",
  label: "Binance 18",
  verified: false
}, {
  addr: "rhWj9gaovwu2hZxYW7p388P8GRbuXFLQkK",
  label: "Binance 14",
  verified: false
} ];

const HUBS = [ {
  addr: "rK21t6nGLy4MNDqhvy3pGwcLFy25qgfzMx",
  label: "Wallet rK21t6…qfzMx"
} ];

const sleep = ms => new Promise(r => setTimeout(r, ms));

const short = a => a.slice(0, 6) + "…" + a.slice(-5);

const tMs = d => (d + RIPPLE_EPOCH) * 1e3;

async function rpc(method, params) {
  let last;
  for (let i = 0; i < 8; i++) {
    const url = RPCS[i % RPCS.length];
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          method,
          params: [ params ]
        }),
        signal: AbortSignal.timeout(3e4)
      });
      if (r.status === 503 || r.status === 429) {
        last = new Error(url + " " + r.status);
        await sleep(1500 * (i + 1));
        continue;
      }
      const j = await r.json();
      const res = j.result;
      if (res && res.status === "success") return res;
      if (res && /slowDown|tooBusy/.test(res.error)) {
        last = new Error(res.error);
        await sleep(1500 * (i + 1));
        continue;
      }
      throw new Error(`${method}: ${res ? res.error_message || res.error : "no result"}`);
    } catch (e) {
      last = e;
      if (/actNotFound|Account not found/.test(e.message)) throw e;
      await sleep(1e3 * (i + 1));
    }
  }
  throw last;
}

async function txsSince(account, sinceMs) {
  const out = [];
  let marker;
  for (;;) {
    const r = await rpc("account_tx", {
      account,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 400,
      forward: false,
      marker,
      api_version: 1
    });
    let older = false;
    for (const x of r.transactions) {
      const tx = x.tx || x.tx_json;
      if (!tx) continue;
      if (tMs(tx.date) < sinceMs) {
        older = true;
        break;
      }
      out.push({
        tx: {
          ...tx,
          hash: tx.hash || x.hash
        },
        meta: x.meta,
        ledger: tx.ledger_index || x.ledger_index
      });
    }
    if (older || !r.marker) break;
    marker = r.marker;
  }
  return out;
}

async function getJson(url) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(6e4)
  });
  if (!r.ok) throw new Error(url + " " + r.status);
  return r.json();
}

async function priceBook() {
  const books = {};
  const now = {};
  for (const [sym, pair] of [ [ "XRP", "XRPUSD" ], [ "RLUSD", "RLUSDUSD" ] ]) {
    books[sym] = [];
    for (const iv of [ 5, 60, 1440 ]) {
      try {
        const j = await getJson(`https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${iv}`);
        const k = Object.keys(j.result || {}).find(k => k !== "last");
        if (k) books[sym].push({
          iv: iv * 6e4,
          rows: j.result[k].map(c => [ c[0] * 1e3, +c[4] ])
        });
      } catch (e) {
        console.error("price", sym, iv, e.message);
      }
      await sleep(1100);
    }
    const fine = books[sym].find(b => b.rows.length);
    if (fine) now[sym] = fine.rows.at(-1)[1];
  }
  if (!now.XRP) {
    try {
      now.XRP = (await getJson("https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd")).ripple.usd;
    } catch (e) {
      console.error("coingecko", e.message);
    }
  }
  if (!now.RLUSD) now.RLUSD = 1;
  const at = (sym, t) => {
    for (const b of books[sym] || []) {
      const row = b.rows.findLast(r => r[0] <= t);
      if (row && t - row[0] < b.iv) return {
        p: row[1],
        when: "at the time"
      };
    }
    return {
      p: now[sym],
      when: "today"
    };
  };
  return {
    now,
    at
  };
}

const DRAIN_START = Date.parse("2026-10-29T20:00:00Z");

export async function fetchChain({since}) {
  since = Math.min(since ?? DRAIN_START, DRAIN_START);
  const warnings = [];
  const {now, at} = await priceBook();
  if (!now.XRP) throw new Error("no XRP price");
  const labels = new Map;
  try {
    for (const w of await getJson("https://api.xrpscan.com/api/v1/names/well-known")) labels.set(w.account, w);
  } catch (e) {
    warnings.push("XRPSCAN labels unavailable: " + e.message);
  }
  const isBinance = a => /^binance$/i.test(labels.get(a)?.name || "") || VICTIMS.some(v => v.addr === a);
  const nodes = new Map;
  const add = n => {
    if (!nodes.has(n.addr)) nodes.set(n.addr, n);
    return nodes.get(n.addr);
  };
  for (const v of VICTIMS) add({
    addr: v.addr,
    label: v.label,
    plain: "Binance wallet " + v.label.split(" ")[1],
    role: "victim",
    note: v.note,
    evidence: `XRPSCAN label "${v.label}" (binance.com${v.verified ? ", verified" : ""}); routine tagged customer withdrawals before the drain`
  });
  for (const h of HUBS) add({
    addr: h.addr,
    label: h.label,
    plain: "Attacker wallet",
    role: "hub",
    depth: 0,
    evidence: "created by the first drain payment from Binance 6 at 20:05:00 UTC; received only the drain payments (plus dust spam); no label"
  });
  const events = new Map, freezes = new Map;
  const side = a => [ "hub", "hop", "attacker" ].includes(nodes.get(a)?.role);
  const amountOf = d => {
    if (d == null) return null;
    if (typeof d === "string") return {
      sym: "XRP",
      amt: d / 1e6
    };
    if (d.currency === RLUSD_HEX && d.issuer === RLUSD_ISSUER) return {
      sym: "RLUSD",
      amt: +d.value
    };
    return {
      sym: d.currency.length === 40 ? Buffer.from(d.currency, "hex").toString().replace(/\0+$/, "") : d.currency,
      amt: +d.value,
      other: true
    };
  };
  async function isAmm(a) {
    try {
      const r = await rpc("account_info", {
        account: a,
        ledger_index: "validated"
      });
      return !!r.account_data.AMMID;
    } catch {
      return false;
    }
  }
  async function classify(to, tag, fromNode, usd) {
    if (nodes.has(to)) return nodes.get(to);
    const lab = labels.get(to);
    if (isBinance(to)) return add({
      addr: to,
      label: lab ? `${lab.name} ${lab.desc}` : "Binance",
      plain: "Back to Binance",
      role: "recovered",
      evidence: "XRPSCAN Binance label"
    });
    if (lab) return add({
      addr: to,
      label: `${lab.name}${lab.desc ? " " + lab.desc : ""}`,
      plain: lab.name,
      role: "venue",
      evidence: "XRPSCAN well-known label" + (tag != null ? `; destination tag ${tag} (exchange deposit)` : "")
    });
    if (tag != null) return add({
      addr: to,
      label: "Tagged deposit " + short(to),
      plain: "Exchange or service deposit",
      role: "venue",
      evidence: `payment carries destination tag ${tag}: a hosted account (exchange/service), not a plain wallet`
    });
    if (await isAmm(to)) return add({
      addr: to,
      label: "AMM pool " + short(to),
      plain: "Swap pool",
      role: "venue",
      evidence: "account has AMMID (XRPL AMM)"
    });
    const depth = (fromNode.depth ?? 0) + 1;
    if (usd >= FOLLOW_USD && depth <= MAX_DEPTH) return add({
      addr: to,
      label: "Wallet " + short(to),
      plain: "Attacker wallet",
      role: "hop",
      depth,
      evidence: `plain account paid $${Math.round(usd).toLocaleString("en-US")} by ${nodes.get(fromNode.addr)?.label}`
    });
    return null;
  }
  function record(x, from, to, a, extraKey = "") {
    const t = tMs(x.tx.date);
    const {p, when} = at(a.sym, t);
    const usd = a.other ? null : a.amt * p;
    const key = x.tx.hash + extraKey;
    if (usd != null && usd < MIN_USD) return null;
    if (!events.has(key)) events.set(key, {
      key,
      t,
      from,
      to,
      sym: a.sym,
      amt: a.amt,
      usd,
      priced: usd == null ? "unpriced token" : when,
      hash: x.tx.hash,
      block: x.ledger
    });
    return events.get(key);
  }
  const queue = [ ...HUBS.map(h => h.addr) ];
  for (const v of VICTIMS) {
    for (const x of await txsSince(v.addr, since)) {
      const {tx, meta} = x;
      if (tx.Account !== v.addr || tx.TransactionType !== "Payment") continue;
      if (meta.TransactionResult !== "tesSUCCESS") {
        if (side(tx.Destination)) nodes.get(v.addr).note = (nodes.get(v.addr).note ? nodes.get(v.addr).note + "; " : "") + `failed drain attempt ${meta.TransactionResult} ${tx.hash.slice(0, 8)}…`;
        continue;
      }
      const a = amountOf(meta.delivered_amount);
      if (!a) continue;
      if (side(tx.Destination)) {
        record(x, v.addr, tx.Destination, a);
        continue;
      }
      const usd = a.other ? 0 : a.amt * at(a.sym, tMs(tx.date)).p;
      if (usd >= 5 * FOLLOW_USD && tx.DestinationTag == null && !isBinance(tx.Destination) && !labels.has(tx.Destination)) warnings.push(`unreviewed: ${v.addr} paid $${Math.round(usd)} untagged to ${tx.Destination} (${tx.hash})`);
    }
  }
  const seen = new Set;
  while (queue.length) {
    const a = queue.shift();
    if (seen.has(a)) continue;
    seen.add(a);
    const me = nodes.get(a);
    for (const x of await txsSince(a, since)) {
      const {tx, meta} = x;
      if (meta.TransactionResult !== "tesSUCCESS") continue;
      if (tx.Account === RLUSD_ISSUER && tx.TransactionType === "TrustSet" && tx.LimitAmount?.issuer === a && tx.Flags & 1048576) freezes.set(tx.hash, {
        key: tx.hash,
        issuer: "Ripple (RLUSD)",
        addr: a,
        t: tMs(tx.date),
        hash: tx.hash,
        sym: "RLUSD"
      });
      if (tx.Account === RLUSD_ISSUER && tx.TransactionType === "Clawback" && tx.Amount?.issuer === a) freezes.set(tx.hash, {
        key: tx.hash,
        issuer: "Ripple (RLUSD clawback)",
        addr: a,
        t: tMs(tx.date),
        hash: tx.hash,
        sym: "RLUSD",
        amt: +tx.Amount.value
      });
      if (tx.Account !== a) continue;
      if (tx.TransactionType === "Payment" && tx.Destination !== a) {
        const am = amountOf(meta.delivered_amount);
        if (!am) continue;
        const usd = am.other ? 0 : am.amt * at(am.sym, tMs(tx.date)).p;
        if (usd < MIN_USD) continue;
        const to = await classify(tx.Destination, tx.DestinationTag, me, usd);
        record(x, a, tx.Destination, am);
        if (to && to.role === "hop" && !seen.has(to.addr)) queue.push(to.addr);
      } else if (/^(OfferCreate|AMMDeposit|Payment)$/.test(tx.TransactionType) || /^AMM/.test(tx.TransactionType)) {
        const own = meta.AffectedNodes.map(n => n.ModifiedNode).find(n => n?.LedgerEntryType === "AccountRoot" && n.FinalFields.Account === a);
        const spent = own?.PreviousFields?.Balance ? (own.PreviousFields.Balance - own.FinalFields.Balance) / 1e6 : 0;
        if (spent > 0) {
          const v = add({
            addr: "venue:XRPL DEX",
            label: "XRPL DEX / AMM",
            plain: "Swaps on the XRP Ledger exchange",
            role: "venue",
            evidence: "OfferCreate/AMM transactions by the attacker side"
          });
          record(x, a, v.addr, {
            sym: "XRP",
            amt: spent
          }, ":dex");
        }
      }
    }
  }
  return {
    chain: "xrpl",
    prices: {
      XRP: now.XRP,
      RLUSD: now.RLUSD
    },
    nodes: [ ...nodes.values() ],
    events: [ ...events.values() ].sort((p, q) => p.t - q.t),
    freezes: [ ...freezes.values() ],
    warnings,
    generatedAt: (new Date).toISOString()
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/").replace(/^\//, "")}` || process.argv[1]?.endsWith("fetch.mjs")) {
  const since = Date.parse(process.argv[2] || "2026-10-29T19:30:00Z");
  fetchChain({
    since
  }).then(r => console.log(JSON.stringify(r, null, 1))).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
