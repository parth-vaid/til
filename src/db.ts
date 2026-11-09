import { DatabaseSync } from 'node:sqlite';

// Opens (or creates) a file called finance.db in the folder you start the server from.
// Everything you save lives in this file, so it survives server restarts.
export const db = new DatabaseSync('finance.db');

// Create the table the first time the app runs. "IF NOT EXISTS" makes this
// safe to run on every startup.
// The CHECK rules are a second safety net: even if our validation had a bug,
// the database itself refuses bad data.
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL CHECK (type IN ('income', 'expense')),
    amountCents INTEGER NOT NULL CHECK (amountCents > 0),
    category    TEXT    NOT NULL,
    description TEXT    NOT NULL DEFAULT '',
    date        TEXT    NOT NULL,
    createdAt   TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`);
