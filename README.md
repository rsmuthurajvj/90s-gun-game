# 🔫📖 90s Gun Game

The classic last-bench notebook shooting game from 90s school days, rebuilt for the phone.
Open a book, the last digit of the left page picks your soldier, draw them part by part, load up and shoot.

**Modes:** Pass & Play (one phone, offline) · vs Computer (offline) · Play Online (room code, real-time)

## Stack
| Layer | Tech |
|---|---|
| App | Angular 19 (standalone + signals), Capacitor 8 → Android |
| Ads | AdMob via `@capacitor-community/admob` (banner + interstitial + UMP consent) |
| Server | Node.js, Express, Socket.io, MongoDB (Mongoose) — only needed for Play Online |

## Run locally

```bash
# backend (needs MongoDB; copy .env.example → .env)
cd backend && npm install && npm run dev      # http://localhost:3000
npm test                                      # rules engine tests

# frontend
cd frontend && npm install && npm start       # http://localhost:4200
```
Pass & Play and vs Computer work without the backend.

## Android
```bash
cd frontend
npm run android:sync     # ng build + cap sync
npm run android:open     # Android Studio → run / build signed bundle
```
Publishing and ad setup: see **[PLAY_STORE_GUIDE.md](PLAY_STORE_GUIDE.md)**.

## Rules
| Roll (0/2/4/6/8) on a soldier that has… | Result |
|---|---|
| nothing → head → body → legs → arms | grows the next part (head, body, legs, arms, gun) |
| a gun | loads 6 bullets (**Classic** house rule: one bullet per roll) |
| a loaded gun | **SHOOT** — pick any living enemy soldier (**50/50** house rule: shots can miss) |
| an empty gun | reloads 6 bullets |
| been shot ❌ | turn lost |

Kill all 5 enemy soldiers to win the round. Rematch keeps the score, and the loser starts.

## Project structure
```
backend/src/
  game/engine.js         ← all game rules (pure, unit-tested in backend/test)
  socket/gameSocket.js   ← rooms, per-room locking, reconnect tokens, rematch
  models/Game.js         ← Mongoose schema (rooms auto-expire after 24 h)
frontend/src/app/
  game/engine.ts         ← TypeScript twin of engine.js (offline modes) — keep in sync
  game/cpu.ts            ← computer opponent
  services/session.ts    ← one GameSession interface: LocalSession / OnlineSession
  services/ads.service.ts, fx.service.ts (sound + haptics), settings.service.ts
  components/game-board  ← event queue: book flip → reveal → board update → shot
```
