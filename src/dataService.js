import { supabase } from './supabaseClient'

const number = val => Number(val || 0)
const dateOnly = val => val ? String(val).slice(0, 10) : ''

export async function fetchFinanceData() {
  const [transRes, debtRes, payRes] = await Promise.all([
    supabase.from('transactions').select('*').is('deleted_at', null).order('transaction_date', { ascending: false }),
    supabase.from('debts').select('*').order('created_at', { ascending: false }),
    supabase.from('debt_payments').select('*').order('payment_date', { ascending: false })
  ])

  if (transRes.error) console.error('Erro transações:', transRes.error.message)
  if (debtRes.error) console.error('Erro dívidas:', debtRes.error.message)

  const payments = (payRes.data || []).map(p => ({
    id: number(p.id),
    debtId: number(p.debt_id),
    installmentsPaid: number(p.installments_paid),
    amountPaid: number(p.amount_paid),
    previousValue: number(p.previous_installment_value),
    nextValue: number(p.next_installment_value),
    date: dateOnly(p.payment_date),
    note: p.note || ''
  }))

  const transactions = (transRes.data || []).map(t => ({
    id: number(t.id),
    type: t.type,
    description: t.description,
    category: t.category,
    amount: number(t.amount),
    date: dateOnly(t.transaction_date)
  }))

  const debts = (debtRes.data || []).map(d => ({
    id: number(d.id),
    name: d.name,
    creditor: d.creditor || '',
    total: number(d.total_amount),
    installments: number(d.installment_count),
    paid: number(d.paid_installments),
    monthly: number(d.current_installment_value),
    dueDay: number(d.due_day),
    payments: payments.filter(p => p.debtId === number(d.id))
  }))

  return { transactions, debts, recurringBills: [] }
}

export async function createTransaction(payload) {
  const { error } = await supabase.from('transactions').insert([{
    type: payload.type,
    description: payload.description.trim(),
    category: payload.category || 'Geral',
    amount: number(payload.amount),
    transaction_date: payload.date || new Date().toISOString().slice(0, 10)
  }])
  if (error) throw new Error(error.message)
  return fetchFinanceData()
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', number(id))
  if (error) throw new Error(error.message)
  return fetchFinanceData()
}

export async function createDebt(payload) {
  const total = number(payload.total)
  const installments = number(payload.installments)
  const monthly = number(payload.monthly || (total / installments))
  
  const { error } = await supabase.from('debts').insert([{
    name: payload.name.trim(),
    creditor: payload.creditor?.trim() || '',
    total_amount: total,
    installment_count: installments,
    paid_installments: Math.min(number(payload.paid) || 0, installments),
    current_installment_value: monthly,
    due_day: number(payload.dueDay || 1)
  }])
  if (error) throw new Error(error.message)
  return fetchFinanceData()
}

export async function payDebt(payload) {
  // Buscar dívida atual
  const { data: debtRows, error: errFetch } = await supabase.from('debts').select('*').eq('id', number(payload.id)).single()
  if (errFetch || !debtRows) throw new Error('Dívida não encontrada')

  const remaining = number(debtRows.installment_count) - number(debtRows.paid_installments)
  const count = Math.min(number(payload.installmentsPaid || 1), remaining)
  const newPaid = Math.min(number(debtRows.installment_count), number(debtRows.paid_installments) + count)
  const nextVal = number(payload.nextValue)

  // Atualizar dívida
  const { error: errUpdate } = await supabase.from('debts').update({
    paid_installments: newPaid,
    current_installment_value: nextVal,
    updated_at: new Date().toISOString()
  }).eq('id', number(payload.id))
  if (errUpdate) throw new Error(errUpdate.message)

  // Registrar pagamento
  const { error: errPay } = await supabase.from('debt_payments').insert([{
    debt_id: number(payload.id),
    installments_paid: count,
    amount_paid: number(payload.amountPaid),
    previous_installment_value: number(debtRows.current_installment_value),
    next_installment_value: nextVal,
    payment_date: payload.date || new Date().toISOString().slice(0, 10),
    note: payload.note?.trim() || ''
  }])
  if (errPay) throw new Error(errPay.message)

  return fetchFinanceData()
}

export async function deleteDebt(id) {
  const { error } = await supabase.from('debts').delete().eq('id', number(id))
  if (error) throw new Error(error.message)
  return fetchFinanceData()
}