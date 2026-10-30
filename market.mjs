const MIN = 6e4, HOUR = 60 * MIN;

const FINE_FOR = 36 * HOUR;

const CORE = [ "BNB", "BTC", "ETH" ];

const COINS = [ "BNB", "BTC", "ETH", "XRP", "SOL", "TRX", "AVAX" ];

const ROUTES = {
  BNB: [ "coinbase", "kraken", "okx", "coingecko" ],
  BTC: [ "coinbase", "kraken", "okx", "coingecko" ],
  ETH: [ "coinbase", "kraken", "okx", "coingecko" ],
  XRP: [ "coinbase", "kraken", "okx", "coingecko" ],
  SOL: [ "coinbase", "kraken", "okx", "coingecko" ],
  AVAX: [ "coinbase", "kraken", "okx", "coingecko" ],
  TRX: [ "kraken", "okx", "coingecko" ]
};

const KRAKEN = {
  BNB: "BNBUSD",
  BTC: "XBTUSD",
  ETH: "ETHUSD",
  XRP: "XRPUSD",
  SOL: "SOLUSD",
  TRX: "TRXUSD",
  AVAX: "AVAXUSD",
  USDT: "USDTUSD",
  USDC: "USDCUSD"
};

const GECKO = {
  BNB: "binancecoin",
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  SOL: "solana",
  TRX: "tron",
  AVAX: "avalanche-2"
};

const RESERVE_KEYS = {
  BTC: "BTC",
  ETH: "WETH",
  USDT: "USDT",
  USDC: "USDC",
  FDUSD: "FDUSD",
  XRP: "XRP",
  SOL: "SOL",
  TRX: "TRON",
  AVAX: "AVAX"
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const UA = {
  "user-agent": "binance-drain-tracker (market panel)",
  accept: "application/json"
};

async function get(url, {tries = 4, timeout = 2e4, init} = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: UA,
        signal: AbortSignal.timeout(timeout),
        ...init
      });
      if (r.ok) return await r.json();
      last = new Error(`HTTP ${r.status} from ${new URL(url).host}: ${(await r.text()).slice(0, 120)}`);
      if (r.status === 403 || r.status === 401 || r.status === 404 || r.status === 402) break;
      const ra = Number(r.headers.get("retry-after"));
      await sleep(ra > 0 && ra < 60 ? ra * 1e3 : 1e3 * 2 ** i);
    } catch (e) {
      last = e;
      await sleep(1e3 * 2 ** i);
    }
  }
  throw last;
}

async function coinbase(sym, a, b, step) {
  const g = step / 1e3, out = [];
  for (let s = a; s < b; s += 300 * step) {
    const e = Math.min(b, s + 300 * step);
    const d = await get(`https://api.exchange.coinbase.com/products/${sym}-USD/candles?granularity=${g}&start=${new Date(s).toISOString()}&end=${new Date(e).toISOString()}`);
    if (!Array.isArray(d)) throw new Error("coinbase: not a list");
    for (const x of d) out.push([ x[0] * 1e3, +x[4] ]);
    await sleep(150);
  }
  return out;
}

async function kraken(sym, a, b, step) {
  const d = await get(`https://api.kraken.com/0/public/OHLC?pair=${KRAKEN[sym]}&interval=${step / MIN}&since=${Math.floor(a / 1e3) - 1}`);
  if (d.error && d.error.length) throw new Error("kraken: " + d.error.join(" "));
  const k = Object.keys(d.result).find(x => x !== "last");
  return d.result[k].map(x => [ x[0] * 1e3, +x[4] ]);
}

async function okx(instId, a, b, step) {
  const bar = step === HOUR ? "1H" : "5m", out = [];
  let after = b;
  for (let i = 0; i < 60 && after > a; i++) {
    const d = await get(`https://www.okx.com/api/v5/market/history-candles?instId=${instId}&bar=${bar}&after=${after}&limit=100`);
    if (d.code !== "0") throw new Error("okx: " + d.msg);
    if (!d.data.length) break;
    for (const x of d.data) if (x[8] === "1") out.push([ +x[0], +x[4] ]);
    after = +d.data[d.data.length - 1][0];
    await sleep(120);
  }
  return out;
}

async function coingecko(sym, a, b, step) {
  const out = [], span = step === HOUR ? 80 * 24 * HOUR : 24 * HOUR;
  for (let s = a; s < b; s += span) {
    const e = Math.min(b, s + span);
    const d = await get(`https://api.coingecko.com/api/v3/coins/${GECKO[sym]}/market_chart/range?vs_currency=usd&from=${Math.floor(s / 1e3)}&to=${Math.ceil(e / 1e3)}`, {
      tries: 3
    });
    for (const [t, p] of d.prices || []) out.push([ t, p ]);
    await sleep(2500);
  }
  return [ ...new Map(out.map(([t, p]) => [ Math.floor(t / step) * step, p ])).entries() ];
}

const READ = {
  coinbase: (c, a, b, s) => coinbase(c, a, b, s),
  kraken: (c, a, b, s) => kraken(c, a, b, s),
  okx: (c, a, b, s) => okx(`${c}-USDT`, a, b, s),
  coingecko: (c, a, b, s) => coingecko(c, a, b, s)
};

const QUOTE = {
  coinbase: "USD",
  kraken: "USD",
  okx: "USDT",
  coingecko: "USD (aggregate)"
};

function clean(rows, a, b) {
  const m = new Map;
  for (const [t, p] of rows) if (t >= a && t < b && Number.isFinite(p) && p > 0) m.set(t, p);
  return [ ...m.entries() ].sort((x, y) => x[0] - y[0]);
}

function covers(rows, a, b, step) {
  if (rows.length < 3) return "too few points";
  if (rows[0][0] > a + 2 * step) return "starts " + new Date(rows[0][0]).toISOString();
  if (rows[rows.length - 1][0] < b - 3 * step - step) return "ends " + new Date(rows[rows.length - 1][0]).toISOString();
  for (let i = 1; i < rows.length; i++) if (rows[i][0] - rows[i - 1][0] > 2 * HOUR) return "hole at " + new Date(rows[i - 1][0]).toISOString();
  return "";
}

async function series(sym, routes, since, now, notes) {
  const fineEnd = Math.min(now, since + FINE_FOR);
  const parts = [ [ since, Math.floor(fineEnd / (5 * MIN)) * 5 * MIN, 5 * MIN ] ];
  if (now > since + FINE_FOR) parts.push([ since + FINE_FOR, Math.floor(now / HOUR) * HOUR, HOUR ]);
  const pts = [], used = [];
  for (const [a, b, step] of parts) {
    if (b - a < step) continue;
    let ok = false;
    for (const src of routes) {
      try {
        const rows = clean(await READ[src](sym, a, b, step), a, b);
        const why = covers(rows, a, b, step);
        if (why) {
          notes.push(`${sym} ${step === HOUR ? "1h" : "5m"}: ${src} ${why}, tried the next source`);
          continue;
        }
        pts.push(...src === "coingecko" ? rows : rows.map(([t, p]) => [ t + step, p ]));
        used.push(`${src} ${QUOTE[src]} ${step === HOUR ? "1h" : "5m"}`);
        ok = true;
        break;
      } catch (e) {
        notes.push(`${sym}: ${src} failed (${e.message.slice(0, 140)})`);
      }
    }
    if (!ok) return null;
  }
  return {
    rows: pts.map(([t, p]) => [ t, +p.toPrecision(6) ]),
    source: used.join(" + ")
  };
}

async function pegs(since, now, notes) {
  const out = {}, src = {};
  const want = [ [ "USDT/USD", [ () => kraken("USDT", since, now, 5 * MIN), () => coinbase("USDT", since, Math.min(now, since + FINE_FOR), 5 * MIN) ], [ "kraken", "coinbase" ] ], [ "USDC/USD", [ () => kraken("USDC", since, now, 5 * MIN) ], [ "kraken" ] ], [ "USDC/USDT", [ () => okx("USDC-USDT", since, now, 5 * MIN) ], [ "okx" ] ], [ "FDUSD/USDT", [ async () => (await get(`https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair=FDUSD_USDT&interval=5m&from=${Math.floor(since / 1e3)}&to=${Math.floor(now / 1e3)}`)).map(x => [ x[0] * 1e3, +x[2] ]), async () => (await get(`https://api.mexc.com/api/v3/klines?symbol=FDUSDUSDT&interval=5m&startTime=${since}&endTime=${now}&limit=1000`)).map(x => [ x[0], +x[4] ]) ], [ "gate", "mexc" ] ] ];
  for (const [name, readers, names] of want) {
    for (let i = 0; i < readers.length; i++) {
      try {
        const rows = clean(await readers[i](), since, now).filter(([t]) => t < since + FINE_FOR || t % HOUR === 0).map(([t, p]) => [ t + 5 * MIN, +p.toFixed(5) ]);
        if (rows.length < 3) throw new Error("too few points");
        out[name] = rows;
        src[name] = names[i] + " 5m";
        break;
      } catch (e) {
        notes.push(`peg ${name}: ${names[i]} failed (${e.message.slice(0, 120)})`);
      }
    }
  }
  return {
    peg: out,
    src
  };
}

async function perps(since, now, prev, notes) {
  const funding = {}, oi = {}, liq = {};
  for (const c of CORE) {
    const id = `${c}-USDT-SWAP`;
    try {
      const d = await get(`https://www.okx.com/api/v5/public/funding-rate-history?instId=${id}&limit=100`);
      const rows = d.data.map(x => [ +x.fundingTime, +(+x.realizedRate * 100).toFixed(5) ]).filter(([t]) => t >= since - 30 * 24 * HOUR).sort((a, b) => a[0] - b[0]);
      const cur = await get(`https://www.okx.com/api/v5/public/funding-rate?instId=${id}`);
      funding[c] = {
        pct8h: rows,
        next: cur.data[0] ? [ +cur.data[0].fundingTime, +(+cur.data[0].fundingRate * 100).toFixed(5) ] : null
      };
    } catch (e) {
      notes.push(`funding ${c}: okx failed (${e.message.slice(0, 120)})`);
    }
    try {
      for (const period of [ "5m", "1H" ]) {
        const step = period === "1H" ? HOUR : 5 * MIN, rows = [];
        let end = now;
        for (let i = 0; i < 40 && end > since; i++) {
          const d = await get(`https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history?instId=${id}&period=${period}&end=${end}&limit=100`);
          if (d.code !== "0" || !d.data.length) break;
          rows.push(...d.data.map(x => [ +x[0], Math.round(+x[3]) ]));
          end = +d.data[d.data.length - 1][0] - 1;
          await sleep(220);
        }
        const r = clean(rows, since, now + 1);
        if (r.length && r[0][0] <= since + 2 * step) {
          oi[c] = {
            usd: r.filter(([t]) => t < since + FINE_FOR || t % HOUR === 0),
            step: period
          };
          break;
        }
        if (period === "1H") notes.push(`open interest ${c}: okx history starts ${r.length ? new Date(r[0][0]).toISOString() : "nowhere"}`);
      }
    } catch (e) {
      notes.push(`open interest ${c}: okx failed (${e.message.slice(0, 120)})`);
    }
    try {
      liq[c] = await liquidations(c, since, prev && prev.perps && prev.perps.liquidations && prev.perps.liquidations[c]);
    } catch (e) {
      notes.push(`liquidations ${c}: okx failed (${e.message.slice(0, 120)}); kept last run's`);
      if (prev?.perps?.liquidations?.[c]) liq[c] = prev.perps.liquidations[c];
    }
  }
  return {
    funding,
    openInterest: oi,
    liquidations: liq
  };
}

const CT_VAL = {};

async function liquidations(c, since, kept) {
  const uly = `${c}-USDT`;
  if (!CT_VAL[c]) {
    const d = await get(`https://www.okx.com/api/v5/public/instruments?instType=SWAP&instId=${uly}-SWAP`);
    CT_VAL[c] = +d.data[0].ctVal;
  }
  const hours = new Map((kept && kept.hours || []).map(h => [ h[0], h ]));
  const lastTs = kept && kept.lastTs || 0;
  const stop = Math.max(since, lastTs);
  let after = "", newest = lastTs, oldest = Infinity, reached = false;
  for (let i = 0; i < 150; i++) {
    const d = await get(`https://www.okx.com/api/v5/public/liquidation-orders?instType=SWAP&uly=${uly}&state=filled&limit=100${after ? "&after=" + after : ""}`);
    const rows = d.data && d.data[0] && d.data[0].details || [];
    if (!rows.length) break;
    for (const x of rows) {
      const t = +x.ts;
      if (t <= stop) continue;
      newest = Math.max(newest, t);
      oldest = Math.min(oldest, t);
      const h = Math.floor(t / HOUR) * HOUR, usd = +x.sz * CT_VAL[c] * +x.bkPx;
      const r = hours.get(h) || [ h, 0, 0 ];
      if (x.posSide === "long") r[1] += usd; else r[2] += usd;
      hours.set(h, r);
    }
    const mn = Math.min(...rows.map(x => +x.ts));
    if (mn <= stop) {
      reached = true;
      break;
    }
    after = mn;
    await sleep(220);
  }
  const coveredFrom = kept && kept.coveredFrom ? kept.coveredFrom : reached ? since : oldest;
  return {
    hours: [ ...hours.values() ].sort((a, b) => a[0] - b[0]).map(([h, l, s]) => [ h, Math.round(l), Math.round(s) ]),
    lastTs: newest,
    coveredFrom: Number.isFinite(coveredFrom) ? coveredFrom : null
  };
}

async function reserves(since, notes) {
  try {
    const d = await get("https://api.llama.fi/protocol/binance-cex", {
      tries: 3,
      timeout: 6e4
    });
    const from = since - 7 * 24 * HOUR;
    const pts = (d.tokens || []).filter(x => x.date * 1e3 >= from);
    const usd = new Map((d.tokensInUsd || []).map(x => [ x.date, x.tokens ]));
    const units = {};
    for (const [k, key] of Object.entries(RESERVE_KEYS)) units[k] = pts.map(x => [ x.date * 1e3, Math.round(x.tokens[key] || 0) ]);
    const total = (d.tvl || []).filter(x => x.date * 1e3 >= from).map(x => [ x.date * 1e3, Math.round(x.totalLiquidityUSD) ]);
    const lastUsd = pts.length ? usd.get(pts[pts.length - 1].date) || {} : {};
    return {
      units,
      totalUsd: total,
      lastUsd: Object.fromEntries(Object.entries(RESERVE_KEYS).map(([k, key]) => [ k, Math.round(lastUsd[key] || 0) ]))
    };
  } catch (e) {
    notes.push(`reserves: defillama failed (${e.message.slice(0, 120)})`);
    return null;
  }
}

function ratio(a, b) {
  const m = new Map(b.map(([t, p]) => [ t, p ]));
  return a.filter(([t]) => m.has(t)).map(([t, p]) => [ t, +(p / m.get(t)).toPrecision(6) ]);
}

function stats(rows, base) {
  const at = t => {
    let v = null;
    for (const r of rows) {
      if (r[0] <= t) v = r; else break;
    }
    return v;
  };
  const b = at(base);
  if (!b) return null;
  const after = rows.filter(([t]) => t >= base);
  const lo = after.reduce((x, r) => r[1] < x[1] ? r : x, after[0]), last = rows[rows.length - 1];
  const pct = v => +((v / b[1] - 1) * 100).toFixed(2);
  return {
    base: [ b[0], b[1] ],
    low: [ lo[0], lo[1], pct(lo[1]) ],
    last: [ last[0], last[1], pct(last[1]) ]
  };
}

export async function fetchMarket({since = Date.parse("2026-10-29T18:00:00Z"), now = Date.now(), prev = null, withReserves = true} = {}) {
  const notes = [], sources = {}, out = {};
  const t0 = Date.now();
  for (const c of [ ...CORE, ...COINS.filter(c => !CORE.includes(c)) ]) {
    const s = await series(c, ROUTES[c], since, now, notes);
    if (!s) {
      if (CORE.includes(c)) throw new Error(`market: no source covered ${c} from ${new Date(since).toISOString()}; ${notes.filter(n => n.startsWith(c)).join("; ")}`);
      notes.push(`${c}: left out, no source covered it`);
      continue;
    }
    out[c] = s.rows;
    sources[c] = s.source;
  }
  const sameQuote = (x, y) => sources[x].split(" + ").map(s => s.split(" ")[1]).join() === sources[y].split(" + ").map(s => s.split(" ")[1]).join();
  const relative = {};
  for (const y of [ "BTC", "ETH" ]) {
    if (sameQuote("BNB", y)) relative["BNB/" + y] = ratio(out.BNB, out[y]); else notes.push(`BNB/${y}: BNB and ${y} came from venues with different quotes (${sources.BNB} vs ${sources[y]}); ratio left out`);
  }
  const BASE = Date.parse("2026-10-29T20:00:00Z");
  const summary = {};
  for (const [k, rows] of [ ...Object.entries(out), ...Object.entries(relative) ]) summary[k] = stats(rows, BASE);
  const {peg, src: pegSrc} = await pegs(since, now, notes);
  const perp = await perps(since, now, prev, notes);
  const res = withReserves ? await reserves(since, notes) : prev && prev.reserves || null;
  const result = {
    generatedAt: new Date(now).toISOString(),
    since,
    base: BASE,
    series: out,
    relative,
    summary,
    peg,
    perps: perp,
    reserves: res,
    sources: {
      ...sources,
      ...Object.fromEntries(Object.entries(pegSrc).map(([k, v]) => [ "peg " + k, v ])),
      perps: "okx public (funding-rate-history, rubik open-interest-history, liquidation-orders)",
      reserves: res ? "defillama protocol/binance-cex (daily, plus the latest reading)" : null
    },
    notes,
    tookMs: Date.now() - t0
  };
  return result;
}

if (process.argv[1] && process.argv[1].endsWith("market.mjs")) {
  const fs = await (import("node:fs"));
  const file = process.argv[2] || "out.json";
  const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
  const m = await fetchMarket({
    prev
  });
  const s = JSON.stringify(m);
  fs.writeFileSync(file, s);
  console.log(`wrote ${file}: ${(s.length / 1024).toFixed(0)} KB in ${(m.tookMs / 1e3).toFixed(1)} s`);
  for (const [k, v] of Object.entries(m.sources)) console.log(`  ${k.padEnd(16)} ${v}`);
  for (const n of m.notes) console.log("  note: " + n);
}
