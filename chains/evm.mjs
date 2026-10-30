const sleep = ms => new Promise(r => setTimeout(r, ms));

const MIN_EVT = 1e4, DISCOVER = 1e6, MAX_DEPTH = 4, MAX_NODES = 60;

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const pad = a => "0x" + a.slice(2).toLowerCase().padStart(64, "0");

const unpad = t => "0x" + t.slice(26).toLowerCase();

const EX2 = "0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c";

const ETH_SIDE = [ "0x7c8601d4645b93cea45f71e118a729332e6b5ca0", EX2, "0x8532fa14acaf483729c449b8458aeddb900543d4", "0xa97bf7836f8a08f9ed91d41453d371493fae8d10", "0xccbef95633adb5cd2b5038db5a38d77e726ca263", "0x5c23023ca6633f91ded909b4a753a3ca00fea4fc" ];

const ARB_FROZEN = "0x0000000000000000000000000000000000000da0";

const CG = {
  AVAX: "avalanche-2",
  ETH: "ethereum",
  WETH: "ethereum",
  ARB: "arbitrum",
  OP: "optimism",
  VIRTUAL: "virtual-protocol",
  BNB: "binancecoin",
  WBNB: "binancecoin",
  AERO: "aerodrome-finance",
  WAVAX: "avalanche-2",
  "BTC.b": "bitcoin",
  cbBTC: "bitcoin",
  BTCB: "bitcoin",
  WBTC: "bitcoin"
};

const STABLE = new Set([ "USDT", "USDt", "USDC", "USDT.e", "USDC.e", "USDT0", "DAI", "FDUSD", "USD1", "BUSD" ]);

const CHAINS = {
  arb: {
    name: "Arbitrum One",
    coin: "ETH",
    logRpc: "https://arb1.arbitrum.io/rpc",
    rpc: "https://arb1.arbitrum.io/rpc",
    archive: "https://arbitrum-one.public.blastapi.io",
    step: 2e4,
    bt: 250,
    topicOnly: true,
    tokens: {
      "0x912ce59144191c1204e64559fe8253a0e49e6548": [ "ARB", 18 ],
      "0xaf88d065e77c8cc2239327c5edb3a432268e5831": [ "USDC", 6 ],
      "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": [ "USDT", 6 ],
      "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": [ "WETH", 18 ],
      "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": [ "WBTC", 8 ],
      "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8": [ "USDC.e", 6 ]
    },
    victims: [ [ "0xb38e8c17e38363af6ebdcb3dae12e0243582891d", "Binance hot wallet (Arbitrum) 0xb38e…891d", "nonce 8,594,105 on Arbitrum; sent 74,559,805.2 ARB to Exploiter 2 at 20:30:46; left with exactly ~3 ETH/3 ARB/3 USDT afterwards, the same evacuation pattern as Binance's Optimism and Avalanche wallets" ], [ "0xf92402bb795fd7cd08fb83839689db79099c8c9c", "Binance hot wallet (Arbitrum) 0xf924…8c9c", "nonce 2,288,419 at the time; sent 3,478.4 ETH to Exploiter 2 at 20:32:16" ], [ "0x1b5b4e441f5a22bfd91b7772c780463f66a74b35", "Binance hot wallet (Arbitrum) 0x1b5b…4b35", "nonce 2,295,406 at the time; sent 2,959.2 ETH to Exploiter 2 at 20:32:47" ], [ "0x3931dab967c3e2dbb492fe12460a66d0fe4cc857", "Binance hot wallet (Arbitrum) 0x3931…c857", "nonce 2,841,333 at the time; sent 1,988.6 ETH to Exploiter 2 at 20:33:53" ] ],
    known: {
      [ARB_FROZEN]: {
        role: "venue",
        bucket: "frozen",
        label: "Arbitrum Security Council holding address",
        plain: "Frozen by Arbitrum",
        note: "Funds land here through an L1-origin unsigned tx (type 0x65, no signature) pushed by the Security Council; the same address held the KelpDAO exploiter's 30,766 ETH frozen on 21 Apr 2026."
      }
    }
  },
  op: {
    name: "OP Mainnet",
    coin: "ETH",
    logRpc: "https://mainnet.optimism.io",
    rpc: "https://mainnet.optimism.io",
    archive: "https://mainnet.optimism.io",
    step: 9e3,
    bt: 2e3,
    topicOnly: true,
    tokens: {
      "0x4200000000000000000000000000000000000042": [ "OP", 18 ],
      "0x0b2c639c533813f4aa9d7837caf62653d097ff85": [ "USDC", 6 ],
      "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": [ "USDT", 6 ],
      "0x01bff41798a0bcf287b996046ca68b395dbc1071": [ "USDT0", 6 ],
      "0x4200000000000000000000000000000000000006": [ "WETH", 18 ],
      "0x7f5c764cbc14f9669b88837ca1490cca17c31607": [ "USDC.e", 6 ]
    },
    victims: [ [ "0xacd03d601e5bb1b275bb94076ff46ed9d753435a", "Binance hot wallet (Optimism) 0xacd0…435a", "nonce 8,353,461; operates Binance Hot Wallet 34 (0xee7a…4055) on Optimism (its execute calls succeed); sent 44,231,858.2 OP to Exploiter 2 at 20:18:23; at 23:04-23:09 moved its remaining funds (2,152.8 ETH, 11.18M USDT0, ...) to 0xf977…acec (Binance 8)" ] ]
  },
  base: {
    name: "Base",
    coin: "ETH",
    logRpc: "https://base-rpc.publicnode.com",
    rpc: "https://base-rpc.publicnode.com",
    archive: "https://base-mainnet.public.blastapi.io",
    step: 45e3,
    bt: 2e3,
    tokens: {
      "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": [ "USDC", 6 ],
      "0x4200000000000000000000000000000000000006": [ "WETH", 18 ],
      "0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": [ "cbBTC", 8 ],
      "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": [ "USDT", 6 ],
      "0x0b3e328455c4059eeb9e3f84b5543f74e24e7e1b": [ "VIRTUAL", 18 ],
      "0x940181a94a35a4569e4529a3cdfb74e38fd98631": [ "AERO", 18 ],
      "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": [ "DAI", 18 ]
    },
    victims: [ [ "0x3304e22ddaa22bcdc5fca2269b418046ae7b566a", "Binance hot wallet (Base) 0x3304…566a", 'nonce 6,703,763 on Base; sent 4,735,627.3 VIRTUAL to Exploiter 2 at about 20:16; now holds 2.9999 ETH, the same "leave 3" pattern as Binance\'s other L2 wallets' ] ]
  },
  bsc: {
    name: "BNB Smart Chain",
    coin: "BNB",
    logRpc: "https://bsc-rpc.publicnode.com",
    rpc: "https://bsc-rpc.publicnode.com",
    archive: "https://bsc-mainnet.public.blastapi.io",
    step: 45e3,
    bt: 450,
    tokens: {
      "0x55d398326f99059ff775485246999027b3197955": [ "USDT", 18 ],
      "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": [ "USDC", 18 ],
      "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c": [ "BTCB", 18 ],
      "0x2170ed0880ac9a755fd29b2688956bd959f933f8": [ "ETH", 18 ],
      "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": [ "WBNB", 18 ],
      "0xc5f0f7b66764f6ec8c8dff7ba683102295e16409": [ "FDUSD", 18 ],
      "0xe9e7cea3dedca5984780bafc599bd69add087d56": [ "BUSD", 18 ],
      "0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d": [ "USD1", 18 ]
    },
    victims: []
  },
  avax: {
    name: "Avalanche C-Chain",
    coin: "AVAX",
    routescan: 43114,
    rpc: "https://avalanche-c-chain-rpc.publicnode.com",
    tokens: {
      "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7": [ "USDt", 6 ],
      "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": [ "USDC", 6 ],
      "0xc7198437980c041c805a1edcba50c1ce5db95118": [ "USDT.e", 6 ],
      "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664": [ "USDC.e", 6 ],
      "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7": [ "WAVAX", 18 ],
      "0x152b9d0fdc40c096757f570a51e494bd4b943e50": [ "BTC.b", 8 ],
      "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab": [ "WETH", 18 ]
    },
    freezeLogs: [ {
      token: "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7",
      topic: "0x406bbf2d8d145125adf1198d2cf8a67c66cc4bb0ab01c37dccd4f7c0aae1e7c7",
      issuer: "Tether",
      sym: "USDt"
    } ],
    victims: [ [ "0x3bce63c6c9abf7a47f52c9a3a7950867700b0158", "Binance hot wallet (Avalanche) 0x3bce…0158", "nonce 914,046; steady small payouts before 20:18; sent 432,846.1 AVAX + 3,217,651.1 USDt to Exploiter 2 at 20:33:18; evacuated the rest to Binance's 0x4aef…13e8 at 23:09" ], [ "0x9f8c163cba728e99993abe7495f06c0a3c8ac8b9", "Binance hot wallet (Avalanche) 0x9f8c…c8b9", "nonce 5,123,650; owner of Binance Hot Wallet 34 on Avalanche (execute at 23:09:28); sent 573,469.1 AVAX + 5,192,277.3 USDt to Exploiter 2 at 20:35:53; has moved millions to and from 0x4aef…13e8 since August" ], [ "0x978b21a854dbefcd6d51dfd269875d158046240b", "Binance hot wallet (Avalanche) 0x978b…240b", "nonce 932,186; sent 444,536.6 AVAX to Exploiter 2 at 23:04:30, in the same minute Binance was sweeping it to 0x4aef…13e8" ], [ "0xaba2d404c5c41da5964453a368aff2604ae80a14", "Binance hot wallet (Avalanche) 0xaba2…0a14", "nonce 899,305; sent 388,251.6 AVAX to Exploiter 2 at 20:35:02" ], [ "0x6d8be5cdf0d7dee1f04e25fd70b001ae3b907824", "Binance hot wallet (Avalanche) 0x6d8b…7824", "nonce 892,029; sent 419,532.5 AVAX to Exploiter 2 at 20:35:48" ] ]
  }
};

async function rpcCall(url, method, params, tries = 5) {
  for (let k = 0; k < tries; k++) {
    try {
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
        }),
        signal: AbortSignal.timeout(3e4)
      });
      const j = await r.json();
      if (!j.error) return j.result;
      if (k === tries - 1) throw new Error(method + ": " + j.error.message);
    } catch (e) {
      if (k === tries - 1) throw e;
    }
    await sleep(1200 * (k + 1));
  }
}

const HIST = new Map;

async function makePrices(syms, since) {
  const ids = [ ...new Set(syms.map(s => CG[s]).filter(Boolean)) ];
  const now = {}, hist = {};
  try {
    const j = await (await fetch("https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&ids=" + ids.join(","))).json();
    for (const id of ids) if (j[id]) now[id] = j[id].usd;
  } catch {}
  for (const id of ids) {
    if (HIST.has(id)) {
      hist[id] = HIST.get(id);
      continue;
    }
    for (let k = 0; k < 4 && !hist[id]; k++) {
      try {
        await sleep(k ? 2e4 : 2500);
        const j = await (await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart/range?vs_currency=usd&from=${Math.floor(since / 1e3) - 3600}&to=${Math.floor(Date.now() / 1e3)}`)).json();
        if (Array.isArray(j.prices) && j.prices.length) {
          hist[id] = j.prices;
          HIST.set(id, j.prices);
        }
      } catch {}
    }
  }
  for (const id of ids) if (!now[id] && hist[id]) now[id] = hist[id][hist[id].length - 1][1];
  const at = (sym, t) => {
    if (STABLE.has(sym)) return {
      p: 1,
      src: "peg"
    };
    const id = CG[sym];
    if (!id) return {
      p: 0,
      src: "none"
    };
    const h = hist[id];
    if (h) {
      let best = h[0];
      for (const x of h) {
        if (Math.abs(x[0] - t) < Math.abs(best[0] - t)) best = x;
      }
      if (Math.abs(best[0] - t) < 3 * 36e5) return {
        p: best[1],
        src: "at-time"
      };
    }
    return {
      p: now[id] || 0,
      src: "today"
    };
  };
  const today = {};
  for (const s of syms) today[s] = STABLE.has(s) ? 1 : now[CG[s]] || 0;
  return {
    at,
    today
  };
}

function routescanReader(C, since) {
  const base = `https://api.routescan.io/v2/network/mainnet/evm/${C.routescan}/etherscan/api`;
  const get = async q => {
    for (let k = 0; k < 5; k++) {
      await sleep(450);
      try {
        const j = await (await fetch(base + q)).json();
        if (Array.isArray(j.result)) return j.result;
        if (/No transactions/i.test(j.message)) return [];
      } catch {}
      await sleep(1500 * (k + 1));
    }
    throw new Error("Routescan did not answer " + q);
  };
  return async addr => {
    const out = [];
    const keep = r => r.timeStamp * 1e3 >= since;
    for (const t of (await get(`?module=account&action=txlist&address=${addr}&sort=desc&page=1&offset=1000`)).filter(keep)) if (t.isError !== "1" && BigInt(t.value) > 0n) out.push({
      key: t.hash,
      hash: t.hash,
      block: +t.blockNumber,
      t: t.timeStamp * 1e3,
      from: t.from.toLowerCase(),
      to: (t.to || "").toLowerCase(),
      sym: C.coin,
      amt: Number(BigInt(t.value)) / 1e18
    });
    for (const t of (await get(`?module=account&action=txlistinternal&address=${addr}&sort=desc&page=1&offset=1000`)).filter(keep)) if (t.isError !== "1" && BigInt(t.value) > 0n) out.push({
      key: t.hash + ":i" + (t.traceId || t.index || "0"),
      hash: t.hash,
      block: +t.blockNumber,
      t: t.timeStamp * 1e3,
      from: t.from.toLowerCase(),
      to: (t.to || "").toLowerCase(),
      sym: C.coin,
      amt: Number(BigInt(t.value)) / 1e18,
      internal: true
    });
    for (const t of (await get(`?module=account&action=tokentx&address=${addr}&sort=desc&page=1&offset=1000`)).filter(keep)) {
      const tok = C.tokens[t.contractAddress.toLowerCase()];
      if (!tok) continue;
      out.push({
        key: t.hash + ":" + (t.logIndex || t.transactionIndex),
        hash: t.hash,
        block: +t.blockNumber,
        t: t.timeStamp * 1e3,
        from: t.from.toLowerCase(),
        to: t.to.toLowerCase(),
        sym: tok[0],
        amt: Number(BigInt(t.value)) / 10 ** tok[1],
        token: t.contractAddress.toLowerCase()
      });
    }
    return out;
  };
}

function rpcReader(C, since) {
  const times = new Map;
  const header = async b => {
    try {
      return await rpcCall(C.archive, "eth_getBlockByNumber", [ "0x" + b.toString(16), false ], 3);
    } catch {
      return rpcCall(C.rpc, "eth_getBlockByNumber", [ "0x" + b.toString(16), false ]);
    }
  };
  const blockTime = async b => {
    if (!times.has(b)) times.set(b, parseInt((await header(b)).timestamp) * 1e3);
    return times.get(b);
  };
  let range = null;
  const blockAt = async ts => {
    let hi = parseInt(await rpcCall(C.rpc, "eth_blockNumber", [])), lo = Math.max(0, hi - Math.ceil((Date.now() - ts) / C.bt * 1.5) - 1e3);
    if (await blockTime(lo) >= ts) return lo;
    while (hi - lo > 1) {
      const m = lo + hi >> 1;
      if (await blockTime(m) < ts) lo = m; else hi = m;
    }
    return hi;
  };
  const getRange = async () => range || (range = [ await blockAt(since), parseInt(await rpcCall(C.rpc, "eth_blockNumber", [])) ]);
  const tokenLists = [];
  {
    const ks = Object.keys(C.tokens);
    for (let i = 0; i < ks.length; i += 10) tokenLists.push(ks.slice(i, i + 10));
  }
  async function nativeMoves(addr, a, b, thr) {
    const st = async n => {
      const h = "0x" + n.toString(16);
      const [bl, nc] = await Promise.all([ rpcCall(C.archive, "eth_getBalance", [ addr, h ]), rpcCall(C.archive, "eth_getTransactionCount", [ addr, h ]) ]);
      return {
        bal: Number(BigInt(bl)) / 1e18,
        n: parseInt(nc)
      };
    };
    const hits = [];
    const go = async (lo, slo, hi, shi, d = 0) => {
      if (Math.abs(slo.bal - shi.bal) <= thr && slo.n === shi.n) return;
      if (hi - lo <= 1 || d > 40) {
        hits.push(hi);
        return;
      }
      const m = lo + hi >> 1, sm = await st(m);
      await go(lo, slo, m, sm, d + 1);
      await go(m, sm, hi, shi, d + 1);
    };
    await go(a, await st(a), b, await st(b));
    const out = [];
    for (const h of hits) {
      let B;
      try {
        B = await rpcCall(C.archive, "eth_getBlockByNumber", [ "0x" + h.toString(16), true ], 3);
      } catch {
        B = await rpcCall(C.rpc, "eth_getBlockByNumber", [ "0x" + h.toString(16), true ]);
      }
      const t = parseInt(B.timestamp) * 1e3;
      times.set(h, t);
      const txs = B.transactions.filter(x => x.from.toLowerCase() === addr || (x.to || "").toLowerCase() === addr);
      for (const x of txs) {
        const amt = Number(BigInt(x.value)) / 1e18;
        if (amt > 0) out.push({
          key: x.hash,
          hash: x.hash,
          block: h,
          t,
          from: x.from.toLowerCase(),
          to: (x.to || "").toLowerCase(),
          sym: C.coin,
          amt,
          txType: x.type
        });
      }
    }
    return out;
  }
  return async (addr, thrCoins) => {
    const [a, b] = await getRange(), out = [];
    for (let s = a; s <= b; s += C.step) {
      const e = Math.min(b, s + C.step - 1), fb = "0x" + s.toString(16), tb = "0x" + e.toString(16);
      for (const topics of [ [ TRANSFER, pad(addr) ], [ TRANSFER, null, pad(addr) ] ]) {
        const lists = C.topicOnly ? [ null ] : tokenLists;
        for (const address of lists) {
          const logs = await rpcCall(C.logRpc, "eth_getLogs", [ {
            fromBlock: fb,
            toBlock: tb,
            topics,
            ...address ? {
              address
            } : {}
          } ]);
          for (const l of logs) {
            const tok = C.tokens[l.address.toLowerCase()];
            if (!tok || l.topics.length < 3) continue;
            const blk = parseInt(l.blockNumber);
            out.push({
              key: l.transactionHash + ":" + parseInt(l.logIndex),
              hash: l.transactionHash,
              block: blk,
              t: await blockTime(blk),
              from: unpad(l.topics[1]),
              to: unpad(l.topics[2]),
              sym: tok[0],
              amt: Number(BigInt(l.data)) / 10 ** tok[1],
              token: l.address.toLowerCase()
            });
          }
        }
      }
    }
    try {
      out.push(...await nativeMoves(addr, a, b, thrCoins));
    } catch (e) {
      out.nativeError = "native-coin moves not read (archive RPC): " + e.message;
    }
    return out;
  };
}

async function isPlainWallet(C, addr) {
  const code = String(await rpcCall(C.rpc, "eth_getCode", [ addr, "latest" ]) || "0x");
  return code === "0x" || code.startsWith("0xef0100");
}

async function crawlChain(id, since) {
  const C = CHAINS[id];
  const nodes = new Map, events = new Map, freezes = new Map, errors = [];
  const add = n => {
    if (!nodes.has(n.addr) && nodes.size < MAX_NODES) nodes.set(n.addr, n);
    return nodes.get(n.addr);
  };
  for (const [addr, label, evidence] of C.victims) add({
    addr,
    label,
    plain: "Binance wallet",
    role: "victim",
    note: "",
    evidence
  });
  for (const a of ETH_SIDE) add({
    addr: a,
    label: a === EX2 ? "Exploiter 2 (same address as Ethereum)" : "Ethereum attacker address " + a.slice(0, 6) + "…" + a.slice(-4),
    plain: "Attacker wallet",
    role: a === EX2 ? "hub" : "attacker",
    depth: 0,
    note: "Address from the Ethereum leg, checked on this chain.",
    evidence: "Same address as on Ethereum; the attacker holds its key there."
  });
  for (const [a, k] of Object.entries(C.known || {})) add({
    addr: a,
    ...k
  });
  const isSide = n => n && (n.role === "hub" || n.role === "hop" || n.role === "attacker");
  const read = C.routescan ? routescanReader(C, since) : rpcReader(C, since);
  const allSyms = [ C.coin, ...Object.values(C.tokens).map(t => t[0]) ];
  const P = await makePrices(allSyms, since);
  const coinPrice = P.today[C.coin] || 0;
  if (!coinPrice) errors.push("no price for " + C.coin + "; native moves read with a 1-coin threshold");
  const queue = [ ...nodes.values() ].filter(isSide), done = new Set;
  while (queue.length) {
    const n = queue.shift();
    if (done.has(n.addr)) continue;
    done.add(n.addr);
    let moves;
    try {
      moves = await read(n.addr, coinPrice ? MIN_EVT / coinPrice : 1);
    } catch (e) {
      errors.push(n.addr + ": " + e.message);
      continue;
    }
    if (moves.nativeError) errors.push(n.addr + ": " + moves.nativeError);
    for (const m of moves) {
      if (m.from === m.to) continue;
      const pr = P.at(m.sym, m.t), usd = m.amt * pr.p;
      if (usd < MIN_EVT) continue;
      let fn = nodes.get(m.from), tn = nodes.get(m.to);
      if (isSide(fn) && tn && tn.role === "inflow" && usd >= DISCOVER && (fn.depth || 0) + 1 <= MAX_DEPTH) {
        Object.assign(tn, {
          role: "hop",
          depth: (fn.depth || 0) + 1,
          label: "Wallet " + m.to.slice(0, 6) + "…" + m.to.slice(-4),
          plain: "Attacker wallet",
          note: "",
          evidence: `Received ${m.amt.toFixed(1)} ${m.sym} from ${fn.label} (tx ${m.hash})`
        });
        queue.push(tn);
      }
      if (isSide(fn) && !tn && usd >= DISCOVER) {
        const plain = await isPlainWallet(C, m.to);
        const depth = (fn.depth || 0) + 1;
        if (plain && depth <= MAX_DEPTH) {
          tn = add({
            addr: m.to,
            label: "Wallet " + m.to.slice(0, 6) + "…" + m.to.slice(-4),
            plain: "Attacker wallet",
            role: "hop",
            depth,
            note: "",
            evidence: `Received ${m.amt.toFixed(1)} ${m.sym} from ${fn.label} (tx ${m.hash})`
          });
          if (tn) queue.push(tn);
        } else if (!plain) tn = add({
          addr: m.to,
          label: "Contract " + m.to.slice(0, 6) + "…" + m.to.slice(-4),
          plain: "Swaps and services",
          role: "venue",
          note: "Contract that took money from the attacker side",
          evidence: "eth_getCode is not empty"
        });
      }
      if (!fn && isSide(tn) && usd >= DISCOVER && !await isPlainWallet(C, m.from)) fn = add({
        addr: m.from,
        label: "Contract " + m.from.slice(0, 6) + "…" + m.from.slice(-4),
        plain: "Swaps and services",
        role: "venue",
        note: "Contract that paid money into the attacker side (a swap or loan paying out)",
        evidence: "eth_getCode is not empty"
      });
      if (!fn && isSide(tn) && usd >= DISCOVER) fn = add({
        addr: m.from,
        label: "Sender " + m.from.slice(0, 6) + "…" + m.from.slice(-4),
        plain: "Other sender",
        role: "inflow",
        note: "Paid $1M+ into the attacker side; not identified",
        evidence: "tx " + m.hash
      });
      if (!(isSide(fn) || isSide(tn))) continue;
      events.set(m.key, {
        key: m.key,
        t: m.t,
        from: m.from,
        to: m.to,
        sym: m.sym,
        amt: m.amt,
        usd: Math.round(usd),
        price: pr.p,
        priceAt: pr.src,
        hash: m.hash,
        block: m.block,
        ...m.internal ? {
          internal: true
        } : {},
        ...m.token ? {
          token: m.token
        } : {}
      });
      if (id === "arb" && m.to === ARB_FROZEN && isSide(fn)) freezes.set(m.hash, {
        key: m.hash,
        issuer: "Arbitrum Security Council",
        addr: m.from,
        t: m.t,
        hash: m.hash,
        block: m.block,
        sym: m.sym,
        amt: m.amt,
        txType: m.txType || null
      });
    }
  }
  for (const f of C.freezeLogs || []) {
    try {
      const head = parseInt(await rpcCall(C.rpc, "eth_blockNumber", []));
      const firstEvt = Math.min(...[ ...events.values() ].map(e => e.block).filter(Boolean));
      const from = isFinite(firstEvt) ? firstEvt - 2e3 : head - 5e4;
      const side = [ ...nodes.values() ].filter(isSide).map(n => pad(n.addr));
      for (let s = from; s <= head; s += 45e3) {
        const logs = await rpcCall(C.rpc, "eth_getLogs", [ {
          address: f.token,
          topics: [ f.topic, side ],
          fromBlock: "0x" + s.toString(16),
          toBlock: "0x" + Math.min(head, s + 44999).toString(16)
        } ]);
        for (const l of logs) {
          const b = parseInt(l.blockNumber), t = parseInt((await rpcCall(C.rpc, "eth_getBlockByNumber", [ l.blockNumber, false ])).timestamp) * 1e3;
          freezes.set(l.transactionHash + ":" + parseInt(l.logIndex), {
            key: l.transactionHash + ":" + parseInt(l.logIndex),
            issuer: f.issuer,
            addr: unpad(l.topics[1]),
            t,
            hash: l.transactionHash,
            block: b,
            sym: f.sym
          });
        }
      }
    } catch (e) {
      errors.push("freeze log " + f.issuer + ": " + e.message);
    }
  }
  const touched = new Set;
  for (const e of events.values()) {
    touched.add(e.from);
    touched.add(e.to);
  }
  for (const [a, n] of nodes) if (!touched.has(a) && n.role !== "victim") nodes.delete(a);
  for (const [a, n] of nodes) if (n.role === "victim" && !touched.has(a)) nodes.delete(a);
  for (const n of nodes.values()) {
    if (!isSide(n)) continue;
    try {
      n.balances = {
        [C.coin]: Number(BigInt(await rpcCall(C.rpc, "eth_getBalance", [ n.addr, "latest" ]))) / 1e18
      };
      for (const [tok, [sym, dec]] of Object.entries(C.tokens)) {
        const v = Number(BigInt(await rpcCall(C.rpc, "eth_call", [ {
          to: tok,
          data: "0x70a08231" + pad(n.addr).slice(2)
        }, "latest" ]) || "0x0")) / 10 ** dec;
        if (v * (P.today[sym] || 0) >= 1e3) n.balances[sym] = v;
      }
    } catch (e) {
      errors.push("balance " + n.addr + ": " + e.message);
    }
  }
  if (C.victims.length && !events.size) errors.push("no movements read although victims are known: an API probably returned empty results; rerun");
  const prices = {};
  for (const s of allSyms) if (P.today[s]) prices[s] = P.today[s];
  return {
    chain: id,
    name: C.name,
    prices,
    nodes: [ ...nodes.values() ],
    events: [ ...events.values() ].sort((a, b) => a.t - b.t),
    freezes: [ ...freezes.values() ],
    errors,
    generatedAt: (new Date).toISOString()
  };
}

export async function fetchChain({since = Date.parse("2026-10-29T20:00:00Z"), chains = Object.keys(CHAINS)} = {}) {
  const out = [];
  for (const id of chains) {
    try {
      out.push(await crawlChain(id, since));
    } catch (e) {
      out.push({
        chain: id,
        prices: {},
        nodes: [],
        events: [],
        freezes: [],
        errors: [ String(e && e.stack || e) ]
      });
    }
  }
  return out;
}

if (import.meta.filename && process.argv[1] && import.meta.filename.toLowerCase() === (await (import("node:path"))).resolve(process.argv[1]).toLowerCase()) {
  const since = process.argv[2] ? Date.parse(process.argv[2]) : undefined;
  const only = process.argv[3] ? process.argv[3].split(",") : undefined;
  const res = await fetchChain({
    since,
    ...only ? {
      chains: only
    } : {}
  });
  const fs = await (import("node:fs")), path = await (import("node:path")), url = await (import("node:url"));
  const file = path.join(path.dirname(url.fileURLToPath(import.meta.url)), only ? "out-" + only.join("-") + ".json" : "out.json");
  fs.writeFileSync(file, JSON.stringify(res, null, 1));
  for (const r of res) console.log(r.chain, "nodes", r.nodes.length, "events", r.events.length, "freezes", r.freezes.length, "errors", r.errors.length, r.errors.slice(0, 3).join(" | "));
}
