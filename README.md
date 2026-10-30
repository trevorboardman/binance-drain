# Binance drain tracker

A to-scale picture of the 29 October 2026 Binance hot wallet drain on nine blockchains: https://binance.trevorboardman.com

- `site/` is the whole page. It reads only `site/data.json` and `site/market.json`.
- `snapshot.mjs` rebuilds `data.json` from public chain data, no keys: Blockscout's API and a public RPC for Ethereum, and the readers in `chains/` for Bitcoin, Tron, the XRP Ledger, Solana, Arbitrum, Optimism, Base and Avalanche (`merge.mjs` checks each result before it replaces that chain's last one). `market.mjs` writes `market.json`, BNB and Bitcoin prices from public exchange APIs.
- A GitHub Action runs it about every 10 minutes and publishes the page with GitHub Pages.
