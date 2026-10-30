# Binance drain tracker

A to-scale picture of the 29 October 2026 Binance hot wallet drain on Ethereum: https://binance.trevorboardman.com

- `site/` is the whole page. It reads only `site/data.json`.
- `snapshot.mjs` rebuilds `data.json` from public chain data (Blockscout's API and a public Ethereum RPC, no keys). A GitHub Action runs it about every 10 minutes and publishes the page with GitHub Pages.
