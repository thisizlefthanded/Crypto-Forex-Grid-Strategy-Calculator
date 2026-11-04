<div align="center">

[![Deploy on Hostinger](https://assets.hostinger.com/vps/deploy.svg)](https://www.hostinger.com/docker-hosting?template=thisizlefthanded/Crypto-Forex-Grid-Strategy-Calculator&ref=YOUR_PARTNER_CODE)

# GridCalc — Crypto & Forex Grid Strategy Calculator

**Plan a grid before you risk a cent.** Levels, lot sizing, take-profits, drawdown, margin and stop-out — calculated live as you drag the sliders.

[![CI](https://github.com/thisizlefthanded/Crypto-Forex-Grid-Strategy-Calculator/actions/workflows/ci.yml/badge.svg)](https://github.com/thisizlefthanded/Crypto-Forex-Grid-Strategy-Calculator/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-22e3a0)
![React](https://img.shields.io/badge/React-19-2ad4ff)
![Docker](https://img.shields.io/badge/Docker-ready-2ad4ff)

</div>

---

GridCalc is a free, open-source web app for traders who run grid strategies on **Forex** (EUR/USD, GBP/USD, USD/JPY…), **metals** (XAU/USD gold, XAG/USD silver) and **crypto** (BTC/USDT, ETH/USDT, SOL/USDT). It runs entirely in the browser — no account, no API keys, no tracking — and ships as a small nginx-based Docker image you can put on any VPS.

## Features

### Market & grid setup
- Asset presets with correct contract sizes, pip sizes and digits (100,000 units for FX, 100 oz gold, 5,000 oz silver, 1 coin for crypto) — all editable for custom instruments.
- Current price, upper / lower limits and grid count with linked sliders and number inputs.
- **Arithmetic** (equal price step) or **geometric** (equal % step) spacing.
- **Long**, **Short** or **Neutral** (both sides) grids.

### Calculation engine
- Grid step: `(Upper − Lower) ÷ Grids`, shown in price, pips and %.
- Order sizing either **from capital** (each side sized so a full fill uses N % of your capital as margin) or **fixed lot / coin size**.
- Volume allocation: **Equal**, **Martingale** (×m per level deeper) or **Arithmetic tiers** (+i per level deeper), rounded to the broker's volume step.
- Take-profit per level (one step away) and **trailing take-profit milestones** showing exactly where the stop ratchets and how much extra profit is locked.
- Costs included in every number: spread (pips), commission per lot (round turn) and exchange fee % per side.
- Correct USD conversion for USD-base pairs like USD/JPY.

### Risk & profitability matrix
- Net profit per grid execution (USD and % of notional), full-cycle profit, average cost.
- **Max drawdown** if price trends straight through the grid to either boundary, plus a configurable stress overshoot.
- **MetaTrader-style margin model** — leverage from spot 1:1 up to 1:1000, margin-call and stop-out levels, and the exact **price at which the broker would stop you out**.
- Warnings when costs exceed the step, orders round below the minimum lot, or stop-out lands inside the grid.
- 30-day projected profit / ROI / APR from your expected executions per day.

### Visuals
- Interactive SVG **price ladder**: buy/sell levels, volume bars, TP arrows, current price, margin-call and stop-out lines. Hover any level for details.
- Projected ROI chart with optimistic / conservative band.
- Full order book table.
- Tooltips on every financial term (Grid Step, Spread, Max Drawdown, Margin Level…).

### Export & sharing
| Format | Use it for |
|---|---|
| **JSON** | Full config + summary + orders. Re-importable. |
| **MetaTrader `.set`** | Load straight into an EA's *Inputs* tab (MT4/MT5). |
| **CCXT Python** | Ready-to-run script for 100+ exchanges (dry-run by default). |
| **CSV** | Order ladder for Excel / Google Sheets. |
| **Share link** | One URL that restores the exact setup. |

Your last configuration is saved in the browser automatically.

## Quick start (local)

Requires **Node.js 20+**.

```bash
git clone https://github.com/thisizlefthanded/Crypto-Forex-Grid-Strategy-Calculator.git
cd Crypto-Forex-Grid-Strategy-Calculator
npm install
npm run dev          # http://localhost:5173
```

Other scripts:

```bash
npm test             # unit tests for the math engine
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build locally
```

## Deploy with Docker

```bash
docker compose up -d --build
```

The app is now on **http://YOUR_SERVER_IP**. To use a different host port:

```bash
PORT=8080 docker compose up -d --build
```

Without Compose:

```bash
docker build -t gridcalc .
docker run -d --name gridcalc -p 80:80 --restart unless-stopped gridcalc
```

The image is a multi-stage build: Node compiles and tests the app, then only the static files are copied into `nginx:alpine`. It includes gzip, long-term caching for hashed assets, security headers (CSP, nosniff, frame options), a `/healthz` endpoint and a Docker health check. The Compose file runs the container read-only with `no-new-privileges` and a 64 MB memory cap.

A prebuilt image is published to GitHub Container Registry on every push to `main`:

```bash
docker run -d -p 80:80 ghcr.io/thisizlefthanded/crypto-forex-grid-strategy-calculator:latest
```

## Deploy on a Hostinger VPS

**One click:** press the **Deploy on Hostinger** button at the top of this page, pick a VPS plan, and Hostinger's Docker Manager builds and starts the container from `docker-compose.yml`.

**Manually from the Docker Manager:**
1. Open **hPanel → VPS → Docker Manager → Compose**.
2. Choose **Compose from URL** and paste this repository's URL.
3. (Optional) set the environment variable `PORT` if port 80 is taken.
4. Deploy. Open `http://YOUR_VPS_IP` when the container shows *healthy*.

To serve it on your own domain with HTTPS, point an A record at the VPS and put a reverse proxy (Traefik, Caddy or Nginx Proxy Manager) in front of the container.

## How the numbers are calculated

| Metric | Formula |
|---|---|
| Grid step (arithmetic) | `(Upper − Lower) ÷ Grids` |
| Grid ratio (geometric) | `(Upper ÷ Lower)^(1 ÷ Grids) − 1` |
| Units | `Volume × Contract size` |
| Notional (USD) | `Units × Entry` (÷ price for USD-base pairs) |
| Margin | `Notional ÷ Leverage` |
| Gross profit / grid | `Units × Step` |
| Costs / grid | `Spread × Pip × Units + Commission × Lots + Fee% × (Entry + Exit notional)` |
| Floating P/L at price *P* | `Σ Units × (P − Entry)` over filled buys (mirrored for sells) |
| Margin level | `Equity ÷ Used margin × 100` |
| Stop-out price | Price where margin level hits the stop-out %, solved per grid segment |

Buy orders go on every level **below** the current price and take profit one level up; sell orders go on every level **above** it and take profit one level down. Drawdown assumes a straight-line move with no take-profits realised on the way, which is the worst case for a grid.

## Project structure

```
src/
├── lib/
│   ├── engine.ts        # pure calculation engine (levels, sizing, risk, stop-out, trailing)
│   ├── engine.test.ts   # unit tests
│   ├── config.ts        # config model, defaults, validation, share-link encoding
│   ├── assets.ts        # instrument presets
│   ├── export.ts        # JSON / MetaTrader .set / CCXT / CSV generators
│   ├── glossary.ts      # tooltip texts
│   └── format.ts
├── components/
│   ├── panels/          # left-side input panels
│   ├── ui/              # inputs, sliders, tooltips, cards
│   ├── PriceLadder.tsx  # SVG grid ladder
│   ├── RoiChart.tsx     # SVG projection chart
│   ├── RiskTables.tsx   # risk matrix, trailing milestones, order book
│   ├── StatCards.tsx
│   └── ExportDialog.tsx
├── App.tsx
└── main.tsx
Dockerfile · nginx.conf · docker-compose.yml
```

**Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide icons, hand-built SVG charts (no chart library), Vitest. Fonts are self-hosted — the app makes no third-party requests.

## Contributing

Issues and pull requests are welcome. Please run `npm test` and `npm run build` before opening a PR. New instruments go in [`src/lib/assets.ts`](src/lib/assets.ts).

## Disclaimer

GridCalc is an educational planning tool, **not financial advice**. Results are estimates: real fills, slippage, swaps, funding rates and broker rules will differ. Grid and martingale strategies can lose more than the projected drawdown when markets trend. Trade only with money you can afford to lose.

## License

[MIT](LICENSE) © 2026 Muhammad Usama
