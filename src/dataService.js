import { supabase, supabaseConfigured, MISSING_ENV_MESSAGE } from './supabaseClient'
import { round2 } from './lib/format'

export const isLocalPreview = false

const num = v => Number(v ?? 0)
const dateOnly = v => (v ? String(v).slice(0, 10) : '')
const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Traduz erros do Supabase para mensagens que ajudam a achar o problema.
function explain(error) {
  const msg = error?.message || String(error)
  const raw = ` (${error?.code ? error.code + ': ' : ''}${msg})`
  if (/Failed to fetch|NetworkError|fetch failed/i.test(msg))
    return 'Sem conexão com o Supabase. Verifique a URL do projeto, a internet e se o projeto não está pausado.'
  if (/Invalid API key|JWT|apikey/i.test(msg))
    return 'Chave do Supabase inválida. Confira VITE_SUPABASE_ANON_KEY (use a chave "anon public").'
  if (error?.code === '42703' || /column .* does not exist/i.test(msg))
    return 'Falta uma coluna no banco. Rode novamente o supabase/schema.sql (ele adiciona as colunas que faltam).' + raw
  if (error?.code === 'PGRST202' || /Could not find the function/i.test(msg))
    return 'Função do banco não encontrada. Rode novamente o supabase/schema.sql (versão 2) no SQL Editor.' + raw
  if (error?.code === '42P01' || error?.code === 'PGRST205' || /relation "[^"]*" does not exist|Could not find the table/i.test(msg))
    return 'Tabela não encontrada. Rode o arquivo supabase/schema.sql no SQL Editor do Supabase.' + raw
  if (error?.code === '42501' || /row-level security|permission denied/i.test(msg))
    return 'O Supabase bloqueou o acesso (RLS). Rode o supabase/schema.sql para criar as políticas.' + raw
  return msg
}

async function run(query) {
  if (!supabaseConfigured) throw new Error(MISSING_ENV_MESSAGE)
  const { data, error } = await query
  if (error) throw new Error(explain(error))
  return data
}

export async function loadData() {
  const [tRows, dRows, pRows, bRows, bpRows, budRows, rtRows, nRows] = await Promise.all([
    run(supabase.from('transactions').select('*').order('transaction_date', { ascending: false }).order('id', { ascending: false })),
    run(supabase.from('debts').select('*').order('created_at', { ascending: false })),
    run(supabase.from('debt_payments').select('*').order('payment_date', { ascending: false }).order('id', { ascending: false })),
    run(supabase.from('recurring_bills').select('*').order('due_day').order('id')),
    run(supabase.from('recurring_bill_payments').select('*').order('paid_at', { ascending: false })),
    run(supabase.from('budgets').select('*').order('category')),
    run(supabase.from('recurring_transactions').select('*').order('day').order('id')),
    // se a tabela de avisos ainda não existe, o resto do app continua funcionando
    run(supabase.from('notification_settings').select('*').limit(1)).catch(() => null),
  ])

  const payments = pRows.map(p => ({
    id: num(p.id), debtId: num(p.debt_id), installmentsPaid: num(p.installments_paid),
    amountPaid: num(p.amount_paid), previousValue: num(p.previous_installment_value),
    nextValue: num(p.next_installment_value), date: dateOnly(p.payment_date), note: p.note || '',
  }))
  const billPayments = bpRows.map(p => ({
    id: num(p.id), billId: num(p.bill_id), transactionId: p.transaction_id ? num(p.transaction_id) : null,
    month: p.reference_month, paidAt: p.paid_at,
  }))

  return {
    transactions: tRows.map(t => ({
      id: num(t.id), type: t.type, description: t.description, category: t.category,
      amount: num(t.amount), date: dateOnly(t.transaction_date), deletedAt: t.deleted_at, sourceKey: t.source_key || '',
    })),
    debts: dRows.map(d => ({
      id: num(d.id), name: d.name, creditor: d.creditor || '', total: num(d.total_amount),
      installments: num(d.installment_count), paid: num(d.paid_installments),
      monthly: num(d.current_installment_value), dueDay: num(d.due_day),
      payments: payments.filter(p => p.debtId === num(d.id)),
    })),
    recurringBills: bRows.map(b => ({
      id: num(b.id), name: b.name, category: b.category, amount: num(b.amount), dueDay: num(b.due_day),
      payments: billPayments.filter(p => p.billId === num(b.id)),
    })),
    notifications: nRows === null ? null : (nRows[0] ? {
      name: nRows[0].name || '', email: nRows[0].email || '', enabled: Boolean(nRows[0].enabled), daysBefore: num(nRows[0].days_before),
    } : { name: '', email: '', enabled: false, daysBefore: 1 }),
    budgets: budRows.map(b => ({ id: num(b.id), category: b.category, limit: num(b.limit_amount) })),
    recurringTx: rtRows.map(r => ({
      id: num(r.id), type: r.type, description: r.description, category: r.category,
      amount: num(r.amount), day: num(r.day), active: Boolean(r.active),
    })),
  }
}

const actions = {
  'transaction.create': async p => {
    const amount = round2(p.amount)
    if (!p.description?.trim() || amount <= 0 || !['income', 'expense'].includes(p.type)) throw new Error('Dados da transação inválidos.')
    await run(supabase.from('transactions').insert({
      type: p.type, description: p.description.trim(), category: p.category || 'Outros',
      amount, transaction_date: p.date || todayISO(),
    }))
  },
  'transaction.delete': p => run(supabase.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', num(p.id))),
  'transaction.restore': p => run(supabase.from('transactions').update({ deleted_at: null }).eq('id', num(p.id))),

  'debt.create': async p => {
    const total = round2(p.total), installments = num(p.installments)
    const monthly = round2(p.monthly || total / installments)
    if (!p.name?.trim() || total <= 0 || installments <= 0 || monthly < 0) throw new Error('Dados da dívida inválidos.')
    await run(supabase.from('debts').insert({
      name: p.name.trim(), creditor: p.creditor?.trim() || '', total_amount: total, installment_count: installments,
      paid_installments: Math.min(num(p.paid), installments), current_installment_value: monthly, due_day: num(p.dueDay) || 1,
    }))
  },
  'debt.update': async p => {
    const total = round2(p.total), installments = num(p.installments)
    if (!p.name?.trim() || total <= 0 || installments <= 0 || num(p.monthly) < 0) throw new Error('Dados da dívida inválidos.')
    await run(supabase.from('debts').update({
      name: p.name.trim(), creditor: p.creditor?.trim() || '', total_amount: total, installment_count: installments,
      paid_installments: Math.min(num(p.paid), installments), current_installment_value: round2(p.monthly),
      due_day: num(p.dueDay) || 1, updated_at: new Date().toISOString(),
    }).eq('id', num(p.id)))
  },
  'debt.delete': p => run(supabase.from('debts').delete().eq('id', num(p.id))),
  'debt.pay': async p => {
    await run(supabase.rpc('pay_debt', {
      p_debt_id: num(p.id), p_count: num(p.installmentsPaid), p_amount: round2(p.amountPaid),
      p_next_value: round2(p.nextValue), p_date: p.date || todayISO(), p_note: p.note?.trim() || '',
    }))
  },

  'bill.create': async p => {
    const amount = round2(p.amount), dueDay = num(p.dueDay)
    if (!p.name?.trim() || amount <= 0 || dueDay < 1 || dueDay > 31) throw new Error('Dados da conta inválidos.')
    await run(supabase.from('recurring_bills').insert({ name: p.name.trim(), category: p.category, amount, due_day: dueDay }))
  },
  'bill.update': async p => {
    const amount = round2(p.amount), dueDay = num(p.dueDay)
    if (!p.name?.trim() || amount <= 0 || dueDay < 1 || dueDay > 31) throw new Error('Dados da conta inválidos.')
    await run(supabase.from('recurring_bills').update({
      name: p.name.trim(), category: p.category, amount, due_day: dueDay, updated_at: new Date().toISOString(),
    }).eq('id', num(p.id)))
  },
  'bill.delete': p => run(supabase.from('recurring_bills').delete().eq('id', num(p.id))),
  'bill.pay': p => run(supabase.rpc('pay_bill', { p_bill_id: num(p.id), p_month: p.month, p_date: p.date || todayISO() })),
  'bill.unpay': p => run(supabase.rpc('unpay_bill', { p_bill_id: num(p.id), p_month: p.month })),

  'transaction.update': async p => {
    const amount = round2(p.amount)
    if (!p.description?.trim() || amount <= 0 || !['income', 'expense'].includes(p.type)) throw new Error('Dados da transação inválidos.')
    await run(supabase.from('transactions').update({
      type: p.type, description: p.description.trim(), category: p.category || 'Outros', amount, transaction_date: p.date,
    }).eq('id', num(p.id)))
  },
  'transaction.purge': p => run(supabase.from('transactions').delete().eq('id', num(p.id)).not('deleted_at', 'is', null)),
  'transactions.import': async p => {
    const rows = (p.rows || []).map(r => ({ type: r.type, description: r.description, category: r.category || 'Outros', amount: round2(r.amount), transaction_date: r.date }))
    for (let i = 0; i < rows.length; i += 200) await run(supabase.from('transactions').insert(rows.slice(i, i + 200)))
  },

  'budget.save': async p => {
    const limit = round2(p.limit)
    if (!p.category || limit <= 0) throw new Error('Orçamento inválido.')
    await run(supabase.from('budgets').upsert({ user_id: 'owner', category: p.category, limit_amount: limit }, { onConflict: 'user_id,category' }))
  },
  'budget.delete': p => run(supabase.from('budgets').delete().eq('id', num(p.id))),

  'rectx.save': async p => {
    const amount = round2(p.amount), day = num(p.day)
    if (!p.description?.trim() || amount <= 0 || day < 1 || day > 31 || !['income', 'expense'].includes(p.type)) throw new Error('Lançamento fixo inválido.')
    const row = { type: p.type, description: p.description.trim(), category: p.category || 'Outros', amount, day, active: p.active !== false }
    await run(p.id ? supabase.from('recurring_transactions').update(row).eq('id', num(p.id)) : supabase.from('recurring_transactions').insert(row))
  },
  'notify.save': async p => {
    const email = (p.email || '').trim()
    if (p.enabled && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Informe um e-mail válido para ativar os avisos.')
    await run(supabase.from('notification_settings').upsert({
      user_id: 'owner', name: (p.name || '').trim(), email, enabled: Boolean(p.enabled),
      days_before: Math.min(7, Math.max(0, num(p.daysBefore))), updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' }))
  },
  'rectx.delete': p => run(supabase.from('recurring_transactions').delete().eq('id', num(p.id))),
}

export async function mutateData(action, payload = {}) {
  const handler = actions[action]
  if (!handler) throw new Error(`Ação desconhecida: ${action}`)
  await handler(payload)
  return loadData()
}

// Lança as transações fixas do mês atual (idempotente). Retorna quantas foram criadas.
export async function generateRecurring(todayStr) {
  const n = await run(supabase.rpc('generate_recurring', { p_month: todayStr.slice(0, 7), p_today: todayStr }))
  return Number(n) || 0
}

// Pede ao servidor (Vercel) para mandar um e-mail de teste para o endereço salvo.
export async function sendTestEmail() {
  let res
  try { res = await fetch('/api/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ test: true }) }) }
  catch { throw new Error('Não consegui falar com o servidor.') }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Falha ao enviar (${res.status}). O teste só funciona no site publicado na Vercel.`)
  return body
}
