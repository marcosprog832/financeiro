import { toCents, fromCents, addMonths, monthLabel, dueDateOf } from './format'

const live = t => !t.deletedAt

export function monthTotals(transactions, ym) {
  let inc = 0, exp = 0, incomeCount = 0, expenseCount = 0
  for (const t of transactions) {
    if (!live(t) || !t.date.startsWith(ym)) continue
    const c = toCents(t.amount)
    if (t.type === 'income') { inc += c; incomeCount++ } else { exp += c; expenseCount++ }
  }
  return { income: fromCents(inc), expense: fromCents(exp), balance: fromCents(inc - exp), incomeCount, expenseCount }
}

export function overallBalance(transactions) {
  let total = 0
  for (const t of transactions) if (live(t)) total += (t.type === 'income' ? 1 : -1) * toCents(t.amount)
  return fromCents(total)
}

export const activeDebts = debts => debts.filter(d => d.paid < d.installments)
export const committedMonthly = debts => fromCents(activeDebts(debts).reduce((s, d) => s + toCents(d.monthly), 0))
export const remainingDebt = debts => fromCents(activeDebts(debts).reduce((s, d) => s + (d.installments - d.paid) * toCents(d.monthly), 0))

export function expensesByCategory(transactions, ym) {
  const acc = {}
  for (const t of transactions) {
    if (!live(t) || t.type !== 'expense' || !t.date.startsWith(ym)) continue
    acc[t.category] = (acc[t.category] || 0) + toCents(t.amount)
  }
  return Object.entries(acc).map(([k, v]) => [k, fromCents(v)]).sort((a, b) => b[1] - a[1])
}

export function monthlySeries(transactions, endYm, n = 6) {
  return Array.from({ length: n }, (_, i) => {
    const ym = addMonths(endYm, i - (n - 1))
    const { income, expense } = monthTotals(transactions, ym)
    return { ym, label: monthLabel(ym, { month: 'short' }).replace('.', ''), income, expense }
  })
}

export function billStatus(bill, ym, todayISO) {
  if ((bill.payments || []).some(p => p.month === ym)) return 'paid'
  return todayISO > dueDateOf(ym, bill.dueDay) ? 'late' : 'pending'
}

export function billPayDate(bill, ym, todayISO) {
  return todayISO.startsWith(ym) ? todayISO : dueDateOf(ym, bill.dueDay)
}

export function budgetUsage(budgets, transactions, ym) {
  const spentBy = Object.fromEntries(expensesByCategory(transactions, ym))
  return budgets.map(b => {
    const spent = spentBy[b.category] || 0
    const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0
    return { ...b, spent, pct, level: pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok' }
  }).sort((a, b) => b.pct - a.pct)
}

export function filterTransactions(list, { trash = false, type = 'all', search = '', from = '', to = '' } = {}) {
  const q = search.trim().toLowerCase()
  return list
    .filter(t => Boolean(t.deletedAt) === trash)
    .filter(t => type === 'all' || t.type === type)
    .filter(t => !q || `${t.description} ${t.category}`.toLowerCase().includes(q))
    .filter(t => (!from || t.date >= from) && (!to || t.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
}
