# Personal Finance Tracker

Track income and expenses. Two separate apps, each in its own folder:

| Folder | What it is | Runs at |
|---|---|---|
| `backend/` | REST API built with **TypeScript**, **Express** and **SQLite** | http://localhost:3000 |
| `frontend/` | bare-minimum web page in plain **HTML + JavaScript** that calls the API | http://localhost:5173 |

Why it's built this way (every decision and the alternatives considered): see [docs/DESIGN.md](docs/DESIGN.md).

## Run it

Requires Node.js 24+. Use two terminals, one per app.

```bash
# Terminal 1: the API
cd backend
npm install
npm run dev        # starts http://localhost:3000 and restarts when you save a file
```

```bash
# Terminal 2: the web page
cd frontend
npm install
npm run dev        # serves the page at http://localhost:5173
```

Then open **http://localhost:5173** (use `localhost`, not `127.0.0.1`: the API only allows that exact address).

Other backend commands (run inside `backend/`):

| Command | What it does |
|---|---|
| `npm start` | run the server once (no auto-restart) |
| `npm run typecheck` | ask TypeScript to check for mistakes (tsx runs code *without* checking types) |

The frontend has no build step: edit `frontend/index.html` or `frontend/app.js`, save, and refresh the browser.

## Try the API without the page

Open `backend/requests.http` in VS Code with the **REST Client** extension and click "Send Request". Or use curl:

```bash
curl localhost:3000/health

curl -X POST localhost:3000/transactions \
  -H "Content-Type: application/json" \
  -d '{"type":"expense","amountCents":1250,"category":"groceries"}'

curl localhost:3000/transactions
curl "localhost:3000/summary?month=2026-11"
```

## Endpoints

| Method | Path | Does |
|---|---|---|
| GET | `/health` | check the server is running |
| GET | `/transactions?month=YYYY-MM` | list transactions, newest first (`month` optional) |
| GET | `/transactions/:id` | get one transaction |
| POST | `/transactions` | create a transaction |
| PUT | `/transactions/:id` | replace a transaction |
| DELETE | `/transactions/:id` | delete a transaction |
| GET | `/summary?month=YYYY-MM` | income, expense and balance totals (`month` optional) |

Body for POST / PUT:

```json
{
  "type": "expense",
  "amountCents": 1250,
  "category": "groceries",
  "description": "optional",
  "date": "2026-11-09"
}
```

`description` defaults to `""` and `date` defaults to today.

## Good to know

- **Money is in cents.** `1250` means $12.50. Whole numbers avoid floating-point errors like `0.1 + 0.2 = 0.30000000000000004`.
- **Your data lives in `backend/finance.db`**, created the first time the server starts. Delete it to start fresh. It's in `.gitignore` so your finances never end up in git.
- **CORS:** the page (port 5173) and the API (port 3000) are different *origins*, so browsers block the page from reading API responses unless the API allows it. `backend/src/server.ts` allows `http://localhost:5173` only.

## Code map

| File | Job |
|---|---|
| `backend/src/server.ts` | creates the app, CORS, JSON parsing, 404 + error handling, starts listening |
| `backend/src/routes.ts` | all endpoints and their SQL |
| `backend/src/validate.ts` | checks incoming data before it touches the database |
| `backend/src/db.ts` | opens the database and creates the table |
| `backend/src/types.ts` | TypeScript shapes for a transaction and the summary |
| `frontend/index.html` | the page layout: month filter, summary, add/edit form, transactions table |
| `frontend/app.js` | calls the API with `fetch` and draws the results on the page |
