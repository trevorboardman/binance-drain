const MAINNET = "https://api.mainnet-beta.solana.com";

const PUBLICNODE = "https://solana-rpc.publicnode.com";

const SYSTEM = "11111111111111111111111111111111";

const MINTS = {
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
    sym: "USDC",
    issuer: "Circle",
    usd: 1
  },
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {
    sym: "USDT",
    issuer: "Tether",
    usd: 1
  },
  So11111111111111111111111111111111111111112: {
    sym: "SOL"
  }
};

const VICTIMS = {
  "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9": "Binance hot wallet (SOL/SPL withdrawals)"
};

const BINANCE_OTHER = {
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM": "Binance wallet (11.9M SOL; took the 23:02 sweep)",
  H8BgJgae6qhMtf7BM2JtddywSQt11WdxHHxkGLNX5hss: "Binance USDC reserve (tops up 5tzF since at least Aug 2026)"
};

const SEED_HUBS = [ "AffzFDKZbyMiU11zmVBoAqD25ugpr7xoWWyRyGigBEaU" ];

const KNOWN_VENUES = {
  "41zCUJsKk6cMB94DDtm99qWmyMZfp4GkAhhuz4xTwePu": "busy service wallet (normal Binance withdrawal destination)"
};

const DRAIN_FROM = Date.UTC(2026, 9, 29, 20, 0) / 1e3;

const MIN_USD = 1e4;

const FOLLOW_USD = 1e6;

const MAX_DEPTH = 4;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(url, method, params) {
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params
    })
  });
  if (r.status !== 200) throw Object.assign(new Error(`${url} ${method} HTTP ${r.status}`), {
    retry: true
  });
  const j = await r.json();
  if (j.error) {
    const retry = j.error.code === 429 || /rate|limit|unavailable|timeout|busy/i.test(j.error.message || "");
    throw Object.assign(new Error(`${url} ${method} ${JSON.stringify(j.error)}`), {
      retry
    });
  }
  return j.result;
}

async function rpc(method, params, {historyOnly = false} = {}) {
  let last;
  for (let i = 0; i < 10; i++) {
    const url = historyOnly ? MAINNET : i % 2 === 0 ? PUBLICNODE : MAINNET;
    try {
      return await post(url, method, params);
    } catch (e) {
      last = e;
      if (!e.retry && !/fetch failed|ECONN|socket/i.test(String(e))) throw e;
      await sleep(700 * (i + 1));
    }
  }
  throw new Error(`rpc gave up: ${last}`);
}

async function signaturesSince(addr, sinceSec) {
  const out = [];
  let before;
  for (;;) {
    const page = await rpc("getSignaturesForAddress", [ addr, {
      limit: 1e3,
      before
    } ], {
      historyOnly: true
    });
    if (!page.length) return out;
    for (const s of page) {
      if (s.blockTime != null && s.blockTime < sinceSec) return out;
      out.push(s);
    }
    before = page[page.length - 1].signature;
  }
}

async function getTx(sig) {
  const opts = {
    encoding: "jsonParsed",
    maxSupportedTransactionVersion: 0,
    commitment: "confirmed"
  };
  for (const url of [ PUBLICNODE, MAINNET ]) {
    for (let i = 0; i < 8; i++) {
      try {
        const t = await post(url, "getTransaction", [ sig, opts ]);
        if (t) return t;
        break;
      } catch (e) {
        if (!e.retry) break;
        await sleep(800 * (i + 1));
      }
    }
  }
  throw new Error(`getTransaction failed on both RPCs: ${sig}`);
}

async function pmap(arr, n, f) {
  const out = new Array(arr.length);
  let i = 0;
  await Promise.all(Array.from({
    length: n
  }, async () => {
    while (i < arr.length) {
      const k = i++;
      out[k] = await f(arr[k], k);
    }
  }));
  return out;
}

function transfers(t) {
  const out = [];
  if (!t || t.meta?.err) return out;
  const keys = t.transaction.message.accountKeys.map(k => k.pubkey || k);
  const owner = {}, mintOf = {}, dec = {};
  for (const b of [ ...t.meta.preTokenBalances || [], ...t.meta.postTokenBalances || [] ]) {
    owner[keys[b.accountIndex]] = b.owner;
    mintOf[keys[b.accountIndex]] = b.mint;
    dec[b.mint] = b.uiTokenAmount.decimals;
  }
  const ins = t.transaction.message.instructions.map((x, i) => [ String(i), x ]);
  for (const g of t.meta.innerInstructions || []) g.instructions.forEach((x, j) => ins.push([ `${g.index}.${j}`, x ]));
  for (const [idx, x] of ins) {
    const p = x.parsed;
    if (!p || typeof p !== "object") continue;
    const info = p.info || {};
    if (x.program === "system" && (p.type === "transfer" || p.type === "transferWithSeed")) {
      out.push({
        idx,
        from: info.source,
        to: info.destination,
        mint: "SOL",
        amt: info.lamports / 1e9
      });
    } else if ((x.program === "spl-token" || x.program === "spl-token-2022") && /^transfer(Checked)?$/.test(p.type)) {
      const mint = info.mint || mintOf[info.source] || mintOf[info.destination];
      const amt = info.tokenAmount ? Number(info.tokenAmount.uiAmountString) : Number(info.amount) / 10 ** (dec[mint] ?? 0);
      out.push({
        idx,
        mint,
        amt,
        from: owner[info.source] || info.authority || info.multisigAuthority,
        to: owner[info.destination] || info.destination
      });
    }
  }
  return out;
}

const isToolingTx = t => t.transaction.message.instructions[0]?.parsed?.type === "advanceNonce";

async function solPriceSeries(fromSec, toSec) {
  try {
    const u = `https://api.coingecko.com/api/v3/coins/solana/market_chart/range?vs_currency=usd&from=${fromSec - 600}&to=${toSec + 600}`;
    const r = await fetch(u);
    if (r.ok) {
      const j = await r.json();
      if (j.prices?.length) return j.prices.map(([ms, p]) => [ ms / 1e3, p ]);
    }
  } catch {}
  try {
    const r = await fetch(`https://api.kraken.com/0/public/OHLC?pair=SOLUSD&interval=5&since=${fromSec - 600}`);
    const j = await r.json();
    const rows = Object.values(j.result || {}).find(Array.isArray) || [];
    if (rows.length) return rows.map(x => [ x[0], Number(x[4]) ]);
  } catch {}
  return [];
}

async function solPriceNow() {
  try {
    const j = await (await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd")).json();
    if (j.solana?.usd) return j.solana.usd;
  } catch {}
  const j = await (await fetch("https://api.kraken.com/0/public/Ticker?pair=SOLUSD")).json();
  return Number(Object.values(j.result)[0].c[0]);
}

export async function fetchChain({since}) {
  const sinceSec = Math.floor(since / 1e3);
  const scanFrom = Math.min(sinceSec, DRAIN_FROM);
  const solNow = await solPriceNow();
  const prices = {
    SOL: solNow,
    USDC: 1,
    USDT: 1
  };
  const nodes = new Map;
  const addNode = (addr, o) => {
    if (!nodes.has(addr)) nodes.set(addr, {
      addr,
      ...o
    });
  };
  for (const [a, label] of Object.entries(VICTIMS)) {
    addNode(a, {
      label,
      plain: true,
      role: "victim",
      note: "",
      evidence: "Binance withdrawal tooling (durable nonce + priority fee) on ~1,700 txs in 4 h; two-way USDC history with Binance reserve H8Bg since Aug 2026; swept into Binance wallet 9WzD at 23:02 UTC"
    });
  }
  const rawEvents = [];
  const seenEv = new Set;
  const pushEv = (t, f, extra = {}) => {
    const key = `${t.transaction.signatures[0]}:${f.idx}`;
    if (seenEv.has(key)) return;
    seenEv.add(key);
    rawEvents.push({
      key,
      t: t.blockTime * 1e3,
      from: f.from,
      to: f.to,
      mint: f.mint,
      amt: f.amt,
      hash: t.transaction.signatures[0],
      block: t.slot,
      ...extra
    });
  };
  const approxUsd = f => f.mint === "SOL" || f.mint === "So11111111111111111111111111111111111111112" ? f.amt * solNow : MINTS[f.mint]?.usd ? f.amt * MINTS[f.mint].usd : 0;
  const hubs = new Set(SEED_HUBS);
  for (const v of Object.keys(VICTIMS)) {
    const sigs = (await signaturesSince(v, scanFrom)).filter(s => !s.err);
    const txs = await pmap(sigs, 4, s => getTx(s.signature));
    for (const t of txs) {
      const signedByVictim = t.transaction.message.accountKeys.some(k => k.signer && k.pubkey === v);
      for (const f of transfers(t)) {
        if (f.from !== v || approxUsd(f) < MIN_USD) continue;
        if (hubs.has(f.to) || signedByVictim && !isToolingTx(t)) {
          hubs.add(f.to);
          pushEv(t, f);
        }
      }
    }
  }
  const accountKind = async a => {
    if (VICTIMS[a] || BINANCE_OTHER[a]) return "binance";
    if (KNOWN_VENUES[a]) return "venue";
    const ai = await rpc("getAccountInfo", [ a, {
      encoding: "base64",
      dataSlice: {
        offset: 0,
        length: 0
      }
    } ]);
    if (!ai.value) return "plain";
    if (ai.value.executable || ai.value.owner !== SYSTEM) return "venue";
    return "plain";
  };
  let frontier = [ ...hubs ].map(a => ({
    a,
    depth: 0
  }));
  const visited = new Set;
  while (frontier.length) {
    const next = [];
    for (const {a, depth} of frontier) {
      if (visited.has(a)) continue;
      visited.add(a);
      addNode(a, depth === 0 ? {
        label: "Attacker hub",
        plain: true,
        role: "hub",
        depth: 0,
        note: "",
        evidence: "Received drain transfers from the Binance hot wallet in txs that bypass Binance tooling"
      } : {
        label: `Attacker hop ${depth}`,
        plain: true,
        role: "hop",
        depth,
        note: "",
        evidence: "Received $1M+ from an attacker-side wallet"
      });
      const sigs = (await signaturesSince(a, Math.min(sinceSec, DRAIN_FROM))).filter(s => !s.err);
      const txs = await pmap(sigs, 4, s => getTx(s.signature));
      const sentTo = new Map;
      for (const t of txs) {
        for (const f of transfers(t)) {
          if (f.from !== a && f.to !== a) continue;
          if (approxUsd(f) < MIN_USD) continue;
          pushEv(t, f);
          if (f.from === a) sentTo.set(f.to, (sentTo.get(f.to) || 0) + approxUsd(f));
        }
      }
      for (const [to, usd] of sentTo) {
        if (visited.has(to)) continue;
        const kind = await accountKind(to);
        if (kind === "binance") {
          addNode(to, {
            label: VICTIMS[to] || BINANCE_OTHER[to],
            plain: true,
            role: "recovered",
            note: "Binance wallet",
            evidence: "history"
          });
          continue;
        }
        if (kind === "venue") {
          addNode(to, {
            label: KNOWN_VENUES[to] || "Program-owned account",
            plain: false,
            role: "venue",
            note: "",
            evidence: "not owned by the System Program, or a known service"
          });
          continue;
        }
        if (usd >= FOLLOW_USD && depth + 1 <= MAX_DEPTH) next.push({
          a: to,
          depth: depth + 1
        }); else addNode(to, {
          label: "Unfollowed wallet",
          plain: true,
          role: "hop",
          depth: depth + 1,
          note: usd < FOLLOW_USD ? "got under $1M; not followed" : "beyond 4 hops; not followed",
          evidence: ""
        });
      }
    }
    frontier = next;
  }
  const freezes = [];
  for (const n of nodes.values()) {
    if (n.role !== "hub" && n.role !== "hop") continue;
    const lam = (await rpc("getBalance", [ n.addr ])).value;
    n.held = {
      SOL: lam / 1e9
    };
    for (const prog of [ "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb" ]) {
      const ta = await rpc("getTokenAccountsByOwner", [ n.addr, {
        programId: prog
      }, {
        encoding: "jsonParsed"
      } ]);
      for (const v of ta.value) {
        const info = v.account.data.parsed.info;
        const m = MINTS[info.mint];
        if (!m?.issuer) continue;
        const amt = Number(info.tokenAmount.uiAmountString);
        if (amt > 0) n.held[m.sym] = (n.held[m.sym] || 0) + amt;
        if (info.state === "frozen") {
          let hash = null, t = null;
          for (const s of await rpc("getSignaturesForAddress", [ v.pubkey, {
            limit: 50
          } ], {
            historyOnly: true
          })) {
            const tx = await getTx(s.signature);
            if (tx.transaction.message.instructions.some(i => i.parsed?.type === "freezeAccount")) {
              hash = s.signature;
              t = tx.blockTime * 1e3;
              break;
            }
          }
          freezes.push({
            key: `${hash || v.pubkey}:freeze`,
            issuer: m.issuer,
            addr: n.addr,
            t,
            hash,
            sym: m.sym,
            amt,
            usd: amt * m.usd
          });
        }
      }
    }
    n.heldUsd = Math.round((n.held.SOL || 0) * solNow + (n.held.USDC || 0) + (n.held.USDT || 0));
  }
  const solTimes = rawEvents.filter(e => e.mint === "SOL" || e.mint === "So11111111111111111111111111111111111111112").map(e => e.t / 1e3);
  const series = solTimes.length ? await solPriceSeries(Math.min(...solTimes), Math.max(...solTimes)) : [];
  const priceAt = sec => {
    let best = null;
    for (const [ts, p] of series) if (ts <= sec && (!best || ts > best[0])) best = [ ts, p ];
    return best && sec - best[0] <= 900 ? best[1] : null;
  };
  const events = rawEvents.map(e => {
    const isSol = e.mint === "SOL" || e.mint === "So11111111111111111111111111111111111111112";
    const sym = isSol ? "SOL" : MINTS[e.mint]?.sym || e.mint;
    let usd = null, priced = "at-time";
    if (isSol) {
      const p = priceAt(e.t / 1e3);
      usd = (p ?? solNow) * e.amt;
      if (p == null) priced = "today";
    } else if (MINTS[e.mint]?.usd) usd = e.amt * MINTS[e.mint].usd;
    return {
      key: e.key,
      t: e.t,
      from: e.from,
      to: e.to,
      sym,
      amt: e.amt,
      usd: usd == null ? null : Math.round(usd),
      priced,
      hash: e.hash,
      block: e.block
    };
  }).sort((a, b) => a.t - b.t);
  return {
    chain: "sol",
    prices,
    nodes: [ ...nodes.values() ],
    events,
    freezes
  };
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/").replace(/^([A-Za-z]):/, "/$1:")}` || process.argv[1]?.endsWith("fetch.mjs")) {
  const since = Date.parse(process.argv[2] || "2026-10-29T20:18:00Z");
  const out = await fetchChain({
    since
  });
  const fs = await (import("node:fs"));
  const path = new URL("./out.json", import.meta.url);
  fs.writeFileSync(path, JSON.stringify(out, null, 2));
  console.log(`events ${out.events.length}, nodes ${out.nodes.length}, freezes ${out.freezes.length}`);
}
