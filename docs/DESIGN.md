# Finance Tracker API: Design & Decisions

| | |
|---|---|
| **Status** | v1 (backend only): complete, manually verified |
| **Last updated** | 2026-11-10 |
| **Audience** | Anyone reading this codebase, especially developers new to backend work |
| **Related** | [README](../README.md) (how to run it) · [requests.http](../requests.http) (sample requests) |

This document explains **what was built, how it fits together, and why each choice was made** over the alternatives. If you only want to run the app, read the README instead.

## Contents

1. [Overview](#1-overview)
2. [What was built](#2-what-was-built)
3. [Architecture](#3-architecture)
4. [Decisions](#4-decisions)
   - [4.1 Scope](#41-scope)
   - [4.2 Tech stack](#42-tech-stack)
   - [4.3 Data model](#43-data-model)
   - [4.4 API design](#44-api-design)
   - [4.5 Code structure](#45-code-structure)
   - [4.6 Validation and error handling](#46-validation-and-error-handling)
   - [4.7 Testing and tooling](#47-testing-and-tooling)
5. [Verification](#5-verification)
6. [Known limitations](#6-known-limitations)
7. [Glossary](#7-glossary)

---

## 1. Overview

The Finance Tracker API is a small web server that records money coming in (**income**) and money going out (**expenses**), and reports totals. Other programs talk to it over HTTP using JSON. There is no user interface yet.

**Goals for v1**

- The smallest version that is actually useful: add, view, edit and delete transactions, and see totals.
- A *real* backend: data is stored in a real database and survives restarts.
- Beginner-friendly: few tools, few files, nothing magic. Every line should be understandable.

**Non-goals for v1** (deliberately left out)

- A frontend / user interface
- User accounts or login
- Multiple currencies, budgets, recurring transactions, charts

---

## 2. What was built

| # | Step | Outcome |
|---|---|---|
| 1 | Planning | Wrote a v1 plan and settled three scope questions: backend only, SQLite, no login ([4.1](#41-scope)) |
| 2 | Scaffolding | Created `package.json`, `tsconfig.json`, `.gitignore`; installed Express, TypeScript, tsx and type definitions |
| 3 | Data layer | `src/types.ts` (data shapes) and `src/db.ts` (opens the database, creates the table) |
| 4 | Validation | `src/validate.ts`: checks every incoming request body |
| 5 | Routes | `src/routes.ts`: all endpoints, built and reviewed one piece at a time |
| 6 | Server | `src/server.ts`: app setup, JSON parsing, 404 and error handling |
| 7 | Type fix | TypeScript rejected casting database rows straight to `Transaction[]`; fixed by casting through `unknown` ([D21](#d21-casting-database-rows-through-unknown)) |
| 8 | Verification | Type check, 17 manual checks, and a restart test, all passing ([§5](#5-verification)) |
| 9 | Docs & tooling | `requests.http`, `README.md`, and this document |
| 10 | Cleanup | Deleted the test database so the app starts empty |

> **Note on location:** work started in a separate folder, `~/Desktop/Projects/finance-tracker/`, and moved to `til/` at the project owner's request. The old folder holds early copies of a few files, is no longer used, and is safe to delete.

---

## 3. Architecture

### How a request flows through the code

```
Client (curl, REST Client, a future frontend)
   │   HTTP request, e.g.  POST /transactions   {"type":"expense", ...}
   ▼
server.ts    express.json() turns the body text into a JS object (req.body)
   │         unknown route → 404 · bad JSON → 400 · unexpected error → 500
   ▼
routes.ts    reads the URL and query ──▶ validate.ts checks the body
   │         runs a prepared SQL statement
   ▼
db.ts        node:sqlite connection
   │
   ▼
finance.db   a single file on disk that holds all the data

The response travels back up the same path: a status code + JSON.
```

### Files

| File | Responsibility | Uses |
|---|---|---|
| `src/server.ts` | Entry point: creates the app, adds middleware, handles 404s and errors, listens on port 3000 | `routes.ts` |
| `src/routes.ts` | Every endpoint and the SQL it runs | `db.ts`, `validate.ts`, `types.ts` |
| `src/validate.ts` | Checks incoming data and fills in defaults | `types.ts` |
| `src/db.ts` | Opens `finance.db` and creates the table if it's missing | (none) |
| `src/types.ts` | TypeScript shapes: `Transaction`, `TransactionInput`, `Summary` | (none) |
| `requests.http` | Clickable sample requests for VS Code | (none) |
| `README.md` | How to run and use the API | (none) |

---

## 4. Decisions

Every decision below uses the same format:

- **Decision**: what we chose
- **Why**: the reasons
- **Alternatives**: what else we could have used, and why we didn't (for now)
- **Trade-off**: what we gave up. Every choice costs something; writing it down helps the next person know when to revisit it.

### 4.1 Scope

#### D1. Backend only, no frontend yet

- **Decision:** v1 is only an API, tested with curl and the VS Code REST Client extension.
- **Why:** Project owner's choice. Learning a backend *and* a frontend at the same time doubles the number of new concepts, and the API is the foundation a frontend needs anyway.
- **Alternatives:** A plain HTML + TypeScript page, or a React app.
- **Trade-off:** You can't "see" the app in a browser yet.

#### D2. No login, single user

- **Decision:** No accounts. Whoever can reach the server can read and change all data.
- **Why:** Project owner's choice. Login (password hashing, sessions or tokens, keeping each user's data separate) roughly doubles the backend work. The server only runs on your own machine, so nobody else can reach it.
- **Trade-off:** **Not safe to put on the internet** in its current form.

### 4.2 Tech stack

| Layer | Choice | Version |
|---|---|---|
| Runtime | Node.js | 24.19 |
| Language | TypeScript, strict mode | 7.0 |
| Web framework | Express | 5.3 |
| Database | SQLite via Node's built-in `node:sqlite` | bundled with Node |
| TypeScript runner | tsx | 4.23 |

#### D3. Node.js 24

- **Decision:** Run the server on Node.js 24.
- **Why:** Already installed, and the largest ecosystem and tutorial base for JavaScript/TypeScript backends. Version 24 also ships with a built-in SQLite driver ([D6](#d6-sqlite-using-nodes-built-in-nodesqlite)).
- **Alternatives:**

  | Option | Why not (for now) |
  |---|---|
  | Bun | Fast and runs TypeScript directly, but fewer tutorials and occasional behaviour differences from Node |
  | Deno | Runs TypeScript directly, but has its own module and permission system and a smaller learning community |

- **Trade-off:** Node needs a helper to run TypeScript comfortably, so we add `tsx` ([D7](#d7-run-typescript-with-tsx-type-check-with-tsc---noemit)).

#### D4. TypeScript in strict mode

- **Decision:** All code is TypeScript with `"strict": true`.
- **Why:** TypeScript was a project requirement. Strict mode turns on all of TypeScript's safety checks; for example, it forces you to handle values that might be `undefined`, which is where many beginner bugs hide.
- **Alternatives:** Plain JavaScript (no type safety), or TypeScript without strict mode (lets many mistakes through).
- **Trade-off:** More red squiggles at first, and occasionally we have to explain things to the compiler ([D21](#d21-casting-database-rows-through-unknown)).

#### D5. Express 5

- **Decision:** Use Express as the web framework.
- **Why:** It's the most widely used Node web framework, so almost every Node backend tutorial uses it and help is easy to find. Its core ideas (*routes* and *middleware*) are small. Version 5 also catches errors from `async` route handlers automatically, which version 4 didn't.
- **Alternatives:**

  | Option | Why not (for now) |
  |---|---|
  | Plain `node:http` | No routing or JSON parsing built in, so lots of boilerplate |
  | Fastify | Faster, with built-in schema validation, but more concepts up front |
  | Hono | Modern and lightweight, but fewer beginner resources |
  | NestJS | Powerful for large teams, but heavy (decorators, dependency injection, modules) for 7 endpoints |

- **Trade-off:** Express provides very little structure, so organising the code is up to us ([D17](#d17-five-small-files-sql-directly-in-route-handlers)).

#### D6. SQLite, using Node's built-in `node:sqlite`

- **Decision:** Store data in SQLite and access it through Node's built-in driver.
- **Why SQLite:** It's a real SQL database that keeps everything in one file (`finance.db`). There's no database server to install, start or configure, and the SQL you learn transfers directly to PostgreSQL or MySQL later.
- **Why the built-in driver:** Nothing to install. The popular alternative compiles native code during `npm install`, which is a common source of confusing install errors for beginners.
- **Why synchronous (`DatabaseSync`):** Queries on a local file take microseconds, so `async/await` brings no benefit here, and code without it is easier to read.
- **Alternatives:**

  | Option | Why not (for now) |
  |---|---|
  | PostgreSQL | Common in production, but requires installing and running a separate server (owner chose SQLite) |
  | MongoDB | Stores loose JSON documents with no enforced structure; money records are naturally a table, and SQL skills transfer further |
  | A JSON file | No queries or constraints, and data can be corrupted if two writes overlap. Not a "real backend" |
  | `better-sqlite3` | Excellent and battle-tested with an almost identical API, but needs a native build. **This is the drop-in replacement** if `node:sqlite` ever causes problems |
  | An ORM (Prisma, Drizzle) | Hides SQL behind generated code and adds a build step. Learn SQL first; an ORM makes more sense afterwards |

- **Trade-offs:**
  - SQLite allows one writer at a time. That's fine for one user, but not for a busy multi-user service.
  - Node still marks `node:sqlite` as under active development, so its API could change slightly in a future Node version.

#### D7. Run TypeScript with `tsx`; type-check with `tsc --noEmit`

- **Decision:** `npm run dev` / `npm start` use `tsx`. `npm run typecheck` uses the TypeScript compiler, `tsc`, in check-only mode.
- **Why:** `tsx` runs `.ts` files directly, so there's no build step and no compiled copy of the code to keep in sync. `tsx watch` restarts the server every time you save.
- **Important:** `tsx` *removes* types without *checking* them. That's why there is a separate `typecheck` command. Run it before you consider any change finished.
- **Alternatives:**

  | Option | Why not (for now) |
  |---|---|
  | Compile with `tsc` into a `dist/` folder, then run with Node | Extra build step and a second copy of the code to keep in sync. Standard for production deployments, but unnecessary for local development |
  | `ts-node` | Slower, and awkward to configure with ES modules |
  | Node's built-in type stripping | Works in Node 24, but requires writing `.ts` at the end of every import and forbids some TypeScript syntax |

- **Trade-off:** Type errors don't stop the server from running, so you must run the check yourself.

#### D8. TypeScript and module settings

| Setting | Value | Why |
|---|---|---|
| `"type"` in `package.json` | `"module"` | Modern `import`/`export` syntax (ES modules), the standard going forward. The older alternative is CommonJS (`require`) |
| `module` / `moduleResolution` | `ESNext` / `bundler` | Lets us write `import { db } from './db'`. The stricter `NodeNext` setting requires `'./db.js'`, which points at a `.js` file that doesn't exist and confuses beginners. Safe because `tsx` runs the code, not `tsc` |
| `noEmit` | `true` | `tsc` only checks; it never writes output files |
| `types` | `["node"]` | TypeScript 7 doesn't load Node's type definitions automatically. Without this line, `node:sqlite` is reported as unknown (verified) |
| `strict` | `true` | See [D4](#d4-typescript-in-strict-mode) |
| `skipLibCheck` | `true` | Don't type-check library code inside `node_modules`: faster, and those errors aren't ours to fix |

> **Constraint:** the `bundler` setting works because `tsx` runs the code. Compiling with `tsc` and running the output with plain Node would require `NodeNext` instead.

### 4.3 Data model

All data lives in one table, created in `src/db.ts`:

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  type        TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
  amountCents INTEGER NOT NULL CHECK (amountCents > 0),
  category    TEXT    NOT NULL,
  description TEXT    NOT NULL DEFAULT '',
  date        TEXT    NOT NULL,
  createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

| Column | Meaning | Example |
|---|---|---|
| `id` | Unique number assigned by the database | `7` |
| `type` | Money in or out | `"expense"` |
| `amountCents` | Amount in cents, always positive | `1250` (= $12.50) |
| `category` | Free-text label | `"groceries"` |
| `description` | Optional note | `"milk & eggs"` |
| `date` | When it happened (`YYYY-MM-DD`) | `"2026-11-09"` |
| `createdAt` | When it was saved, in UTC, set by the database | `"2026-11-09 13:26:12"` |

#### D9. Money stored as whole cents

- **Decision:** Amounts are integers in cents (`1250` = $12.50), and the field is named `amountCents`.
- **Why:** Computers store decimals like 0.1 only approximately. In JavaScript, `0.1 + 0.2` equals `0.30000000000000004`. Add up hundreds of transactions and totals drift by fractions of a cent. Whole numbers are always exact: `10 + 20` is `30`. Putting the unit in the field name means nobody sends `12.50` thinking it's dollars.
- **Alternatives:**

  | Option | Why not |
  |---|---|
  | Decimal numbers (`12.50`) | Rounding errors, as above |
  | A `DECIMAL` column | SQLite has no true decimal type |
  | Strings (`"12.50"`) | Exact, but every calculation needs parsing and a decimal-math library |

- **Trade-off:** Clients must convert (divide by 100 to display, multiply by 100 when sending). This assumes a single currency with two decimal places.

#### D10. A `type` field plus a positive amount, not negative expenses

- **Decision:** Every transaction has `type: "income" | "expense"` and an amount that is always positive.
- **Why:** `"type": "expense", "amountCents": 1250` is clearer than `-1250`, and you can't get the sign wrong. The database enforces `amountCents > 0`.
- **Alternative:** Signed amounts, with expenses negative. Totals become a single `SUM`, but a forgotten minus sign silently turns an expense into income.
- **Trade-off:** The summary query is slightly longer ([D20](#d20-one-pass-summary-query)).

#### D11. Dates stored as `YYYY-MM-DD` text

- **Decision:** `date` is a text column in `YYYY-MM-DD` format.
- **Why:**
  - SQLite has no dedicated date type.
  - This format sorts correctly as plain text (`"2026-10-28"` comes before `"2026-11-09"`), so `ORDER BY date` just works.
  - "Every transaction in November 2026" becomes "dates starting with `2026-11-`", a simple `LIKE '2026-11-%'`.
  - Humans can read it.
- **Default:** If no date is sent, today's date is used, based on **your computer's local time**. The common shortcut `new Date().toISOString()` uses UTC instead and can give tomorrow's date late in the evening.
- **Alternatives:** Unix timestamps (numbers that are hard to read, and a purchase rarely needs a time of day), or full date-times with time zones (more complex than needed).
- **Trade-off:** Time zones aren't tracked: `createdAt` is in UTC while `date` is local. That's acceptable for a personal tracker.

#### D12. One table, category as free text

- **Decision:** Categories are a text column, not a separate table.
- **Why:** The simplest thing that works: no joins, and no extra endpoints for managing categories.
- **Alternative:** A `categories` table linked by a *foreign key*, giving a fixed list to choose from.
- **Trade-off:** Typos create "new" categories: `Groceries` and `groceries` count separately.

#### D13. camelCase column names

- **Decision:** Columns are named like TypeScript fields (`amountCents`, `createdAt`).
- **Why:** Rows from the database already match our TypeScript types, so they can be sent to clients as they are, with no conversion code.
- **Alternative:** `snake_case` columns (`amount_cents`), the usual SQL convention, plus code that converts between the two styles.
- **Trade-off:** Unconventional for SQL, where most codebases use `snake_case`.

### 4.4 API design

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/health` | 200 `{ "status": "ok" }` | (none) |
| GET | `/transactions?month=YYYY-MM` | 200, list of transactions | 400 bad month |
| GET | `/transactions/:id` | 200, one transaction | 404 |
| POST | `/transactions` | 201, the created transaction | 400 |
| PUT | `/transactions/:id` | 200, the updated transaction | 400, 404 |
| DELETE | `/transactions/:id` | 204, no body | 404 |
| GET | `/summary?month=YYYY-MM` | 200, `{ incomeCents, expenseCents, balanceCents }` | 400 bad month |

#### D14. REST-style URLs

- **Decision:** Follow REST conventions.
- **Why:** REST is the most common style for web APIs, so what you learn here applies almost everywhere. The URL names the *thing* (`/transactions`, `/transactions/7`) and the HTTP method names the *action*: GET reads, POST creates, PUT replaces, DELETE removes. Collections use plural names by convention.
- **Alternatives:** Action-style URLs like `/createTransaction` (inconsistent, as every team invents its own names), or GraphQL (one flexible endpoint; powerful, but many new concepts).

#### D15. Precise status codes

| Code | Meaning in this API |
|---|---|
| 200 OK | Here's what you asked for |
| 201 Created | New transaction saved; the body contains it, including its new `id` |
| 204 No Content | Deleted; nothing to send back |
| 400 Bad Request | Your data or JSON is invalid. Fix it and try again |
| 404 Not Found | No such transaction, or no such route |
| 500 Internal Server Error | A bug on the server side; details are printed in the server's terminal |

- **Why:** Precise codes let clients react correctly without reading the message text. For example, a frontend can show a form error on 400 and a "not found" message on 404.

#### D16. Smaller API choices

| Choice | Why | Alternative |
|---|---|---|
| Create and update **return the saved row** | The client immediately sees the real `id`, filled-in defaults and `createdAt`, without a second request | Return only the id, or nothing |
| **PUT** replaces everything; no PATCH | Reuses exactly the same validation as create, so there's one set of rules and they can't drift apart | PATCH for partial updates, which needs a second "all fields optional" validator |
| An invalid id like `/transactions/abc` returns **404** | From the client's point of view it simply doesn't exist; keeps a single error path | 400 "invalid id": more precise, one more case to handle |
| Month filter is a **query parameter** (`?month=2026-11`) | Optional filters are what query parameters are for; one endpoint works with or without it | A separate URL such as `/transactions/month/2026-11` |
| **Separate `/summary` endpoint** | The database computes totals in one query; clients don't have to download every transaction and add them up | Let clients compute totals themselves |
| **`/health` endpoint** | Quickest answer to "is the server even running?" Standard in production APIs | Guessing from other endpoints |

### 4.5 Code structure

#### D17. Five small files, SQL directly in route handlers

- **Decision:** One file per job ([§3](#3-architecture)), with each route handler doing its whole job itself: read input, validate, run SQL, respond.
- **Why:** You can follow an entire request in one function. For 7 endpoints, extra layers would add more files than logic.
- **Alternative:** The *layered* architecture used in larger apps: **controllers** (HTTP) → **services** (business rules) → **repositories** (database). Excellent once logic is shared or complex; overhead at this size.
- **Trade-off:** All endpoints share one file. That's easy to follow at 7 endpoints, but the file gets long and logic starts repeating as more endpoints are added.

#### D18. Prepared statements with `?` placeholders

- **Decision:** Every SQL statement is created once with `db.prepare(...)` using `?` slots, then run with values.
- **Why:**
  - **Security:** User input is never glued into the SQL text, so it can't be run as a SQL command. This prevents **SQL injection**, one of the most common and serious web vulnerabilities.
  - **Efficiency:** Each statement is parsed once at startup and reused on every request.
- **Alternative:** Building SQL with template strings, e.g. `` `... WHERE id = ${id}` ``. **Never do this with user input.**

#### D19. Update and delete check `changes` instead of looking up first

- **Decision:** PUT and DELETE run their SQL directly, then check how many rows were affected.
- **Why:** `.run()` reports `changes`, the number of rows touched. `0` means no row had that id, so the route returns 404. That's one database call instead of two (look up, then modify).

#### D20. One-pass summary query

```sql
COALESCE(SUM(CASE WHEN type = 'income' THEN amountCents END), 0) AS incomeCents
```

Read it from the inside out:

1. `CASE WHEN type = 'income' THEN amountCents END`: for each row, take the amount *only if* it's income; otherwise the value is `NULL`.
2. `SUM(...)`: add those up. `SUM` skips `NULL`s, so this totals income rows only.
3. `COALESCE(..., 0)`: if there are no rows at all, `SUM` returns `NULL`, so replace that with `0`.

The expense total uses the same pattern, so both totals come from **a single scan** of the table. The balance (`income − expense`) is calculated in TypeScript, where simple arithmetic is easiest to read.

#### D21. Casting database rows through `unknown`

- **Context:** The SQLite driver returns rows typed as generic objects (`Record<string, SQLOutputValue>`). It doesn't know about our `Transaction` type, and TypeScript refused a direct cast because it couldn't prove the shapes match.
- **Decision:** `rows as unknown as Transaction[]`, which is an explicit "trust me" to the compiler. We know the shape matches because we wrote the `CREATE TABLE`.
- **Scope:** Used only where data leaves the database, in `routes.ts`.
- **Alternative:** Check every row at runtime, or use a library that generates types from the database. Safer, but more code than this app needs.
- **Trade-off:** If the table and the TypeScript type ever drift apart, the compiler won't notice. **Keep `db.ts` and `types.ts` in sync by hand.**

### 4.6 Validation and error handling

#### D22. Hand-written validation

- **Decision:** `validate.ts` checks request bodies with plain TypeScript, without a library.
- **Why:** You can see exactly how validation works: treat the body as `unknown` ("could be anything"), check each field, and only then trust it. Validation libraries automate this same idea.
- **Behaviour:**
  - Collects **all** problems and returns them together, so the client can fix everything at once instead of one error per attempt.
  - Returns a *discriminated union*, either `{ ok: true, value }` or `{ ok: false, errors }`. After checking `ok`, TypeScript knows which one you have.
  - Fills in defaults (`description` → `""`, `date` → today) and trims spaces around `category`.
- **Alternative:** [Zod](https://zod.dev): declare a schema once and get validation *and* the TypeScript type from it. Less code, but it hides the mechanics this project set out to show.
- **Trade-off:** Validation rules and TypeScript types are written separately and must be kept in sync by hand.

#### D23. Two layers of protection: validation *and* database rules

- **Decision:** Rules are enforced in `validate.ts` **and** by `CHECK` / `NOT NULL` constraints in the table.
- **Why:** `validate.ts` gives clients friendly error messages. The database constraints are a safety net: even if a future bug skips validation, the database still refuses an invalid `type` or a non-positive amount. This principle is often called *defence in depth*.

#### D24. Central error handling

- **Decision:** `server.ts` ends with two catch-all handlers.
- **404 fallback:** Any unknown route gets a JSON 404. Express's default is an HTML page, which API clients can't easily read.
- **Error handler:** Any error thrown in a route lands in one place instead of crashing the server.
  - Malformed JSON (a `SyntaxError` from `express.json()`) returns **400**, because it's the client's mistake.
  - Anything else is logged in full to the terminal for the developer. The client only sees **500 "Something went wrong"**, because internal details (file paths, SQL, stack traces) can help attackers and shouldn't leak.

### 4.7 Testing and tooling

#### D25. Manual testing for v1

- **Decision:** Verified by type-checking, a scripted sequence of curl requests, and a restart test ([§5](#5-verification)). No automated test suite yet.
- **Why:** Keeps v1 to the fewest new concepts, while still covering every endpoint and every error path.
- **Alternative:** Automated tests with **Vitest + Supertest**, which re-run every check in seconds after each change.
- **Trade-off:** Nothing catches regressions automatically; the checks have to be re-run by hand after each change.

#### D26. `requests.http` for trying the API

- **Decision:** Sample requests live in `requests.http`, run with the VS Code **REST Client** extension.
- **Why:** The file lives in the repo next to the code, each request runs with one click inside the editor, and it doubles as living documentation of the API.
- **Alternatives:** Postman or Insomnia (separate apps, often need an account, requests stored outside the repo), or only curl (great for scripts, tedious by hand; examples are in the README for those who prefer it).

#### D27. What's kept out of git

`.gitignore` excludes:

- `node_modules/`: huge, and recreated by `npm install`.
- `*.db`: **your personal financial data. Never commit it.**

---

## 5. Verification

Performed on 2026-11-09 with Node 24.19.0. **All checks passed.**

| # | Check | Expected | Result |
|---|---|---|---|
| 1 | `npm run typecheck` | No errors | ✅ |
| 2 | `GET /health` | 200 `{"status":"ok"}` | ✅ |
| 3 | POST 1 income + 2 expenses | 201 each, with a new `id`; missing description defaults to `""` | ✅ |
| 4 | `GET /transactions` | 3 rows, newest date first | ✅ |
| 5 | `GET /transactions?month=2026-11` | Only the 2 November rows | ✅ |
| 6 | `GET /summary` | income 300000, expense 5750, balance 294250 | ✅ |
| 7 | `GET /summary?month=2026-11` | income 300000, expense 1250, balance 298750 | ✅ |
| 8 | `GET /transactions/2` | 200 with that row | ✅ |
| 9 | `PUT /transactions/2` (1250 → 2000) | 200 with updated row; November expense total becomes 2000 | ✅ |
| 10 | `DELETE /transactions/2`, twice | 204, then 404 | ✅ |
| 11 | `GET /transactions/999` and `/transactions/abc` | 404 | ✅ |
| 12 | POST `{"type":"gift","amountCents":-5}` | 400 listing all 3 problems (type, amount, category) | ✅ |
| 13 | POST with date `2026-13-45` | 400 date error | ✅ |
| 14 | POST malformed JSON `{"type": "expense",}` | 400 "not valid JSON" | ✅ |
| 15 | `GET /summary?month=nov` | 400 month error | ✅ |
| 16 | `GET /nope` | 404 as JSON | ✅ |
| 17 | Stop the server, restart, `GET /transactions` | Data still there | ✅ |

The test database was deleted afterwards so the app starts empty.

---

## 6. Known limitations

Accepted for v1 and listed here so nobody is surprised.

| Limitation | Impact |
|---|---|
| No authentication | Anyone who can reach the server can read and change data; **not safe to expose to the internet** |
| Impossible dates such as `2026-02-30` are accepted; JavaScript's date parser silently rolls them over to March 2 | A typo can store a date that doesn't exist |
| `?month=2026-13` passes the format check | Returns an empty list instead of a 400 |
| Errors use two shapes: `{ "error": "..." }` (404/500) and `{ "errors": [...] }` (400) | Clients must handle both |
| Categories are free text and case-sensitive | `Groceries` and `groceries` are reported separately |
| Port `3000` and the database path are hard-coded; `finance.db` is created in whichever folder you start the server from | The server must be started from the project root |
| No pagination on the list endpoint | Fine for thousands of rows, slow for hundreds of thousands |
| No `updatedAt` column | Can't tell when a transaction was last edited |
| No automated tests | Regressions aren't caught automatically |

---

## 7. Glossary

| Term | Meaning |
|---|---|
| API | A set of URLs a program can call to read or change data |
| Endpoint / route | One URL + method the server responds to, e.g. `GET /summary` |
| HTTP method | The "verb" of a request: GET, POST, PUT, DELETE |
| JSON | The text format used for request and response bodies |
| Middleware | A function Express runs on every request before your route, e.g. `express.json()` |
| Query parameter | Optional values after `?` in a URL, e.g. `?month=2026-11` (`req.query.month`) |
| URL parameter | A value inside the path, e.g. `7` in `/transactions/7` (`req.params.id`) |
| Status code | The number in every response that says how the request went |
| Prepared statement | SQL with `?` slots, prepared once and filled with values safely |
| SQL injection | An attack where user input gets executed as SQL; prevented by prepared statements |
| Constraint | A rule the database enforces on every row, e.g. `CHECK (amountCents > 0)` |
| Foreign key | A column that points to a row in another table |
| ORM | A library that lets you use a database through objects instead of writing SQL |
| `unknown` | TypeScript's "could be anything, check before use" type |
| Type assertion (`as`) | Telling TypeScript "trust me, this value has this type." Not checked when the code runs |
| Discriminated union | A TypeScript type with several shapes, told apart by one field (here, `ok`) |
| Regression | Something that used to work and broke after a change |
