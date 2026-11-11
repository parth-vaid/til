import { Router } from 'express';
import { db } from './db';
import type { Summary, Transaction } from './types';
import { validateTransactionInput } from './validate';

export const router = Router();

// ---------------------------------------------------------------------------
// SQL statements
// The `?` placeholders are filled in by the database driver. Never build SQL
// by gluing user input into the string: that's how SQL injection happens.
// ---------------------------------------------------------------------------
const listQuery = db.prepare(
  'SELECT * FROM transactions WHERE date LIKE ? ORDER BY date DESC, id DESC',
);
const findByIdQuery = db.prepare('SELECT * FROM transactions WHERE id = ?');
const insertQuery = db.prepare(
  'INSERT INTO transactions (type, amountCents, category, description, date) VALUES (?, ?, ?, ?, ?)',
);
const updateQuery = db.prepare(
  'UPDATE transactions SET type = ?, amountCents = ?, category = ?, description = ?, date = ? WHERE id = ?',
);
const deleteQuery = db.prepare('DELETE FROM transactions WHERE id = ?');
const summaryQuery = db.prepare(`
  SELECT
    COALESCE(SUM(CASE WHEN type = 'income'  THEN amountCents END), 0) AS incomeCents,
    COALESCE(SUM(CASE WHEN type = 'expense' THEN amountCents END), 0) AS expenseCents
  FROM transactions
  WHERE date LIKE ?
`);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Turns ?month=2026-11 into the LIKE pattern '2026-11-%'.
// No month → '%', which matches every date. Bad format → null.
function monthToLikePattern(month: unknown): string | null {
  if (month === undefined) return '%';
  if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) return `${month}-%`;
  return null;
}

// URL params are always strings ("/transactions/abc"), so convert and check.
function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Look up one row by id. Returns undefined when no row has that id.
function findTransaction(id: number): Transaction | undefined {
  return findByIdQuery.get(id) as Transaction | undefined;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// List transactions, newest first. Optional: ?month=YYYY-MM
router.get('/transactions', (req, res) => {
  const pattern = monthToLikePattern(req.query.month);
  if (pattern === null) {
    res.status(400).json({ errors: ['month must look like YYYY-MM'] });
    return; // stop here, a response was already sent
  }
  // SQLite returns generic rows; we know they match Transaction because of our
  // CREATE TABLE, so we tell TypeScript to trust us (via `unknown`).
  res.json(listQuery.all(pattern) as unknown as Transaction[]);
});

// Get one transaction by id
router.get('/transactions/:id', (req, res) => {
  const id = parseId(req.params.id);
  const transaction = id === null ? undefined : findTransaction(id);
  if (!transaction) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  res.json(transaction);
});

// Create a transaction
router.post('/transactions', (req, res) => {
  const result = validateTransactionInput(req.body);
  if (!result.ok) {
    res.status(400).json({ errors: result.errors }); // 400 = "you sent bad data"
    return;
  }
  const t = result.value;
  const info = insertQuery.run(t.type, t.amountCents, t.category, t.description, t.date);
  // 201 = "created". Send back the saved row so the client sees its new id.
  res.status(201).json(findTransaction(Number(info.lastInsertRowid)));
});

// Replace a transaction (send all fields, same as when creating)
router.put('/transactions/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  const result = validateTransactionInput(req.body);
  if (!result.ok) {
    res.status(400).json({ errors: result.errors });
    return;
  }
  const t = result.value;
  const info = updateQuery.run(t.type, t.amountCents, t.category, t.description, t.date, id);
  if (info.changes === 0) {
    // The UPDATE touched 0 rows, so no transaction has that id
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  res.json(findTransaction(id));
});

// Delete a transaction
router.delete('/transactions/:id', (req, res) => {
  const id = parseId(req.params.id);
  // Bad id → skip the database and act like 0 rows were deleted
  const info = id === null ? { changes: 0 } : deleteQuery.run(id);
  if (info.changes === 0) {
    res.status(404).json({ error: 'Transaction not found' });
    return;
  }
  res.status(204).end(); // 204 = "done, nothing to send back"
});

// Totals: money in, money out, and what's left. Optional: ?month=YYYY-MM
router.get('/summary', (req, res) => {
  const pattern = monthToLikePattern(req.query.month);
  if (pattern === null) {
    res.status(400).json({ errors: ['month must look like YYYY-MM'] });
    return;
  }
  // A SUM query always returns exactly one row, so .get() (one row) is enough
  const totals = summaryQuery.get(pattern) as unknown as { incomeCents: number; expenseCents: number };
  const summary: Summary = {
    incomeCents: totals.incomeCents,
    expenseCents: totals.expenseCents,
    balanceCents: totals.incomeCents - totals.expenseCents,
  };
  res.json(summary);
});
