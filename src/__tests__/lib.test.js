import { describe, it, expect } from 'vitest'
import { toCents, round2, addMonths, dueDateOf } from '../lib/format'
import { monthTotals, overallBalance, billStatus, billPayDate, budgetUsage, monthlySeries, filterTransactions, remainingDebt } from '../lib/finance'
import { parseTransactionsCSV, transactionsToCSV, parseCSV } from '../lib/csv'

const tx = (id, type, amount, date, extra = {}) => ({ id, type, amount, date, category: 'Alimentação', description: 'x', deletedAt: null, ...extra })

describe('dinheiro em centavos', () => {
  it('não tem erro de ponto flutuante', () => {
    expect(toCents(0.1) + toCents(0.2)).toBe(30)
    expect(round2(1.005 + 1.005)).toBe(2.01)
    expect(toCents('12,50')).toBe(1250)
  })
})

describe('datas', () => {
  it('soma meses e ajusta vencimento no fim do mês', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12')
    expect(addMonths('2026-11', 3)).toBe('2027-02')
    expect(dueDateOf('2026-02', 31)).toBe('2026-02-28')
  })
})

describe('finanças', () => {
  const list = [tx(1, 'income', 100.1, '2026-10-05'), tx(2, 'expense', 50.05, '2026-10-06'), tx(3, 'expense', 10, '2026-09-01'), tx(4, 'expense', 99, '2026-10-07', { deletedAt: 'x' })]
  it('totais do mês ignoram excluídas', () => {
    const t = monthTotals(list, '2026-10')
    expect(t).toMatchObject({ income: 100.1, expense: 50.05, balance: 50.05, incomeCount: 1, expenseCount: 1 })
    expect(overallBalance(list)).toBe(40.05)
  })
  it('série mensal', () => {
    const s = monthlySeries(list, '2026-10', 3)
    expect(s.map(x => x.ym)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(s[1].expense).toBe(10)
  })
  it('status de conta por mês', () => {
    const bill = { dueDay: 10, payments: [{ month: '2026-09' }] }
    expect(billStatus(bill, '2026-09', '2026-10-15')).toBe('paid')
    expect(billStatus(bill, '2026-08', '2026-10-15')).toBe('late')
    expect(billStatus(bill, '2026-10', '2026-10-15')).toBe('late')
    expect(billStatus(bill, '2026-10', '2026-10-10')).toBe('pending')
    expect(billStatus(bill, '2026-12', '2026-10-15')).toBe('pending')
    expect(billPayDate(bill, '2026-10', '2026-10-15')).toBe('2026-10-15')
    expect(billPayDate(bill, '2026-08', '2026-10-15')).toBe('2026-08-10')
  })
  it('orçamento por categoria', () => {
    const u = budgetUsage([{ id: 1, category: 'Alimentação', limit: 100 }, { id: 2, category: 'Lazer', limit: 50 }], [tx(1, 'expense', 85, '2026-10-02'), tx(2, 'expense', 60, '2026-10-02', { category: 'Lazer' })], '2026-10')
    expect(u.find(b => b.category === 'Alimentação').level).toBe('warn')
    expect(u.find(b => b.category === 'Lazer').level).toBe('over')
  })
  it('filtros e dívida restante', () => {
    expect(filterTransactions(list, { type: 'expense', from: '2026-10-01', to: '2026-10-31' }).map(t => t.id)).toEqual([2])
    expect(filterTransactions(list, { trash: true }).map(t => t.id)).toEqual([4])
    expect(remainingDebt([{ paid: 5, installments: 12, monthly: 400.5 }])).toBe(2803.5)
  })
})

describe('csv', () => {
  it('exporta e importa de volta', () => {
    const csv = transactionsToCSV([tx(1, 'expense', 12.5, '2026-10-05', { description: 'Pão; "bom"' })])
    const { valid, errors } = parseTransactionsCSV(csv)
    expect(errors).toEqual([])
    expect(valid[0]).toMatchObject({ type: 'expense', amount: 12.5, date: '2026-10-05', description: 'Pão; "bom"' })
  })
  it('aceita data brasileira, valor com vírgula e reporta erros', () => {
    const { valid, errors } = parseTransactionsCSV('Tipo;Descrição;Valor;Data\nReceita;Salário;"1.234,56";05/10/2026\nxx;a;1;2026-10-01')
    expect(valid[0]).toMatchObject({ type: 'income', amount: 1234.56, date: '2026-10-05', category: 'Outros' })
    expect(errors).toHaveLength(1)
    expect(parseCSV('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
})
