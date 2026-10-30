export const RPC = "https://ethereum-rpc.publicnode.com";

export const BS = "https://eth.blockscout.com/api/v2";

export const SINCE = Date.parse("2026-10-28T00:00:00Z");

export const ATTACK_BLOCK = 26300672;

export const MIN_EVT = 1e4;

export const DISCOVER = 1e6;

export const MAX_DEPTH = 4, MAX_NODES = 70;

export const USDT = "0xdac17f958d2ee523a2206206994597c13d831ec7";

export const USDC = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";

export const ZERO = "0x0000000000000000000000000000000000000000";

export const ATTACKER = "0x7c8601d4645b93cea45f71e118a729332e6b5ca0";

export const B14 = "0x28c6c06298d514db089934071355e5743bf21d60";

export const TOPIC_USDT_BL = "0x42e160154868087d6bfdc0ca23d96a1c1cfa32f1b72ba9ba27b69b98a0d819dc";

export const TOPIC_USDC_BL = "0xffa4e6181777692565cf28528fc88fd1516ea86b56da075235fa575af6a4b855";

export const RLUSD = "0x8292bb45bf1ee4d140127049757c2e0ff06317ed";

export const AAVE_POOL = "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2";

export const DELEGATE = "0x63e842b054bd624a465454d533c33f573e9c6fae";

export const TOPIC_RLUSD_BL = "0xae7f60c1b8f645c3beffeb531169cbc446874bbf247698325318879ac850c346";

export const SEEDS = [ {
  addr: B14,
  label: "Binance 14",
  plain: "Binance wallet 14",
  mini: "Binance 14",
  role: "victim"
}, {
  addr: "0xdfd5293d8e347dfe59e90efd55b2956a1343963d",
  label: "Binance 16",
  plain: "Binance wallet 16",
  mini: "Binance 16",
  role: "victim"
}, {
  addr: "0xee7ae85f2fe2239e27d9c1e23fffe168d63b4055",
  label: "Binance Hot Wallet 34",
  plain: "Binance wallet 34",
  mini: "Binance 34",
  role: "victim",
  note: "A Circle smart account owned by Binance 14 (getNativeOwner). 823M USDC was pulled out by calls made as Binance 14."
}, {
  addr: ATTACKER,
  label: "Attacker 0x7c86…5ca0",
  plain: "Attacker",
  role: "attacker",
  note: "Funded through Tornado Cash: three 0.1 ETH withdrawals on 28-29 Oct and 1.08 ETH from a second Tornado-funded wallet. Sends the calls that empty Binance 14."
}, {
  addr: "0x63e842b054bd624a465454d533c33f573e9c6fae",
  label: "Delegate contract 0x63e8…6fae",
  plain: "Attacker's program",
  role: "attacker",
  note: "Deployed by the attacker at 15:59 on 29 Oct. Binance 14 was pointed at it through EIP-7702. Only accepts calls from the attacker."
}, {
  addr: "0x5227f603c1ee34ce3c06efe6477003bdfccb2f8c",
  label: "Exploiter 2",
  plain: "Attacker wallet A",
  mini: "Wallet A",
  role: "hub",
  note: 'Etherscan: "Binance Hot Wallet Exploiter 2". Received the sweep.'
}, {
  addr: "0x8532fa14acaf483729c449b8458aeddb900543d4",
  label: "Exploiter 8",
  plain: "Attacker wallet B",
  mini: "Wallet B",
  role: "hub",
  note: "Holds the 195,460 ETH moved out of Exploiter 2 at 20:39."
}, {
  addr: "0xa97bf7836f8a08f9ed91d41453d371493fae8d10",
  label: "Wallet 0xa97b…8d10",
  plain: "Attacker wallet C",
  mini: "Wallet C",
  role: "hub",
  note: "Received the last two sweeps of Binance 14, at 22:39 and 23:56, after Tether and Circle had frozen Exploiter 2."
}, {
  addr: "0xccbef95633adb5cd2b5038db5a38d77e726ca263",
  label: "Wallet 0xccbe…a263",
  plain: "Attacker wallet",
  role: "hop",
  depth: 1
}, {
  addr: "0x5c23023ca6633f91ded909b4a753a3ca00fea4fc",
  label: "Wallet 0x5c23…a4fc",
  plain: "Attacker wallet",
  role: "hop",
  depth: 1
} ];

export const KNOWN = {
  "0xeb3107117fead7de89cd14d463d340a2e6917769": {
    role: "recovered",
    depth: 0,
    label: "Synthetix protocolDAO Safe",
    plain: "Taken back by Synthetix",
    mini: "Synthetix",
    note: "8.4M SNX pulled back out of Exploiter 2 at 23:03:47."
  },
  "0x84a917f50b16d1564d53ac85c63d7c48b645d87d": {
    role: "recovered",
    depth: 0,
    label: "The Sandbox Safe",
    plain: "Taken back by The Sandbox",
    mini: "The Sandbox",
    note: "58.4M SAND pulled back out of Exploiter 2 at 23:27:11, through a Safe funded by The Sandbox treasury."
  },
  "0x008f06f04b72da2621a4f37f5531cc7352187dcd": {
    role: "hop",
    depth: 2,
    label: "Wallet 0x008f…7dcd",
    plain: "Attacker wallet",
    note: "Took 88.5M RLUSD from 0x5c23 at 21:25 and passed it on to 0xe702 eight minutes later."
  },
  "0xb171ca86f82070282138352ff7111b494060c8c3": {
    role: "hop",
    depth: 2,
    label: "Wallet 0xb171…c8c3",
    plain: "Attacker wallet",
    note: "Took 30M USDT and 57,892 ETH from 0xccbe at 21:16. Tether froze it at 21:18:59; the Ether went on to Exploiter 11."
  },
  "0x897c80d1a9729e94460e2bd93178bd5215158df3": {
    label: "Exploiter 11",
    note: "Etherscan label per Decrypt. The largest Ether pile after Wallet B."
  },
  "0x8d53903625b8e839b9df4bd28b0efb1cd6b8639a": {
    note: "Put 60M USDT into Aave and borrowed 19,762 ETH against it at 20:59-21:01, then sent the Ether on. Tether froze it 48 s after the USDT left."
  },
  "0xcc6d2f26d363836f85a42d249e145ec0320d3e55": {
    venue: "Unverified contracts"
  },
  "0x0000000000be226afde21672a5e4adc45692e69d": {
    venue: "Unverified contracts"
  },
  "0xbeef02961503351625926ea9a11ae13b29f5c555": {
    venue: "Unverified contracts"
  }
};

export const isAddr = a => typeof a === "string" && /^0x[0-9a-f]{40}$/.test(a);

export const isHash = h => typeof h === "string" && /^0x[0-9a-fA-F]{64}$/.test(h);

export const short = a => a.startsWith("0x") ? a.slice(0, 6) + "…" + a.slice(-4) : a;

export const big = (v, d) => {
  try {
    return Number(BigInt(v)) / 10 ** Number(d || 0);
  } catch {
    return Number(v) / 10 ** Number(d || 0);
  }
};

export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const isSide = n => !!n && (n.role === "attacker" || n.role === "hub" || n.role === "hop");

export const STABLE = new Set([ "USDT", "USDC", "USD1", "RLUSD", "USDE", "DAI", "FDUSD", "PYUSD", "TUSD", "USDS" ]);

export const assetClass = sym => sym === "ETH" || sym === "WETH" || /ETH$/.test(sym) ? "eth" : STABLE.has((sym || "").toUpperCase()) ? "usd" : "tok";

export function venueKind(name) {
  if (/aave|compound|morpho|spark|lending|euler|fluid/i.test(name)) return [ "Lending protocols", "Lending (Aave and others)" ];
  if (/bridge|wormhole|across|stargate|layerzero|hop protocol|synapse|thorchain|portal/i.test(name)) return [ "Bridges", "Bridges to other chains" ];
  if (/tornado|railgun|mixer/i.test(name)) return [ "Mixers", "Mixers" ];
  if (/uniswap|pool|swap|curve|weth|router|1inch|cow|paraswap|kyber|balancer|executor|adapter|settlement|aggregat|pancake|sushi|odos|\/|manager/i.test(name)) return [ "DEX swaps", "Swapped on exchanges" ];
  return [ "Other contracts", "Other contracts" ];
}

export function makeState() {
  return {
    nodes: new Map,
    alias: new Map,
    edges: new Map,
    events: new Map,
    freezes: new Map,
    ethPrice: 0,
    block: 0,
    health: {
      ok: 0,
      fail: 0,
      lastErr: "",
      lastOk: 0
    },
    onEvent: null,
    onNode: null
  };
}

export const node = (S, a) => S.nodes.get((S.alias.get(a) || a).toLowerCase());

export function addNode(S, o) {
  const addr = o.addr.toLowerCase();
  if (S.nodes.has(addr)) return S.nodes.get(addr);
  if (S.nodes.size >= MAX_NODES) return null;
  const k = KNOWN[addr];
  if (k && k.venue) return null;
  const n = {
    link: addr.startsWith("0x") ? addr : null,
    depth: 0,
    eth: 0,
    tokens: [],
    usdtBl: false,
    usdcBl: false,
    rlusdBl: false,
    polled: 0,
    members: [],
    ...o,
    ...k,
    addr
  };
  S.nodes.set(addr, n);
  if (S.onNode) S.onNode(n);
  return n;
}

export function loadData(S, d) {
  if (!d || !Array.isArray(d.nodes) || !Array.isArray(d.events)) throw new Error("data.json is missing its wallets or movements");
  const out = {
    nodes: 0,
    events: [],
    freezes: []
  };
  for (const n of d.nodes) {
    if (!n || typeof n.addr !== "string") continue;
    const have = S.nodes.get(n.addr.toLowerCase());
    if (have) Object.assign(have, n, KNOWN[have.addr], {
      addr: have.addr
    }); else if (addNode(S, {
      ...n
    })) out.nodes++;
  }
  for (const [a, k] of d.alias || []) if (isAddr(a) && typeof k === "string") S.alias.set(a, k);
  for (const e of d.events) if (e && !S.events.has(e.key) && isAddr(e.from) && isAddr(e.to) && isHash(e.hash)) {
    S.events.set(e.key, e);
    out.events.push(e);
  }
  for (const z of d.freezes || []) if (z && !S.freezes.has(z.key) && isAddr(z.addr) && isHash(z.hash)) {
    S.freezes.set(z.key, z);
    out.freezes.push(z);
  }
  if (d.block >= S.block) {
    S.block = d.block;
    S.ethPrice = d.ethPrice || S.ethPrice;
  }
  if (d.watch) S.watch = d.watch;
  S.generatedAt = d.generatedAt;
  S.failures = d.failures || 0;
  return out;
}

const nameOfParty = p => p.name || p.metadata && p.metadata.tags && p.metadata.tags[0] && p.metadata.tags[0].name || "";

function isWallet(party) {
  const a = party.hash.toLowerCase(), name = nameOfParty(party);
  if (KNOWN[a] && KNOWN[a].venue) return false;
  return /GnosisSafe/i.test(name) || party.proxy_type === "eip7702" || !party.is_contract && !name;
}

function venueFor(S, party) {
  const a = party.hash.toLowerCase(), name = nameOfParty(party), forced = KNOWN[a] && KNOWN[a].venue;
  const [kind, plain] = forced ? [ forced, "Unnamed contracts" ] : party.is_contract && !name ? [ "Unverified contracts", "Unnamed contracts" ] : venueKind(name);
  const key = "venue:" + kind;
  const v = S.nodes.get(key.toLowerCase()) || addNode(S, {
    addr: key,
    label: kind,
    plain,
    role: "venue"
  });
  if (!v) return null;
  S.alias.set(a, key);
  if (!v.members.some(m => m.addr === a)) v.members.push({
    addr: a,
    name
  });
  if (!v.link) v.link = a;
  return v;
}

function classify(S, party, fromNode, usd) {
  const a = party.hash.toLowerCase();
  const known = node(S, a);
  const depth = (fromNode.role === "hop" ? fromNode.depth : 0) + 1;
  if (known && known.role === "inflow" && isSide(fromNode) && usd >= DISCOVER && !KNOWN[a]) Object.assign(known, {
    role: "hop",
    depth,
    label: "Wallet " + short(a),
    plain: "Attacker wallet"
  });
  if (known) return known;
  if (a === ZERO) return addNode(S, {
    addr: a,
    label: "Zero address (burn)",
    plain: "Burned",
    role: "venue"
  });
  if (!isSide(fromNode) || usd < DISCOVER) return null;
  if (!isWallet(party)) return venueFor(S, party);
  if (depth > MAX_DEPTH) return null;
  const safe = /GnosisSafe/i.test(nameOfParty(party));
  return addNode(S, {
    addr: a,
    label: (safe ? "Safe " : "Wallet ") + short(a),
    plain: "Attacker wallet",
    role: "hop",
    depth,
    firstSeen: Date.now()
  });
}

function record(S, ev, fromParty, toParty) {
  if (S.events.has(ev.key) || !isAddr(ev.from) || !isAddr(ev.to) || !isHash(ev.hash)) return;
  let fn = node(S, ev.from), tn = node(S, ev.to);
  if (!fn && isSide(tn) && ev.usd >= DISCOVER) fn = isWallet(fromParty) ? addNode(S, {
    addr: ev.from,
    label: "Sender " + short(ev.from),
    plain: "Other sender",
    role: "inflow"
  }) : venueFor(S, fromParty);
  if ((!tn || tn.role === "inflow") && fn && isSide(fn)) tn = classify(S, toParty, fn, ev.usd);
  S.events.set(ev.key, ev);
  if (S.onEvent) S.onEvent(ev);
}

export function ingestTx(S, it) {
  if (!it.from || !it.to) return;
  const t = it.timestamp ? Date.parse(it.timestamp) : Date.now();
  if (t < SINCE) return;
  const amt = big(it.value, 18), usd = amt * S.ethPrice;
  const from = it.from.hash.toLowerCase(), to = it.to.hash.toLowerCase();
  const call = from === ATTACKER && to === B14 && !amt;
  if (usd < MIN_EVT && !call) return;
  record(S, {
    key: it.hash,
    t,
    from,
    to,
    sym: call ? "call" : "ETH",
    amt,
    usd: call ? 0 : usd,
    hash: it.hash,
    block: it.block_number || it.block || 0,
    method: it.method || null
  }, it.from, it.to);
}

export function ingestTransfer(S, it) {
  if (!it.from || !it.to || !it.token) return;
  const t = it.timestamp ? Date.parse(it.timestamp) : Date.now();
  if (t < SINCE) return;
  const rate = Number(it.token.exchange_rate);
  if (!rate) return;
  const amt = big(it.total && it.total.value || "0", it.total && it.total.decimals || it.token.decimals);
  const usd = amt * rate;
  if (usd < MIN_EVT) return;
  record(S, {
    key: it.transaction_hash + ":" + it.log_index,
    t,
    from: it.from.hash.toLowerCase(),
    to: it.to.hash.toLowerCase(),
    sym: it.token.symbol || "?",
    amt,
    usd,
    hash: it.transaction_hash,
    block: it.block_number || 0,
    token: (it.token.address_hash || it.token.address || "").toLowerCase()
  }, it.from, it.to);
}

export function ingestInternal(S, it) {
  if (!it.from || !it.to || !it.success || it.type !== "call" || !it.index) return;
  const t = it.timestamp ? Date.parse(it.timestamp) : Date.now();
  if (t < SINCE) return;
  const amt = big(it.value || "0", 18), usd = amt * S.ethPrice;
  if (usd < MIN_EVT) return;
  record(S, {
    key: it.transaction_hash + ":i" + it.index,
    t,
    from: it.from.hash.toLowerCase(),
    to: it.to.hash.toLowerCase(),
    sym: "ETH",
    amt,
    usd,
    hash: it.transaction_hash,
    block: it.block_number || 0,
    internal: true
  }, it.from, it.to);
}

export function makeClient(S, {gap = 140} = {}) {
  let chain = Promise.resolve();
  const fail = (where, e) => {
    S.health.fail++;
    S.health.lastErr = where + ": " + (e && e.message || e);
    console.error("[tracker]", where, e);
  };
  function bs(path) {
    const run = async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        let res;
        try {
          res = await fetch(BS + path);
        } catch (e) {
          res = {
            ok: false,
            status: 0
          };
        }
        if (res.ok) {
          S.health.ok++;
          S.health.lastOk = Date.now();
          await sleep(gap);
          return res.json();
        }
        if (res.status === 404 || res.status === 422) throw new Error(res.status + " " + path);
        await sleep(1500 * 2 ** attempt);
      }
      throw new Error("Blockscout did not answer " + path);
    };
    const p = chain.then(run, run);
    chain = p.catch(() => {});
    return p;
  }
  async function rpc(calls) {
    const body = calls.map((c, i) => ({
      jsonrpc: "2.0",
      id: i,
      method: c[0],
      params: c[1]
    }));
    const res = await fetch(RPC, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("RPC HTTP " + res.status);
    const out = await res.json();
    if (!Array.isArray(out)) throw new Error("RPC: " + JSON.stringify(out).slice(0, 120));
    S.health.ok++;
    S.health.lastOk = Date.now();
    return calls.map((_, i) => {
      const r = out.find(o => o.id === i);
      if (r && r.error) throw new Error("RPC " + c0(calls[i]) + ": " + r.error.message);
      return r && r.result;
    });
  }
  const c0 = c => c[0];
  const pad = a => a.slice(2).toLowerCase().padStart(64, "0");
  async function pages(path, ingest, maxPages) {
    let q = "";
    for (let p = 0; p < maxPages; p++) {
      const j = await bs(path + q);
      const items = j.items || [];
      items.forEach(it => ingest(S, it));
      const last = items[items.length - 1];
      const oldest = last && last.timestamp ? Date.parse(last.timestamp) : Date.now();
      if (!j.next_page_params || oldest < SINCE) break;
      q = (path.includes("?") ? "&" : "?") + new URLSearchParams(j.next_page_params).toString();
    }
  }
  async function pollNode(n, maxPages) {
    try {
      const a = await bs("/addresses/" + n.addr);
      const toks = await bs("/addresses/" + n.addr + "/token-balances");
      if (a.exchange_rate) S.ethPrice = Number(a.exchange_rate);
      n.eth = big(a.coin_balance || "0", 18);
      n.tokens = (toks || []).map(b => {
        const amt = big(b.value, b.token.decimals), rate = Number(b.token.exchange_rate) || 0;
        return {
          sym: b.token.symbol || "?",
          token: (b.token.address_hash || b.token.address || "").toLowerCase(),
          amt,
          usd: amt * rate
        };
      }).filter(x => x.usd > 1e3).sort((x, y) => y.usd - x.usd);
      await pages("/addresses/" + n.addr + "/transactions", ingestTx, maxPages);
      await pages("/addresses/" + n.addr + "/token-transfers?type=ERC-20", ingestTransfer, maxPages);
      await pages("/addresses/" + n.addr + "/internal-transactions", ingestInternal, maxPages);
      n.polled = Date.now();
    } catch (e) {
      fail(n.plain + " " + short(n.addr), e);
    }
  }
  async function pollVictims() {
    const vs = [ ...S.nodes.values() ].filter(n => n.role === "victim");
    const calls = [];
    vs.forEach(n => {
      calls.push([ "eth_getBalance", [ n.addr, "latest" ] ]);
      calls.push([ "eth_call", [ {
        to: USDT,
        data: "0x70a08231" + pad(n.addr)
      }, "latest" ] ]);
      calls.push([ "eth_call", [ {
        to: USDC,
        data: "0x70a08231" + pad(n.addr)
      }, "latest" ] ]);
    });
    try {
      const r = await rpc(calls);
      vs.forEach((n, i) => {
        n.eth = big(r[i * 3] || "0x0", 18);
        const usdt = big(r[i * 3 + 1] || "0x0", 6), usdc = big(r[i * 3 + 2] || "0x0", 6);
        n.tokens = [ {
          sym: "USDT",
          amt: usdt,
          usd: usdt
        }, {
          sym: "USDC",
          amt: usdc,
          usd: usdc
        } ].filter(x => x.usd > 1e3);
        n.polled = Date.now();
      });
    } catch (e) {
      fail("Binance balances", e);
    }
  }
  async function pollBlacklist() {
    const side = [ ...S.nodes.values() ].filter(n => isSide(n) || n.role === "victim");
    const calls = [];
    side.forEach(n => {
      calls.push([ "eth_call", [ {
        to: USDT,
        data: "0xe47d6060" + pad(n.addr)
      }, "latest" ] ]);
      calls.push([ "eth_call", [ {
        to: USDC,
        data: "0xfe575a87" + pad(n.addr)
      }, "latest" ] ]);
      calls.push([ "eth_call", [ {
        to: RLUSD,
        data: "0xbc8c4b4f" + pad(n.addr)
      }, "latest" ] ]);
    });
    try {
      const r = await rpc(calls);
      const yes = v => !!v && v !== "0x" && BigInt(v) === 1n;
      side.forEach((n, i) => {
        n.usdtBl = yes(r[i * 3]);
        n.usdcBl = yes(r[i * 3 + 1]);
        n.rlusdBl = yes(r[i * 3 + 2]);
      });
    } catch (e) {
      fail("blacklist check", e);
    }
  }
  async function pollFreezeLogs(fromBlock) {
    try {
      const from = "0x" + Math.max(ATTACK_BLOCK, fromBlock).toString(16);
      const [a, b, c] = await rpc([ [ "eth_getLogs", [ {
        address: USDT,
        fromBlock: from,
        toBlock: "latest",
        topics: [ TOPIC_USDT_BL ]
      } ] ], [ "eth_getLogs", [ {
        address: USDC,
        fromBlock: from,
        toBlock: "latest",
        topics: [ TOPIC_USDC_BL ]
      } ] ], [ "eth_getLogs", [ {
        address: RLUSD,
        fromBlock: from,
        toBlock: "latest",
        topics: [ TOPIC_RLUSD_BL ]
      } ] ] ]);
      const add = (l, issuer, addrHex) => {
        const addr = "0x" + addrHex.slice(-40).toLowerCase();
        const key = l.transactionHash + ":" + parseInt(l.logIndex, 16);
        if (S.freezes.has(key) || !isAddr(addr) || !isHash(l.transactionHash)) return;
        S.freezes.set(key, {
          key,
          issuer,
          addr,
          t: parseInt(l.blockTimestamp, 16) * 1e3,
          block: parseInt(l.blockNumber, 16),
          hash: l.transactionHash
        });
      };
      (a || []).forEach(l => add(l, "Tether", l.data));
      (b || []).forEach(l => add(l, "Circle", l.topics[1]));
      (c || []).forEach(l => add(l, "Ripple", l.data));
    } catch (e) {
      fail("freeze log", e);
    }
  }
  async function watch() {
    const w = {
      ...S.watch || {}
    };
    try {
      const [code] = await rpc([ [ "eth_getCode", [ B14, "latest" ] ] ]);
      w.b14 = {
        code: String(code || "0x").toLowerCase().slice(0, 48),
        at: Date.now()
      };
    } catch (e) {
      fail("delegation check", e);
    }
    try {
      const side = [ ...S.nodes.values() ].filter(n => isSide(n) && isAddr(n.addr));
      const res = await rpc(side.map(n => [ "eth_call", [ {
        to: AAVE_POOL,
        data: "0xbf92857c" + n.addr.slice(2).padStart(64, "0")
      }, "latest" ] ]));
      const list = [];
      res.forEach((r, i) => {
        if (!r || r.length < 2 + 64 * 6) return;
        const word = k => BigInt("0x" + r.slice(2 + 64 * k, 66 + 64 * k));
        const coll = Number(word(0)) / 1e8, debt = Number(word(1)) / 1e8;
        if (coll >= 1e3 || debt >= 1e3) list.push({
          addr: side[i].addr,
          coll,
          debt,
          hf: debt > 0 ? Number(word(5)) / 1e18 : null
        });
      });
      w.aave = {
        list,
        at: Date.now()
      };
    } catch (e) {
      fail("Aave check", e);
    }
    S.watch = w;
  }
  async function head() {
    try {
      const [bn] = await rpc([ [ "eth_blockNumber", [] ] ]);
      S.block = parseInt(bn, 16);
    } catch (e) {
      fail("block height", e);
    }
  }
  async function price() {
    try {
      const s = await bs("/stats");
      S.ethPrice = Number(s.coin_price) || S.ethPrice;
    } catch (e) {
      fail("price", e);
    }
  }
  return {
    bs,
    rpc,
    pollNode,
    pollVictims,
    pollBlacklist,
    pollFreezeLogs,
    watch,
    head,
    price,
    fail
  };
}

export function totalsAt(S, t, since = 0) {
  const live = t == null;
  const T = {
    out: 0,
    outN: 0,
    held: 0,
    frozen: 0,
    movedOn: 0,
    recovered: 0,
    heldBy: new Map,
    frozenBy: new Map
  };
  const flows = new Map;
  const f = k => flows.get(k) || (flows.set(k, {
    usd: 0,
    sym: new Map
  }), flows.get(k));
  for (const e of S.events.values()) {
    if (!live && e.t > t || e.t < since) continue;
    const fn = node(S, e.from), tn = node(S, e.to);
    if (fn && fn.role === "victim" && !(tn && tn.role === "victim")) {
      T.out += e.usd;
      T.outN++;
    }
    if (isSide(fn) && tn && tn.role === "recovered") T.recovered += e.usd; else if (isSide(fn) && tn && !isSide(tn) && tn.role !== "victim") T.movedOn += e.usd;
    if (fn) {
      const x = f(fn.addr);
      x.usd -= e.usd;
      x.sym.set(e.sym, (x.sym.get(e.sym) || 0) - e.usd);
    }
    if (tn) {
      const x = f(tn.addr);
      x.usd += e.usd;
      x.sym.set(e.sym, (x.sym.get(e.sym) || 0) + e.usd);
    }
  }
  const frozenAt = new Map;
  for (const z of S.freezes.values()) {
    if (!live && z.t > t) continue;
    const k = node(S, z.addr);
    if (!k) continue;
    const m = frozenAt.get(k.addr) || {};
    m[z.issuer] = z.t;
    frozenAt.set(k.addr, m);
  }
  for (const n of S.nodes.values()) {
    let held, frozen = 0;
    if (live) {
      held = n.eth * S.ethPrice + n.tokens.reduce((s, x) => s + x.usd, 0);
      frozen = n.tokens.reduce((s, x) => s + (x.sym === "USDT" && n.usdtBl || x.sym === "USDC" && n.usdcBl || x.sym === "RLUSD" && n.rlusdBl ? x.usd : 0), 0);
    } else {
      const x = flows.get(n.addr);
      held = n.role === "victim" ? 0 : Math.max(0, x ? x.usd : 0);
      const fz = frozenAt.get(n.addr);
      if (fz && x) {
        if (fz.Tether) frozen += Math.max(0, x.sym.get("USDT") || 0);
        if (fz.Circle) frozen += Math.max(0, x.sym.get("USDC") || 0);
        if (fz.Ripple) frozen += Math.max(0, x.sym.get("RLUSD") || 0);
      }
      frozen = Math.min(frozen, held);
    }
    T.heldBy.set(n.addr, held);
    T.frozenBy.set(n.addr, frozen);
    if (isSide(n)) {
      T.held += held;
      T.frozen += frozen;
    }
  }
  return T;
}

export const TANKS = [ "M", "F", "V", "R", "X" ];

const ISSUER_OF = {
  USDT: "Tether",
  USDC: "Circle",
  RLUSD: "Ripple"
};

export function tankSteps(S, since) {
  const value = e => e.sym === "ETH" || e.sym === "WETH" ? e.amt * S.ethPrice : STABLE.has((e.sym || "").toUpperCase()) ? e.amt : e.usd;
  const cat = n => !n ? "other" : n.role === "victim" ? "victim" : isSide(n) ? "side" : n.role === "venue" ? "venue" : n.role === "recovered" ? "back" : "other";
  const evs = [ ...S.events.values() ].filter(e => e.t >= since && e.usd > 0).sort((a, b) => a.t - b.t || (a.key < b.key ? -1 : 1));
  const fzs = [ ...S.freezes.values() ].map(z => ({
    z,
    n: node(S, z.addr)
  })).filter(x => isSide(x.n)).sort((a, b) => a.z.t - b.z.t);
  const frozen = new Set, bal = new Map, steps = [], neg = new Map;
  const bk = (n, sym) => n.addr + "|" + sym;
  const isFz = (n, sym) => !!ISSUER_OF[sym] && frozen.has(n.addr + "|" + ISSUER_OF[sym]);
  const push = (t, a, b, v, cls, key) => {
    if (a !== b && v > 0) steps.push({
      t,
      a,
      b,
      v,
      cls,
      key
    });
  };
  let fi = 0;
  const freezeUpTo = t => {
    for (;fi < fzs.length && fzs[fi].z.t <= t; fi++) {
      const {z, n} = fzs[fi], k = n.addr + "|" + z.issuer;
      if (frozen.has(k)) continue;
      frozen.add(k);
      const sym = Object.keys(ISSUER_OF).find(s => ISSUER_OF[s] === z.issuer);
      push(z.t, "M", "F", Math.max(0, bal.get(bk(n, sym)) || 0), "usd", z.key);
    }
  };
  for (const e of evs) {
    freezeUpTo(e.t);
    const fn = node(S, e.from), tn = node(S, e.to), fc = cat(fn), tc = cat(tn), v = value(e), cls = assetClass(e.sym);
    if (!(v > 0)) continue;
    if (fc === "side") {
      const k = bk(fn, e.sym), b = (bal.get(k) || 0) - v;
      bal.set(k, b);
      if (b < -1) neg.set(k, b); else neg.delete(k);
    }
    if (tc === "side") {
      const k = bk(tn, e.sym), b = (bal.get(k) || 0) + v;
      bal.set(k, b);
      if (b < -1) neg.set(k, b); else neg.delete(k);
    }
    const src = fc === "side" ? isFz(fn, e.sym) ? "F" : "M" : null, dst = tc === "side" ? isFz(tn, e.sym) ? "F" : "M" : null;
    if (fc === "victim" && dst) push(e.t, "B", dst, v, cls, e.key); else if (src && dst) push(e.t, src, dst, v, cls, e.key); else if (src) push(e.t, src, tc === "venue" ? "V" : tc === "back" || tc === "victim" ? "R" : "X", v, cls, e.key); else if (dst) push(e.t, fc === "venue" ? "V" : fc === "back" ? "R" : "X", dst, v, cls, e.key);
  }
  freezeUpTo(Infinity);
  const missing = [ ...neg.values() ].reduce((s, b) => s - b, 0);
  return {
    steps,
    missing
  };
}

export function tankLevels(steps, t = Infinity) {
  const L = {
    B: 0,
    M: 0,
    F: 0,
    V: 0,
    R: 0,
    X: 0
  }, by = {};
  for (const k in L) by[k] = {
    eth: 0,
    usd: 0,
    tok: 0
  };
  for (const s of steps) {
    if (s.t > t) break;
    if (s.a === "B") {
      L.B += s.v;
      by.B[s.cls] += s.v;
    } else {
      L[s.a] -= s.v;
      by[s.a][s.cls] -= s.v;
    }
    L[s.b] += s.v;
    by[s.b][s.cls] += s.v;
  }
  L.by = by;
  return L;
}
