import { describe, it, expect, vi, beforeEach } from 'vitest'

// Supabase simulado: registra chamadas e devolve tabelas vazias.
const calls = []
const builder = (table) => {
  const b = { table, ops: [] }
  const chain = new Proxy(b, { get(t, prop) {
    if (prop === 'then') return res => Promise.resolve({ data: Array.isArray(t.data) ? t.data : (t.single ? t.row : []), error: t.error || null }).then(res)
    return (...args) => { t.ops.push([prop, args]); if (prop === 'single') t.single = true; return chain }
  } })
  calls.push(b)
  return chain
}
let rpcResult = { data: null, error: null }
vi.mock('../supabaseClient', () => ({
  supabaseConfigured: true, MISSING_ENV_MESSAGE: 'faltam variáveis',
  supabase: { from: table => builder(table), rpc: (name, args) => { calls.push({ rpc: name, args }); return Promise.resolve(rpcResult) } },
}))
import { loadData, mutateData, generateRecurring } from '../dataService'

beforeEach(() => { calls.length = 0; rpcResult = { data: null, error: null } })

describe('dataService', () => {
  it('carrega as 8 tabelas', async () => {
    const d = await loadData()
    expect(calls.map(c => c.table)).toEqual(['transactions', 'debts', 'debt_payments', 'recurring_bills', 'recurring_bill_payments', 'budgets', 'recurring_transactions', 'notification_settings'])
    expect(d).toEqual({ transactions: [], debts: [], recurringBills: [], budgets: [], recurringTx: [], notifications: { name: '', email: '', enabled: false, daysBefore: 1 } })
  })
  it('pagamento de dívida usa função atômica no banco', async () => {
    await mutateData('debt.pay', { id: 3, installmentsPaid: 2, amountPaid: 800.005, nextValue: 400, date: '2026-10-15', note: ' x ' })
    const rpc = calls.find(c => c.rpc)
    expect(rpc.rpc).toBe('pay_debt')
    expect(rpc.args).toMatchObject({ p_debt_id: 3, p_count: 2, p_amount: 800.01, p_next_value: 400, p_date: '2026-10-15', p_note: 'x' })
  })
  it('conta mensal usa pay_bill / unpay_bill', async () => {
    await mutateData('bill.pay', { id: 1, month: '2026-10', date: '2026-10-08' })
    await mutateData('bill.unpay', { id: 1, month: '2026-10' })
    expect(calls.filter(c => c.rpc).map(c => c.rpc)).toEqual(['pay_bill', 'unpay_bill'])
  })
  it('valida dados antes de gravar', async () => {
    await expect(mutateData('transaction.create', { type: 'expense', description: '', amount: 5 })).rejects.toThrow('inválidos')
    await expect(mutateData('budget.save', { category: 'Lazer', limit: 0 })).rejects.toThrow('inválido')
    await expect(mutateData('nada', {})).rejects.toThrow('desconhecida')
  })
  it('gera lançamentos fixos e traduz erros', async () => {
    rpcResult = { data: 2, error: null }
    expect(await generateRecurring('2026-10-15')).toBe(2)
    rpcResult = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } }
    await expect(generateRecurring('2026-10-15')).rejects.toThrow('schema.sql')
  })
})
