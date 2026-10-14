import { neon } from '@neondatabase/serverless'

let initialized = false

export function database() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada')
  return neon(process.env.DATABASE_URL)
}

export async function ensureSchema(sql) {
  if (initialized) return
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'owner',
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
      transaction_date DATE NOT NULL,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS debts (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL DEFAULT 'owner',
      name TEXT NOT NULL,
      creditor TEXT NOT NULL DEFAULT '',
      total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
      installment_count INTEGER NOT NULL CHECK (installment_count > 0),
      paid_installments INTEGER NOT NULL DEFAULT 0 CHECK (paid_installments >= 0),
      current_installment_value NUMERIC(14,2) NOT NULL CHECK (current_installment_value >= 0),
      due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS debt_payments (
      id BIGSERIAL PRIMARY KEY,
      debt_id BIGINT NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
      installments_paid INTEGER NOT NULL CHECK (installments_paid > 0),
      amount_paid NUMERIC(14,2) NOT NULL CHECK (amount_paid > 0),
      previous_installment_value NUMERIC(14,2) NOT NULL,
      next_installment_value NUMERIC(14,2) NOT NULL,
      payment_date DATE NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  initialized = true
}
