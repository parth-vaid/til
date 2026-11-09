# Personal Finance Tracker API

A small REST API to track income and expenses, built with **TypeScript**, **Express** and **SQLite**.

## Run it

Requires Node.js 24+.

```bash
npm install
npm run dev        # starts http://localhost:3000 and restarts when you save a file
```

Other commands:

| Command | What it does |
|---|---|
| `npm start` | run the server once (no auto-restart) |
| `npm run typecheck` | ask TypeScript to check for mistakes (tsx runs code *without* checking types) |

## Try it

Open `requests.http` in VS Code with the **REST Client** extension and click "Send Request". Or use curl:

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
- **Your data lives in `finance.db`**, created next to `package.json` the first time the server starts. Delete it to start fresh. It's in `.gitignore` so your finances never end up in git.

## Code map

| File | Job |
|---|---|
| `src/server.ts` | creates the app, JSON parsing, 404 + error handling, starts listening |
| `src/routes.ts` | all endpoints and their SQL |
| `src/validate.ts` | checks incoming data before it touches the database |
| `src/db.ts` | opens the database and creates the table |
| `src/types.ts` | TypeScript shapes for a transaction and the summary |
