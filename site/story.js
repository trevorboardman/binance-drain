import { makeState, loadData, tankSteps, tankLevels, CHAINS } from "./core.js?v=12";

const Q = new URLSearchParams(location.search);

if (Q.has("og")) document.body.classList.add("og");

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = id => document.getElementById(id);

const esc = s => String(s).replace(/[&<>"]/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;"
}[c]));

const START = Date.parse("2026-10-29T20:00:00Z");

const HOUR_END = START + 36e5;

const OLD = 45 * 6e4;

const URL_HOME = "https://binance.trevorboardman.com/";

const words = v => v >= 1e9 ? "$" + (v / 1e9).toFixed(1) + " billion" : v >= 1e6 ? "$" + Math.round(v / 1e6) + " million" : "$" + Math.round(v / 1e3) + " thousand";

const short = v => v >= 1e9 ? "$" + (v / 1e9).toFixed(v >= 1e10 ? 0 : 1) + "B" : v >= 1e6 ? "$" + Math.round(v / 1e6) + "M" : v >= 1e3 ? "$" + Math.round(v / 1e3) + "K" : "$0";

const table = v => v >= 1e9 ? "$" + (v / 1e9).toFixed(2) + "B" : v >= 1e6 ? "$" + Math.round(v / 1e6) + "M" : v >= 1e4 ? "$" + Math.round(v / 1e3) + "K" : "–";

const hm = t => new Date(t).toISOString().slice(11, 16);

const ago = t => {
  const m = Math.max(0, (Date.now() - t) / 6e4);
  return m < 1.5 ? "a minute" : m < 90 ? Math.round(m) + " minutes" : (m / 60).toFixed(1) + " hours";
};

const TIMES = [ "", "as large as", "twice", "three times", "four times", "five times", "six times", "seven times", "eight times", "nine times", "ten times" ];

const timesWord = r => r >= 2 ? "more than " + (TIMES[Math.floor(r)] || Math.floor(r) + " times") : "larger than";

const chainKey = k => {
  const p = String(k).split(":")[0];
  return CHAINS[p] && p !== "eth" ? p : "eth";
};

const txOf = k => {
  const p = String(k).split(":");
  return chainKey(k) === "eth" ? p[0] : p[1];
};

let D = null, gen = 0, fetchErr = "";

function compute(data) {
  const S = makeState();
  loadData(S, data);
  const {steps, missing} = tankSteps(S, START);
  const L = tankLevels(steps);
  const outs = steps.filter(s => s.a === "B");
  if (!outs.length) throw new Error("data.json has no payments out of Binance");
  const byTx = new Map;
  for (const s of outs) {
    const k = txOf(s.key), x = byTx.get(k) || {
      t: s.t,
      v: 0,
      chain: chainKey(s.key),
      usd: 0
    };
    x.v += s.v;
    if (s.cls === "usd") x.usd += s.v;
    byTx.set(k, x);
  }
  const txs = [ ...byTx.values() ].sort((a, b) => a.t - b.t);
  const chains = {};
  for (const c of new Set(steps.map(s => chainKey(s.key)))) {
    const own = steps.filter(s => chainKey(s.key) === c), Lc = tankLevels(own), first = own.find(s => s.a === "B");
    if (first) chains[c] = {
      B: Lc.B,
      M: Lc.M,
      F: Lc.F,
      first: first.t
    };
  }
  const fz = [ ...S.freezes.values() ].sort((a, b) => a.t - b.t);
  const firstFreeze = {};
  for (const z of fz) if (!firstFreeze[z.issuer]) firstFreeze[z.issuer] = z.t;
  return {
    S,
    steps,
    L,
    outs,
    txs,
    chains,
    firstFreeze,
    missing,
    gen: Date.parse(data.generatedAt || "") || 0
  };
}

function hero() {
  const {L, outs, txs} = D;
  const t0 = outs[0].t, in20 = outs.filter(s => s.t <= t0 + 20 * 6e4).reduce((a, s) => a + s.v, 0);
  if (!RP.on) {
    $("hAmt").textContent = words(L.B);
    chips(Infinity);
  }
  $("dFast").textContent = words(in20);
  $("sTaken").textContent = short(L.B);
  $("sHeld").textContent = short(L.M);
  $("sFrozen").textContent = short(L.F);
  const coins = L.M > 0 ? Math.round(L.by.M.eth / L.M * 100) : 0;
  $("sHeldSub").textContent = coins >= 50 ? `${coins}% of it in Bitcoin, Ether and other coins nobody can freeze` : "the attacker can still move it";
  const sweep = txs.reduce((m, x) => x.chain === "eth" && x.v > m.v ? x : m, {
    v: 0
  });
  if (sweep.v) $("tlSweep").textContent = words(sweep.v);
  $("recordTxt").textContent = `It is ${timesWord(L.B / 15e8)} the Bybit hack of February 2025, which until now was the biggest theft from an exchange. The FBI blamed North Korea for that one.`;
}

const RP = {
  on: false,
  raf: 0,
  done: false
};

const RP_FROM = Date.parse("2026-10-29T20:04:30Z"), RP_TO = Date.parse("2026-10-29T20:25:00Z"), RP_MS = 8200;

function chips(t) {
  const rows = Object.entries(D.chains).sort((a, b) => a[1].first - b[1].first);
  const box = $("chips");
  if (box.children.length !== rows.length) box.innerHTML = rows.map(([c]) => `<span class="chip" data-c="${esc(c)}"><b>${esc(CHAINS[c].name)}</b><em></em></span>`).join("");
  for (const [c, r] of rows) {
    const el = box.querySelector(`[data-c="${c}"]`), v = t === Infinity ? r.B : D.outs.reduce((a, s) => s.t <= t && chainKey(s.key) === c ? a + s.v : a, 0);
    el.classList.toggle("on", v > 0);
    el.querySelector("em").textContent = v > 0 ? short(v) : "";
  }
}

function clockAt(t) {
  $("clk").textContent = new Date(t).toISOString().slice(11, 19);
}

function settle() {
  RP.on = false;
  RP.done = true;
  cancelAnimationFrame(RP.raf);
  $("hAmt").textContent = words(D.L.B);
  chips(Infinity);
  $("clk").textContent = "20:05–20:25";
  $("clkL").textContent = `London time: ${words(cumAt(RP_TO))} gone in 20 minutes`;
  $("skip").textContent = "Replay";
}

function replay() {
  if (!D) return;
  cancelAnimationFrame(RP.raf);
  const a = $("hAmt");
  a.style.minWidth = "";
  a.textContent = words(D.L.B);
  a.style.minWidth = a.getBoundingClientRect().width + "px";
  RP.on = true;
  $("skip").textContent = "Skip";
  $("clkL").textContent = "London time, 29 October";
  const t0 = performance.now();
  const go = now => {
    const f = Math.min(1, (now - t0) / RP_MS), t = RP_FROM + f * (RP_TO - RP_FROM);
    clockAt(t);
    a.textContent = cumAt(t) > 0 ? words(cumAt(t)) : "$0";
    chips(t);
    if (f < 1) RP.raf = requestAnimationFrame(go); else RP.raf = setTimeout(settle, 1400);
  };
  RP.raf = requestAnimationFrame(go);
}

$("skip").addEventListener("click", () => {
  if (RP.on) {
    clearTimeout(RP.raf);
    settle();
  } else replay();
});

function status() {
  const old = !gen || Date.now() - gen > OLD;
  $("live").classList.toggle("stale", old || !!fetchErr);
  $("liveTxt").textContent = fetchErr && !gen ? "Not loaded" : old ? gen ? (innerWidth < 560 ? "" : "Updated ") + `${ago(gen)} ago` : "Loading" : innerWidth < 560 ? "Live" : `Live · updated ${ago(gen)} ago`;
  if (gen) $("asof").textContent = `Read from the blockchains at ${hm(gen)} UTC. Coins are valued at that hour's prices, so the totals move a little with the market.`;
  $("err").hidden = !fetchErr;
  if (fetchErr) $("err").textContent = gen ? `The newest data did not load (${fetchErr}). The numbers below are from ${hm(gen)} UTC. Trying again every minute.` : `The data did not load (${fetchErr}). Trying again every minute.`;
}

const PAST = [ {
  who: "LuBian",
  when: "Dec 2020, a bitcoin mining pool",
  v: 35e8
}, {
  who: "Bybit",
  when: "Feb 2025, an exchange",
  v: 15e8
}, {
  who: "Ronin",
  when: "Mar 2022, a gaming network",
  v: 625e6
}, {
  who: "Poly Network",
  when: "Aug 2021, mostly returned",
  v: 611e6
}, {
  who: "Coincheck",
  when: "Jan 2018, an exchange",
  v: 534e6
}, {
  who: "Bitget",
  when: "Sep 2026, an exchange",
  v: 352e6
} ];

function rank() {
  const rows = [ {
    who: "Binance",
    when: "Oct 2026, an exchange",
    v: D.L.B,
    us: true
  }, ...PAST ].sort((a, b) => b.v - a.v);
  const top = rows[0].v;
  $("rank").innerHTML = rows.map(r => `<div class="row${r.us ? " us" : ""}"><div class="who">${esc(r.who)}<small>${esc(r.when)}</small></div>` + `<div class="bar"><div class="fill" style="width:${(r.v / top * 82).toFixed(2)}%"></div><span class="v">${esc(r.us ? words(r.v) : short(r.v))}</span></div></div>`).join("");
}

let speedShown = reduced ? 1 : 0, speedHover = null;

function speedNotes() {
  const {txs, outs} = D, hour = txs.filter(x => x.t <= HOUR_END);
  const notes = [ {
    t: outs[0].t,
    text: "First payment",
    sub: (n => n === "XRP Ledger" ? "on the XRP Ledger" : "on " + n)(CHAINS[chainKey(outs[0].key)].name)
  } ];
  const bigs = hour.slice().sort((a, b) => b.v - a.v).slice(0, 2).sort((a, b) => a.t - b.t);
  for (const x of bigs) notes.push({
    t: x.t,
    text: words(x.v),
    sub: x.usd > x.v / 2 ? `mostly dollar tokens, one ${CHAINS[x.chain].name} transaction` : `one ${CHAINS[x.chain].name} transaction`
  });
  return notes;
}

function cumAt(t) {
  let c = 0;
  for (const s of D.outs) {
    if (s.t > t) break;
    c += s.v;
  }
  return c;
}

function drawSpeed() {
  if (!D) return;
  const svg = $("speed"), w = Math.max(280, svg.clientWidth || svg.parentNode.clientWidth), narrow = w < 560;
  const h = narrow ? 300 : 340, L = narrow ? 40 : 52, R = narrow ? 8 : 16, T = 16, B = 34;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("height", h);
  const pts = D.outs.filter(s => s.t <= HOUR_END), total = cumAt(HOUR_END);
  const top = Math.ceil(D.L.B / 1e9) * 1e9;
  const X = t => L + (t - START) / (HOUR_END - START) * (w - L - R), Y = v => T + (1 - v / top) * (h - T - B);
  const tEnd = START + speedShown * (HOUR_END - START);
  let d = `M${X(START)},${Y(0)}`, c = 0;
  for (const s of pts) {
    if (s.t > tEnd) break;
    d += `H${X(s.t).toFixed(1)}`;
    c += s.v;
    d += `V${Y(c).toFixed(1)}`;
  }
  d += `H${X(tEnd).toFixed(1)}`;
  const area = d + `V${Y(0)}Z`;
  let g = "";
  for (let v = 0; v <= top; v += 1e9) {
    if (narrow && v / 1e9 % 2) continue;
    g += `<line x1="${L}" x2="${w - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${v ? "rgba(255,255,255,.07)" : "rgba(255,255,255,.25)"}"/>` + `<text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end" fill="#8d97a6" font-size="11.5" font-family="JetBrains Mono, monospace">${v ? "$" + v / 1e9 + "B" : "$0"}</text>`;
  }
  for (let m = 0; m <= 60; m += narrow ? 20 : 10) {
    const t = START + m * 6e4;
    g += `<text x="${X(t)}" y="${h - B + 20}" text-anchor="${m === 0 ? "start" : m === 60 ? "end" : "middle"}" fill="#8d97a6" font-size="11.5" font-family="JetBrains Mono, monospace">${hm(t)}</text>`;
  }
  g += `<text x="${w - R}" y="${h - 2}" text-anchor="end" fill="#5d6675" font-size="11" font-family="Archivo, sans-serif">London time (UTC)</text>`;
  const f0 = D.outs[0].t, f1 = f0 + 20 * 6e4;
  g += `<rect x="${X(f0)}" y="${T}" width="${X(f1) - X(f0)}" height="${h - T - B}" fill="rgba(243,178,58,.06)"/>` + `<text x="${X(f0) + 8}" y="${T + 16}" fill="#a88a4e" font-size="12" font-family="Archivo, sans-serif">${narrow ? "20 min" : "first 20 minutes"}</text>`;
  g += `<path d="${area}" fill="rgba(243,178,58,.13)"/><path d="${d}" fill="none" stroke="#f3b23a" stroke-width="2.4" stroke-linejoin="round"/>`;
  const notes = speedNotes();
  notes.forEach((n, i) => {
    if (n.t > tEnd) return;
    const x = X(n.t), y = Y(cumAt(n.t));
    g += `<circle cx="${x}" cy="${y}" r="4.5" fill="#07080d" stroke="#f3b23a" stroke-width="2"/>`;
    if (narrow) {
      g += `<text x="${x + 7}" y="${y - 9}" fill="#eef1f6" font-size="13" font-weight="700" font-family="Archivo, sans-serif">${i + 1}</text>`;
      return;
    }
    g += `<text x="${x + 8}" y="${y - 30}" fill="#eef1f6" font-size="14" font-weight="700" font-family="Archivo, sans-serif">${esc(n.text)}<tspan fill="#8d97a6" font-weight="400"> at ${hm(n.t)}</tspan></text>` + `<text x="${x + 8}" y="${y - 13}" fill="#8d97a6" font-size="12.5" font-family="Archivo, sans-serif">${esc(n.sub)}</text>`;
  });
  if (speedHover != null && speedShown >= 1) {
    const x = X(speedHover);
    g += `<line x1="${x}" x2="${x}" y1="${T}" y2="${h - B}" stroke="rgba(255,255,255,.35)" stroke-dasharray="2 3"/><circle cx="${x}" cy="${Y(cumAt(speedHover))}" r="3.5" fill="#f3b23a"/>`;
  }
  svg.innerHTML = g;
  const list = $("speedList");
  if (list) list.hidden = !narrow;
  if (narrow && list) list.innerHTML = notes.map((n, i) => `<li><b>${i + 1}</b> ${esc(n.text)} at ${hm(n.t)}: ${esc(n.sub)}</li>`).join("");
  const at = speedHover != null ? speedHover : f1;
  $("speedRead").innerHTML = speedHover != null ? `${esc(hm(at))} UTC · <b>${esc(words(cumAt(at)))}</b> taken so far` : `By ${esc(hm(f1))} UTC, 20 minutes after the first payment: <b>${esc(words(cumAt(f1)))}</b>. By 21:00: ${esc(words(total))}.`;
}

function speedHoverAt(clientX) {
  const svg = $("speed"), r = svg.getBoundingClientRect(), narrow = r.width < 560, L = narrow ? 40 : 52, R = narrow ? 8 : 16;
  const f = (clientX - r.left - L) / (r.width - L - R);
  speedHover = f < 0 || f > 1 ? null : START + f * (HOUR_END - START);
  drawSpeed();
}

function playSpeed() {
  if (speedShown >= 1) return;
  const t0 = performance.now(), dur = 2600;
  const go = now => {
    speedShown = Math.min(1, (now - t0) / dur);
    drawSpeed();
    if (speedShown < 1) requestAnimationFrame(go);
  };
  requestAnimationFrame(go);
}

function parts() {
  const {L, firstFreeze} = D, first = D.outs[0].t;
  const mins = t => Math.round((t - first) / 6e4);
  const issuers = Object.entries(firstFreeze).sort((a, b) => a[1] - b[1]);
  const fzLine = issuers.length ? `${issuers[0][0]} started ${mins(issuers[0][1])} minutes after the first payment` + (issuers.length > 1 ? `; ${issuers.slice(1).map(([n, t]) => `${n} at ${hm(t)}`).join(", ")} UTC.` : ".") : "";
  const P = [ {
    k: "M",
    col: "var(--red)",
    name: "Still with the attacker",
    d: `In wallets the attacker controls. ${Math.round(L.by.M.eth / Math.max(1, L.M) * 100)}% of it is in Bitcoin, Ether and other coins that no company can freeze, so the attacker can move it whenever they choose.`
  }, {
    k: "F",
    col: "var(--ice)",
    name: "Frozen",
    d: `Dollar tokens (Tether's USDT, Circle's USDC, Ripple's RLUSD) still in the attacker's wallets but blocked by the companies that issue them. ${fzLine}`
  }, {
    k: "V",
    col: "var(--svc)",
    name: "Put into trading and lending services",
    d: "Sent into services such as Uniswap and Aave and not yet come back out, counted net of what has."
  }, {
    k: "R",
    col: "var(--back)",
    name: "Given back",
    d: "Returned to Binance or its customers by the services the money passed through."
  }, {
    k: "X",
    col: "var(--lost)",
    name: "No longer traced",
    d: "Pieces under $10,000, or sent somewhere this tracker does not follow."
  } ].filter(p => L[p.k] >= 1e4);
  $("split").innerHTML = P.map(p => `<div class="seg" style="flex:${(L[p.k] / L.B).toFixed(5)} 1 0;background:${p.col}" title="${esc(p.name)}: ${esc(table(L[p.k]))}"></div>`).join("");
  $("parts").innerHTML = P.map(p => `<div class="part"><i style="background:${p.col}"></i><div class="t">${esc(p.name)}</div><div class="v" style="color:${p.k === "M" ? "var(--red)" : p.k === "F" ? "var(--ice)" : "var(--ink)"}">${esc(table(L[p.k]))}</div><div class="d">${esc(p.d)}</div></div>`).join("");
}

function chainTable() {
  const rows = Object.entries(D.chains).sort((a, b) => b[1].B - a[1].B);
  const sum = k => rows.reduce((a, [, r]) => a + r[k], 0);
  $("tbl").innerHTML = `<thead><tr><th>Blockchain</th><th class="hide-s">First payment (UTC)</th><th class="r">Taken</th><th class="r">Frozen</th><th class="r">Still with the attacker</th></tr></thead><tbody>` + rows.map(([c, r]) => `<tr><td>${esc(CHAINS[c].name)}</td><td class="hide-s">${esc(hm(r.first))}</td><td class="r">${esc(table(r.B))}</td><td class="r frozen">${esc(r.F >= 1e4 ? table(r.F) : "–")}</td><td class="r held">${esc(table(r.M))}</td></tr>`).join("") + `</tbody><tfoot><tr><td>All nine</td><td class="hide-s"></td><td class="r">${esc(table(sum("B")))}</td><td class="r">${esc(table(sum("F")))}</td><td class="r">${esc(table(sum("M")))}</td></tr></tfoot>`;
}

function render() {
  hero();
  rank();
  drawSpeed();
  parts();
  chainTable();
  status();
}

async function load() {
  try {
    const r = await fetch("data.json", {
      cache: "no-cache"
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();
    const g = Date.parse(data.generatedAt || "") || 0;
    fetchErr = "";
    if (D && g === gen) {
      status();
      return;
    }
    D = compute(data);
    gen = D.gen;
    if (D.missing) console.warn("[story] no price for", D.missing);
    const first = !RP.done && !RP.on;
    render();
    if (first) {
      if (!reduced && !Q.has("og") && scrollY < 200) replay(); else settle();
    }
  } catch (e) {
    fetchErr = e.message || String(e);
    console.error("[story] data.json", e);
    status();
  }
}

const MKT_PINS = [ {
  t: Date.parse("2026-10-29T20:24:23Z"),
  name: "Ethereum wallet emptied"
}, {
  t: Date.parse("2026-10-29T21:15:00Z"),
  name: "Founder says hack"
}, {
  t: Date.parse("2026-10-29T22:55:00Z"),
  name: "Withdrawals paused"
}, {
  t: Date.parse("2026-10-30T00:10:35Z"),
  name: "Binance takes wallet back"
} ];

let MK = null;

const pctOf = (v, b) => (v / b - 1) * 100;

const pctTxt = p => (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p).toFixed(1) + "%";

const okRows = rows => Array.isArray(rows) && rows.length > 10 && rows.every(r => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[1]) && r[1] > 0);

async function loadMarket() {
  try {
    const r = await fetch("market.json", {
      cache: "no-cache"
    });
    if (!r.ok) throw new Error("market.json HTTP " + r.status);
    const d = await r.json();
    const rel = d.relative && d.relative["BNB/BTC"], usdS = d.series && d.series.BNB, base = Number(d.base);
    if (!okRows(rel) || !okRows(usdS) || !Number.isFinite(base)) throw new Error("market.json is missing BNB or BNB/BTC");
    const at = (rows, t) => {
      let v = null;
      for (const x of rows) {
        if (x[0] <= t) v = x[1]; else break;
      }
      return v;
    };
    const rb = at(rel, base), ub = at(usdS, base);
    if (!rb || !ub) throw new Error("market.json has no point at 20:00");
    const A1 = rel.map(([t, v]) => [ t, pctOf(v, rb) ]), B1 = usdS.map(([t, v]) => [ t, pctOf(v, ub) ]);
    const pre = A1.filter(([t]) => t <= base).map(x => x[1]);
    const lowA = A1.filter(([t]) => t >= base).reduce((m, x) => x[1] < m[1] ? x : m, [ 0, Infinity ]);
    const lowB = B1.filter(([t]) => t >= base && t <= base + 2 * 36e5).reduce((m, x) => x[1] < m[1] ? x : m, [ 0, Infinity ]);
    const btc = d.series.BTC, bb = btc && at(btc, base), btcAt = bb && at(btc, lowB[0]);
    const back = A1.find(([t, v]) => t > lowA[0] && v >= Math.min(...pre));
    MK = {
      A: A1,
      B: B1,
      base,
      preLo: Math.min(...pre),
      preHi: Math.max(...pre),
      lowA,
      lowB,
      src: String(d.sources && d.sources.BNB || "")
    };
    const down = v => Math.abs(v).toFixed(1) + "%";
    $("mktLede").innerHTML = `Binance has its own coin, BNB. That evening it fell further than the rest of the market: down <b>${esc(down(lowB[1]))}</b> in dollars by ${esc(hm(lowB[0]))} UTC` + (btcAt ? `, when Bitcoin was down ${esc(down(pctOf(btcAt, bb)))}` : "") + `. Measured against Bitcoin, the worst was ${esc(down(lowA[1]))} at ${esc(hm(lowA[0]))}` + (back ? `, and it was back in its normal range by ${esc(hm(back[0]))}.` : ".");
    const src = {
      coinbase: "Coinbase",
      kraken: "Kraken",
      okx: "OKX",
      coingecko: "CoinGecko"
    }[MK.src.split(" ")[0]] || "public exchanges";
    $("mktNote").textContent = `Prices every 5 minutes from ${src}, shown as a change from 20:00 UTC. BNB started falling against Bitcoin in the minute the Ethereum wallet was emptied, before the first news reports at about 20:32. That shows when the selling happened, not who sold. The whole market fell again from 23:00 to 02:00, led by Bitcoin, and nothing here ties that to the theft. The withdrawal pause is CoinDesk's reported time.`;
    $("bnb").hidden = false;
    drawMarket();
  } catch (e) {
    console.error("[story] market.json", e);
  }
}

function drawMarket(hx) {
  if (!MK) return;
  const c = $("mkt"), dpr = Math.min(3, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const x = c.getContext("2d");
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, w, h);
  const L = 44, R = 10, B = 22;
  const t0 = MK.A[0][0], t1 = MK.A[MK.A.length - 1][0];
  x.font = "500 11px Archivo, sans-serif";
  const pins = MKT_PINS.filter(p => p.t >= t0 && p.t <= t1), X = t => L + (t - t0) / (t1 - t0) * (w - L - R);
  let row = 0, lastEnd = -1e9, rows = 1;
  for (const p of pins) {
    const px = X(p.t);
    p.w = x.measureText(p.name).width;
    row = px < lastEnd + 8 ? row + 1 : 0;
    p.row = row;
    lastEnd = Math.max(row ? lastEnd : -1e9, px + 4 + p.w);
    rows = Math.max(rows, row + 1);
    p.left = px + 4 + p.w > w - R;
  }
  const T = 14 + rows * 14;
  const all = [ ...MK.A, ...MK.B ].map(p => p[1]);
  const lo = Math.floor(Math.min(...all, 0) - .5), hi = Math.ceil(Math.max(...all, 0) + .5);
  const Y = v => T + (hi - v) / (hi - lo) * (h - T - B);
  x.textBaseline = "middle";
  const step = hi - lo > 12 ? 4 : 2;
  x.font = '500 10.5px "JetBrains Mono", ui-monospace, monospace';
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) {
    x.strokeStyle = v === 0 ? "rgba(141,151,166,.5)" : "rgba(141,151,166,.13)";
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(L, Math.round(Y(v)) + .5);
    x.lineTo(w - R, Math.round(Y(v)) + .5);
    x.stroke();
    x.fillStyle = "#8d97a6";
    x.textAlign = "right";
    x.fillText(v === 0 ? "0%" : pctTxt(v).replace(".0", ""), L - 6, Y(v));
  }
  x.fillStyle = "rgba(141,151,166,.13)";
  x.fillRect(L, Y(MK.preHi), w - L - R, Math.max(1, Y(MK.preLo) - Y(MK.preHi)));
  x.textAlign = "center";
  x.textBaseline = "alphabetic";
  for (let t = Math.ceil(t0 / 72e5) * 72e5; t <= t1; t += (w < 500 ? 4 : 2) * 36e5) {
    if (X(t) > w - 22) continue;
    x.fillStyle = "#8d97a6";
    x.fillText(hm(t), X(t), h - 6);
  }
  x.font = "500 11px Archivo, sans-serif";
  for (const p of pins) {
    const px = Math.round(X(p.t)) + .5;
    x.strokeStyle = "rgba(255,255,255,.18)";
    x.setLineDash([ 2, 3 ]);
    x.beginPath();
    x.moveTo(px, T - 4);
    x.lineTo(px, h - B);
    x.stroke();
    x.setLineDash([]);
    x.fillStyle = "#c2c9d4";
    x.textAlign = p.left ? "right" : "left";
    x.fillText(p.name, p.left ? px - 4 : px + 4, 11 + p.row * 14);
  }
  const line = (pts, col, lw) => {
    x.strokeStyle = col;
    x.lineWidth = lw;
    x.lineJoin = "round";
    x.beginPath();
    pts.forEach(([t, v], i) => i ? x.lineTo(X(t), Y(v)) : x.moveTo(X(t), Y(v)));
    x.stroke();
  };
  line(MK.B, "#8d97a6", 1.4);
  line(MK.A, "#f3b23a", 2.2);
  const ti = hx == null ? MK.lowA[0] : t0 + (hx - L) / (w - L - R) * (t1 - t0);
  const near = rows => rows.reduce((m, p) => Math.abs(p[0] - ti) < Math.abs(m[0] - ti) ? p : m, rows[0]);
  const a = near(MK.A), b = near(MK.B);
  x.fillStyle = "#f3b23a";
  x.beginPath();
  x.arc(X(a[0]), Y(a[1]), 3.5, 0, 7);
  x.fill();
  $("mktRead").innerHTML = `${esc(hm(a[0]))} UTC · against Bitcoin <b>${esc(pctTxt(a[1]))}</b> · in dollars ${esc(pctTxt(b[1]))}`;
}

function motion() {
  const secs = [ ...document.querySelectorAll("section") ];
  if (reduced || !("IntersectionObserver" in window)) {
    secs.forEach(s => s.classList.add("in"));
    speedShown = 1;
    return;
  }
  document.documentElement.classList.add("anim");
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    io.unobserve(e.target);
    if (e.target.id === "fast") playSpeed();
  }), {
    threshold: .3
  });
  secs.forEach(s => io.observe(s));
}

function share() {
  $("shareLi").href = "https://www.linkedin.com/sharing/share-offsite/?url=" + encodeURIComponent(URL_HOME);
  $("copyLink").addEventListener("click", async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(URL_HOME);
    } catch (e) {
      ok = false;
      console.error("[story] copy", e);
    }
    const t = $("toast");
    t.textContent = ok ? "Link copied" : "Could not copy. The link is " + URL_HOME;
    t.classList.add("on");
    setTimeout(() => t.classList.remove("on"), 2400);
  });
}

if (Q.has("og")) speedShown = 1; else motion();

share();

const svg = $("speed");

svg.addEventListener("pointermove", e => {
  if (e.pointerType === "mouse" || e.buttons) speedHoverAt(e.clientX);
});

svg.addEventListener("pointerdown", e => speedHoverAt(e.clientX));

svg.addEventListener("pointerleave", () => {
  speedHover = null;
  drawSpeed();
});

$("mkt").addEventListener("pointermove", e => drawMarket(e.clientX - $("mkt").getBoundingClientRect().left));

$("mkt").addEventListener("pointerleave", () => drawMarket());

let rs = 0;

addEventListener("resize", () => {
  cancelAnimationFrame(rs);
  rs = requestAnimationFrame(() => {
    drawSpeed();
    drawMarket();
  });
});

load();

loadMarket();

setInterval(load, 6e4);

setInterval(loadMarket, 10 * 6e4);

setInterval(status, 3e4);
