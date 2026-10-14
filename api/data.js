import { database, ensureSchema } from './db.js'

const number = value => Number(value)
const dateOnly = value => typeof value === 'string' ? value.slice(0, 10) : new Date(value).toISOString().slice(0, 10)
const transactionDTO = row => ({
  id: number(row.id), type: row.type, description: row.description, category: row.category,
  amount: number(row.amount), date: dateOnly(row.transaction_date), deletedAt: row.deleted_at,
})
const debtDTO = (row, payments = []) => ({
  id: number(row.id), name: row.name, creditor: row.creditor, total: number(row.total_amount),
  installments: number(row.installment_count), paid: number(row.paid_installments),
  monthly: number(row.current_installment_value), dueDay: number(row.due_day), payments,
})
const paymentDTO = row => ({
  id: number(row.id), debtId: number(row.debt_id), installmentsPaid: number(row.installments_paid),
  amountPaid: number(row.amount_paid), previousValue: number(row.previous_installment_value),
  nextValue: number(row.next_installment_value), date: dateOnly(row.payment_date), note: row.note,
})
const billDTO = (row, payments = []) => ({
  id: number(row.id), name: row.name, category: row.category, amount: number(row.amount),
  dueDay: number(row.due_day), payments,
})
const billPaymentDTO = row => ({
  id: number(row.id), billId: number(row.bill_id), transactionId: row.transaction_id ? number(row.transaction_id) : null,
  month: row.reference_month, paidAt: row.paid_at,
})

async function readAll(sql) {
  const [transactionRows, debtRows, paymentRows, billRows, billPaymentRows] = await Promise.all([
    sql`SELECT * FROM transactions WHERE user_id = 'owner' ORDER BY transaction_date DESC, id DESC`,
    sql`SELECT * FROM debts WHERE user_id = 'owner' ORDER BY created_at DESC`,
    sql`SELECT p.* FROM debt_payments p JOIN debts d ON d.id = p.debt_id WHERE d.user_id = 'owner' ORDER BY p.payment_date DESC, p.id DESC`,
    sql`SELECT * FROM recurring_bills WHERE user_id = 'owner' ORDER BY due_day, id`,
    sql`SELECT p.* FROM recurring_bill_payments p JOIN recurring_bills b ON b.id = p.bill_id WHERE b.user_id = 'owner' ORDER BY p.paid_at DESC`,
  ])
  const payments = paymentRows.map(paymentDTO)
  const billPayments = billPaymentRows.map(billPaymentDTO)
  return {
    transactions: transactionRows.map(transactionDTO),
    debts: debtRows.map(row => debtDTO(row, payments.filter(p => p.debtId === number(row.id)))),
    recurringBills: billRows.map(row => billDTO(row, billPayments.filter(p => p.billId === number(row.id)))),
  }
}

export default async function handler(req, res) {
  try {
    const sql = database()
    await ensureSchema(sql)
    if (req.method === 'GET') return res.status(200).json(await readAll(sql))
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' })

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { action, payload = {} } = body || {}

    if (action === 'transaction.create') {
      const amount = number(payload.amount)
      if (!payload.description?.trim() || amount <= 0 || !['income','expense'].includes(payload.type)) return res.status(422).json({ error: 'Dados da transação inválidos.' })
      await sql`INSERT INTO transactions (type, description, category, amount, transaction_date) VALUES (${payload.type}, ${payload.description.trim()}, ${payload.category}, ${amount}, ${payload.date})`
      return res.status(200).json(await readAll(sql))
    }
    if (action === 'transaction.delete') {
      await sql`UPDATE transactions SET deleted_at = NOW() WHERE id = ${number(payload.id)} AND user_id = 'owner'`
      return res.status(200).json(await readAll(sql))
    }
    if (action === 'transaction.restore') {
      await sql`UPDATE transactions SET deleted_at = NULL WHERE id = ${number(payload.id)} AND user_id = 'owner'`
      return res.status(200).json(await readAll(sql))
    }
    if (action === 'debt.create') {
      const total = number(payload.total), installments = number(payload.installments)
      const monthly = number(payload.monthly || total / installments)
      if (!payload.name?.trim() || total <= 0 || installments <= 0 || monthly < 0) return res.status(422).json({ error: 'Dados da dívida inválidos.' })
      await sql`INSERT INTO debts (name, creditor, total_amount, installment_count, paid_installments, current_installment_value, due_day) VALUES (${payload.name.trim()}, ${payload.creditor?.trim() || ''}, ${total}, ${installments}, ${Math.min(number(payload.paid) || 0, installments)}, ${monthly}, ${number(payload.dueDay)})`
      return res.status(200).json(await readAll(sql))
    }
    if (action === 'debt.update') {
      const total = number(payload.total), installments = number(payload.installments)
      const paid = Math.min(number(payload.paid) || 0, installments)
      if (!payload.name?.trim() || total <= 0 || installments <= 0 || number(payload.monthly) < 0) return res.status(422).json({ error: 'Dados da dívida inválidos.' })
      await sql`UPDATE debts SET name=${payload.name.trim()}, creditor=${payload.creditor?.trim() || ''}, total_amount=${total}, installment_count=${installments}, paid_installments=${paid}, current_installment_value=${number(payload.monthly)}, due_day=${number(payload.dueDay)}, updated_at=NOW() WHERE id=${number(payload.id)} AND user_id='owner'`
      return res.status(200).json(await readAll(sql))
    }
    if (action === 'debt.delete') {
      await sql`DELETE FROM debts WHERE id=${number(payload.id)} AND user_id='owner'`
      return res.status(200).json(await readAll(sql))
    }

    if (action === 'debt.pay') {
      const rows = await sql`SELECT * FROM debts WHERE id=${number(payload.id)} AND user_id='owner' LIMIT 1`
      if (!rows.length) return res.status(404).json({ error: 'Dívida não encontrada.' })
      const debt = rows[0]
      const remaining = number(debt.installment_count) - number(debt.paid_installments)
      const count = Math.min(number(payload.installmentsPaid), remaining)
      const paidAmount = number(payload.amountPaid)
      const nextValue = number(payload.nextValue)
      if (count <= 0 || paidAmount <= 0 || nextValue < 0) return res.status(422).json({ error: 'Dados do pagamento inválidos.' })
      await sql`UPDATE debts SET paid_installments=LEAST(installment_count, paid_installments+${count}), current_installment_value=${nextValue}, updated_at=NOW() WHERE id=${number(payload.id)} AND user_id='owner'`
      await sql`INSERT INTO debt_payments (debt_id, installments_paid, amount_paid, previous_installment_value, next_installment_value, payment_date, note) VALUES (${number(payload.id)}, ${count}, ${paidAmount}, ${number(debt.current_installment_value)}, ${nextValue}, ${payload.date}, ${payload.note?.trim() || ''})`
      return res.status(200).json(await readAll(sql))
    }
    if (action === 'bill.create') {
      const amount = number(payload.amount), dueDay = number(payload.dueDay)
      if (!payload.name?.trim() || amount <= 0 || dueDay < 1 || dueDay > 31) return res.status(422).json({ error: 'Dados da conta inválidos.' })
      await sql`INSERT INTO recurring_bills (name, category, amount, due_day) VALUES (${payload.name.trim()}, ${payload.category}, ${amount}, ${dueDay})`
      return res.status(200).json(await readAll(sql))
    }
    if (action === 'bill.update') {
      const amount = number(payload.amount), dueDay = number(payload.dueDay)
      if (!payload.name?.trim() || amount <= 0 || dueDay < 1 || dueDay > 31) return res.status(422).json({ error: 'Dados da conta inválidos.' })
      await sql`UPDATE recurring_bills SET name=${payload.name.trim()}, category=${payload.category}, amount=${amount}, due_day=${dueDay}, updated_at=NOW() WHERE id=${number(payload.id)} AND user_id='owner'`
      return res.status(200).json(await readAll(sql))
    }
    if (action === 'bill.delete') {
      await sql`DELETE FROM recurring_bills WHERE id=${number(payload.id)} AND user_id='owner'`
      return res.status(200).json(await readAll(sql))
    }
    if (action === 'bill.pay') {
      if (!/^\d{4}-\d{2}$/.test(payload.month || '')) return res.status(422).json({ error: 'Mês de referência inválido.' })
      const rows = await sql`SELECT * FROM recurring_bills WHERE id=${number(payload.id)} AND user_id='owner' LIMIT 1`
      if (!rows.length) return res.status(404).json({ error: 'Conta não encontrada.' })
      const bill = rows[0], sourceKey = `recurring:${bill.id}:${payload.month}`
      const transactionRows = await sql`INSERT INTO transactions (type, description, category, amount, transaction_date, source_key) VALUES ('expense', ${bill.name}, ${bill.category}, ${number(bill.amount)}, ${payload.date}, ${sourceKey}) ON CONFLICT (source_key) DO UPDATE SET source_key=EXCLUDED.source_key RETURNING id`
      await sql`INSERT INTO recurring_bill_payments (bill_id, transaction_id, reference_month) VALUES (${number(bill.id)}, ${number(transactionRows[0].id)}, ${payload.month}) ON CONFLICT (bill_id, reference_month) DO NOTHING`
      return res.status(200).json(await readAll(sql))
    }

    return res.status(400).json({ error: 'Ação desconhecida' })
  } catch (error) {
    console.error('API error:', error.message)
    return res.status(500).json({ error: 'Não foi possível concluir a operação.' })
  }
}
