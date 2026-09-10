# BlacRate Pro Backend Plan

The current app is a static PWA. This document defines the smallest backend contract needed to move trade history, users, alerts, and P2P aggregation out of browser storage.

## Laravel services

- Laravel Sanctum for session or token authentication.
- MySQL for merchants, team members, trades, alerts, and rate snapshots.
- Queue workers for marketplace polling and Telegram/Web Push delivery.
- Server-side providers for Binance/Bybit P2P and official FX rates. Provider credentials stay in `.env` and never ship to the browser.

## Suggested tables

- `merchants`: master account and branding settings.
- `users`: Laravel users linked to a merchant and assigned a role.
- `trades`: asset, quantity, rate, margin, payment channel, channel fee, total, and `created_at`.
- `rate_snapshots`: provider, asset, fiat, buy rate, sell rate, liquidity, and captured timestamp.
- `price_alerts`: user, asset, threshold, direction, channel, enabled, and last-triggered timestamp.

## API contract

- `POST /api/auth/login` and `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/rates/p2p?asset=USDT&fiat=NGN&payment=bank`
- `GET /api/rates/official?fiat=NGN`
- `GET /api/trades`
- `POST /api/trades`
- `DELETE /api/trades/{trade}`
- `GET /api/analytics?period=30d`
- `GET /api/alerts`
- `POST /api/alerts`
- `PATCH /api/alerts/{alert}`
- `DELETE /api/alerts/{alert}`

## Migration path

1. Add the Laravel API and authentication without changing the current PWA UI.
2. Replace `localStorage` reads and writes with the trade endpoints after login.
3. Move CoinGecko and FX requests behind `/api/rates/*` so rate normalization and provider keys stay server-side.
4. Store every completed quote as a trade event for reliable analytics.
5. Run alert evaluation in a queue worker and deliver browser push or Telegram messages from the server.

The current frontend already exposes the data needed by this contract: asset, quantity, rate, commission, payment channel, fee, total, and alert threshold.
