# 🔫 90s Gun Game

The classic classroom notebook shooting game — rebuilt as a full-stack real-time web app.

## Stack
| Layer | Tech |
|---|---|
| Frontend | Angular 19 + Tailwind CSS v4 |
| Backend | Node.js + Express.js + Socket.io |
| Database | MongoDB (Mongoose) |
| Future | Electron (desktop) + Capacitor (Android/iOS) |

---

## How to Run

### 1. Prerequisites
- Node.js ≥ 18
- MongoDB running locally (`mongodb://localhost:27017`)

### 2. Backend
```bash
cd backend
npm install
# copy .env.example → .env (edit if needed)
npm run dev        # hot-reload via nodemon
# or
npm start          # production
```
Server starts at **http://localhost:3000**

### 3. Frontend
```bash
cd frontend
npm install
ng serve           # dev server at http://localhost:4200
```

### 4. Play
1. Player 1 opens **http://localhost:4200**, enters name, clicks **Create New Game**.
2. Share the room code with Player 2 (or open a second browser tab).
3. Player 2 enters the room code and their name, clicks **Join**.
4. Player 1 calls the coin toss (Heads / Tails).
5. Winner goes first — click **📖 Open Book (Roll)** each turn.
6. Build your soldiers, then shoot enemies!

---

## Game Rules (quick reference)

| Number rolled | Soldier grows → |
|---|---|
| First roll on a slot | Head |
| 2nd | Body |
| 3rd | Legs |
| 4th | Arms |
| 5th | Gun |
| 6th – 11th | Bullets 1–6 (fully loaded) |
| 12th+ | **SHOOT** (choose enemy target, 50 % hit) |
| When bullets = 0 | **RELOAD** (6 new bullets) |

- Numbers available: **0, 2, 4, 6, 8** (simulates the last digit of the left page of a book)
- 5 soldiers per player (slots 0, 2, 4, 6, 8)
- A soldier killed → permanently marked ❌
- **Win**: kill all 5 enemy soldiers

---

## Project Structure
```
90sGunGame/
├── backend/
│   └── src/
│       ├── app.js              ← Express + Socket.io entry
│       ├── models/Game.js      ← Mongoose schema
│       ├── socket/gameSocket.js← All real-time game logic
│       ├── routes/game.js      ← REST API
│       ├── controllers/
│       └── middleware/
└── frontend/
    └── src/app/
        ├── models/             ← TypeScript interfaces
        ├── services/           ← SocketService, GameService
        └── components/
            ├── home/           ← Create / Join game
            ├── game-board/     ← Main board + controls
            ├── soldier-cell/   ← SVG stick figure renderer
            └── game-log/       ← Scrollable event log
```
