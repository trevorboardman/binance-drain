const START = Date.parse("2026-10-29T20:18:00Z");

const HOSTS = [ "https://mempool.space/api", "https://blockstream.info/api" ];

const PACE_MS = 120;

const MIN_EVENT_USD = 1e4;

const FOLLOW_USD = 1e6;

const MAX_DEPTH = 4;

const SERVICE_TXS = 1e3;

const MAX_VICTIM_PAGES = 400;

const short = a => a.slice(0, 6) + "…" + a.slice(-4);

const VICTIMS = [ {
  addr: "bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h",
  label: "Binance BTC hot wallet (bc1qm34l…7s3h)",
  plain: "Binance Bitcoin wallet",
  evidence: "Whale Alert labels it Binance; 2.37M transactions; sweeps to Binance cold wallet 3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6 (e.g. tx bb50fcd1… 29 Oct 23:16 UTC)"
} ];

const HUBS = [ {
  addr: "bc1q0mtc2f5agpkvlq6hhahmfr3hlr55kyfjhl2mnm",
  label: "BTC attacker hub (bc1q0mtc…2mnm)",
  plain: "Attacker Bitcoin wallet",
  evidence: "First transaction 29 Oct 20:20:06 UTC (block 973732): 11 outputs from the Binance hot wallet, 18,270.2 BTC; split the same block into 17 x 1,000 BTC + 437.7 + 832.5 BTC. TRM Labs and TechFlow report the same 18,270 BTC / 11 txs / 19 wallets."
} ];

const BINANCE = {
  "34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo": "Binance cold wallet",
  "3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6": "Binance cold wallet",
  "3LYJfcfHPXYJreMsASk2jkn69LWEYKzexb": "Binance cold wallet",
  bc1qx9t2l3pyny2spqpqlye8svce70nppwtaxwdrp4: "Binance wallet",
  "1Pzaqw98PeRfyHypfqyEgg5yycJRsENrE7": "Binance wallet",
  "1NDyJtNTjmwk5xPNhjgAMu4HDHigtobu1s": "Binance hot wallet",
  "1LQoWist8KkaUXSPKZHNvEyfrEkPHzSsCd": "Binance hot wallet"
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

let host = 0, calls = 0;

async function api(path) {
  let last;
  for (let i = 0; i < 8; i++) {
    const base = HOSTS[(host + Math.floor(i / 2)) % HOSTS.length];
    await sleep(PACE_MS);
    calls++;
    try {
      const r = await fetch(base + path, {
        headers: {
          accept: "application/json"
        }
      });
      if (r.ok) {
        host = HOSTS.indexOf(base);
        return r.json();
      }
      last = new Error(`${r.status} ${base}${path}`);
      if (r.status === 400 || r.status === 404) throw last;
    } catch (e) {
      last = e;
      if (/^(400|404) /.test(e.message)) throw e;
    }
    await sleep(1e3 * (i + 1));
  }
  throw last;
}

const minuteCache = new Map;

async function priceAt(tSec) {
  const m = Math.floor(tSec / 60) * 60;
  if (minuteCache.has(m)) return minuteCache.get(m);
  let p = null;
  try {
    const s = new Date((m - 300) * 1e3).toISOString(), e = new Date((m + 60) * 1e3).toISOString();
    const r = await fetch(`https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=60&start=${s}&end=${e}`);
    if (r.ok) {
      const rows = await r.json();
      const row = rows.find(x => x[0] <= m) || rows[rows.length - 1];
      if (row) p = row[4];
    }
  } catch {}
  minuteCache.set(m, p);
  return p;
}

async function spotPrice() {
  try {
    const r = await fetch("https://api.exchange.coinbase.com/products/BTC-USD/ticker");
    if (r.ok) {
      const j = await r.json();
      if (+j.price > 0) return +j.price;
    }
  } catch {}
  try {
    const r = await fetch("https://api.kraken.com/0/public/Ticker?pair=XBTUSD");
    if (r.ok) {
      const j = await r.json();
      const k = Object.values(j.result || {})[0];
      if (k) return +k.c[0];
    }
  } catch {}
  throw new Error("btc: no BTC/USD spot price from Coinbase or Kraken");
}

const txCache = new Map, addrCache = new Map, osCache = new Map;

async function tx(id) {
  if (!txCache.has(id)) txCache.set(id, await api(`/tx/${id}`));
  return txCache.get(id);
}

async function addrInfo(a) {
  if (!addrCache.has(a)) addrCache.set(a, await api(`/address/${a}`));
  return addrCache.get(a);
}

async function outspends(id) {
  if (!osCache.has(id)) osCache.set(id, await api(`/tx/${id}/outspends`));
  return osCache.get(id);
}

const balOf = info => {
  const c = info.chain_stats, m = info.mempool_stats;
  return (c.funded_txo_sum - c.spent_txo_sum + m.funded_txo_sum - m.spent_txo_sum) / 1e8;
};

async function addrTxsSince(a, sinceSec, maxPages) {
  const out = [ ...await api(`/address/${a}/txs/mempool`) ];
  let last = null;
  for (let p = 0; p < maxPages; p++) {
    const page = await api(`/address/${a}/txs/chain${last ? "/" + last : ""}`);
    if (!page.length) break;
    out.push(...page);
    last = page[page.length - 1].txid;
    if (page[page.length - 1].status.block_time < sinceSec) break;
    if (p === maxPages - 1) console.warn(`btc: ${a} has more than ${maxPages} pages since the start; older ones skipped`);
  }
  return out.filter(t => !t.status.confirmed || t.status.block_time >= sinceSec);
}

async function looksLikeDeposit(a) {
  const txs = await api(`/address/${a}/txs`);
  for (const t of txs) {
    if (!t.vin.some(v => v.prevout?.scriptpubkey_address === a)) continue;
    const others = new Set(t.vin.map(v => v.prevout?.scriptpubkey_address).filter(x => x && x !== a));
    if (others.size >= 10) return true;
  }
  return false;
}

export async function fetchChain({since = START} = {}) {
  const sinceSec = Math.floor(since / 1e3);
  const spot = await spotPrice();
  const nodes = new Map, events = [], warnings = [];
  const add = n => {
    if (!nodes.has(n.addr)) nodes.set(n.addr, n);
    return nodes.get(n.addr);
  };
  const side = n => n && (n.role === "hub" || n.role === "hop" || n.role === "attacker");
  for (const v of VICTIMS) add({
    ...v,
    role: "victim"
  });
  for (const h of HUBS) add({
    ...h,
    role: "hub",
    depth: 0
  });
  async function pushEvent(t, vout, from, usdPrice) {
    const o = t.vout[vout];
    const amt = o.value / 1e8;
    const p = t.status.confirmed ? await priceAt(t.status.block_time) : null;
    const price = p ?? usdPrice;
    const net = new Map, got = new Map;
    for (const x of t.vin) {
      const ad = x.prevout?.scriptpubkey_address;
      if (ad) net.set(ad, (net.get(ad) || 0) - x.prevout.value);
    }
    for (const y of t.vout) {
      const ad = y.scriptpubkey_address;
      if (ad) {
        net.set(ad, (net.get(ad) || 0) + y.value);
        got.set(ad, (got.get(ad) || 0) + y.value);
      }
    }
    const to = o.scriptpubkey_address;
    const gain = t.vin.some(x => x.prevout?.scriptpubkey_address === to) ? Math.max(0, net.get(to)) / got.get(to) : 1;
    const amtIn = amt * gain;
    if (amtIn * price < MIN_EVENT_USD) return null;
    const put = new Map;
    for (const [ad, v] of net) if (v < 0 && (ad === from || nodes.has(ad))) put.set(ad, -v);
    const all = [ ...net.values() ].reduce((a, v) => a + (v < 0 ? -v : 0), 0) || 1;
    let ev = null;
    for (const [ad, v] of put) {
      const part = amtIn * v / all;
      ev = {
        key: [ ...net.values() ].filter(v => v < 0).length > 1 ? `${t.txid}:${vout}:${ad.slice(-8)}` : `${t.txid}:${vout}`,
        t: t.status.confirmed ? t.status.block_time * 1e3 : Date.now(),
        from: ad,
        to: o.scriptpubkey_address,
        sym: "BTC",
        amt: part,
        usd: Math.round(part * price * 100) / 100,
        price: p ? "at-move" : "spot",
        hash: t.txid,
        block: t.status.block_height ?? null
      };
      if (ev.t >= since) events.push(ev);
    }
    return ev;
  }
  for (const v of VICTIMS) {
    const txs = await addrTxsSince(v.addr, sinceSec - 3600, MAX_VICTIM_PAGES);
    for (const t of txs) {
      const ins = new Set(t.vin.map(x => x.prevout?.scriptpubkey_address));
      if (!ins.has(v.addr)) continue;
      for (let i = 0; i < t.vout.length; i++) {
        const to = t.vout[i].scriptpubkey_address;
        if (ins.has(to)) continue;
        const n = nodes.get(to);
        if (side(n)) await pushEvent(t, i, v.addr, spot); else if (t.vout[i].value >= 5e10 && !BINANCE[to] && t.status.block_time >= sinceSec) warnings.push(`unexplained victim outflow ${t.vout[i].value / 1e8} BTC to ${to} in ${t.txid}`);
      }
    }
  }
  const queue = [];
  for (const h of HUBS) {
    const txs = await api(`/address/${h.addr}/txs`);
    for (const t of txs) {
      txCache.set(t.txid, t);
      t.vout.forEach((o, i) => {
        if (o.scriptpubkey_address === h.addr) queue.push({
          txid: t.txid,
          vout: i,
          depth: 0,
          block: t.status.block_height
        });
      });
    }
  }
  const seen = new Set;
  while (queue.length) {
    const q = queue.shift();
    const k = `${q.txid}:${q.vout}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const os = (await outspends(q.txid))[q.vout];
    if (!os || !os.spent) continue;
    const st = await tx(os.txid);
    const ins = new Set(st.vin.map(x => x.prevout?.scriptpubkey_address));
    const sameBlock = st.status.block_height != null && st.status.block_height === q.block;
    const depth = Math.max(1, q.depth + (sameBlock ? 0 : 1));
    const from = st.vin.find(x => side(nodes.get(x.prevout?.scriptpubkey_address)))?.prevout.scriptpubkey_address;
    for (let i = 0; i < st.vout.length; i++) {
      const o = st.vout[i], to = o.scriptpubkey_address;
      if (!to || ins.has(to)) {
        if (to && from && nodes.has(to)) await pushEvent(st, i, from, spot);
        if (to && side(nodes.get(to))) queue.push({
          txid: st.txid,
          vout: i,
          depth: nodes.get(to).depth ?? depth,
          block: st.status.block_height
        });
        continue;
      }
      const amt = o.value / 1e8;
      const usdNow = amt * spot;
      let n = nodes.get(to);
      if (!n) {
        if (BINANCE[to]) n = add({
          addr: to,
          label: BINANCE[to],
          plain: "Back to Binance",
          role: "recovered",
          evidence: "known Binance wallet"
        }); else if (usdNow >= MIN_EVENT_USD) {
          const info = await addrInfo(to);
          if (info.chain_stats.tx_count >= SERVICE_TXS) n = add({
            addr: to,
            label: "Service " + short(to),
            plain: "Exchange or service",
            role: "venue",
            evidence: `${info.chain_stats.tx_count} transactions`
          }); else if (usdNow >= FOLLOW_USD && depth <= MAX_DEPTH && !await looksLikeDeposit(to)) n = add({
            addr: to,
            label: "Wallet " + short(to),
            plain: "Attacker wallet",
            role: "hop",
            depth,
            evidence: `received ${amt} BTC from attacker-side ${from ? short(from) : "?"} in ${st.txid}`
          }); else if (usdNow >= FOLLOW_USD && depth <= MAX_DEPTH) n = add({
            addr: to,
            label: "Deposit " + short(to),
            plain: "Exchange deposit",
            role: "venue",
            evidence: "swept with many unrelated inputs"
          }); else n = add({
            addr: to,
            label: "Wallet " + short(to),
            plain: "Other wallet (not followed)",
            role: "untraced",
            depth
          });
        }
      }
      if (from) await pushEvent(st, i, from, spot);
      if (n && side(n)) queue.push({
        txid: st.txid,
        vout: i,
        depth: n.depth,
        block: st.status.block_height
      });
    }
  }
  for (const n of nodes.values()) {
    if (n.role !== "victim" && !side(n)) continue;
    const info = await addrInfo(n.addr);
    n.held = {
      BTC: balOf(info)
    };
    n.heldUsd = Math.round(n.held.BTC * spot);
    n.note = n.note || (side(n) ? `holds ${n.held.BTC.toFixed(4)} BTC` : undefined);
  }
  for (const w of warnings) console.warn("btc: " + w);
  events.sort((a, b) => a.t - b.t || (a.key < b.key ? -1 : 1));
  return {
    chain: "btc",
    prices: {
      BTC: spot
    },
    priceNote: 'event usd = Coinbase BTC-USD 1-minute close for the block minute ("at-move"); prices.BTC = spot now',
    nodes: [ ...nodes.values() ].map(({addr, label, plain, role, depth, note, evidence, held, heldUsd}) => ({
      addr,
      label,
      plain,
      role,
      ...depth != null && {
        depth
      },
      note,
      evidence,
      held,
      heldUsd
    })),
    events,
    freezes: [],
    warnings,
    apiCalls: calls
  };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("fetch.mjs")) {
  const since = process.argv[2] ? Date.parse(process.argv[2]) : START;
  fetchChain({
    since
  }).then(r => process.stdout.write(JSON.stringify(r, null, 1) + "\n"), e => {
    console.error(e);
    process.exit(1);
  });
}
