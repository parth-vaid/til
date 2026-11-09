// A transaction is either money coming in or money going out.
export type TransactionType = 'income' | 'expense';

// What the client sends us when creating or updating a transaction.
export interface TransactionInput {
  type: TransactionType;
  // Money is stored as whole cents (1250 = $12.50) to avoid floating-point
  // rounding errors like 0.1 + 0.2 = 0.30000000000000004.
  amountCents: number;
  category: string;
  description: string;
  date: string; // 'YYYY-MM-DD'
}

// What a saved transaction looks like when it comes back out of the database.
export interface Transaction extends TransactionInput {
  id: number;
  createdAt: string;
}

export interface Summary {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
}
