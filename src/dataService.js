const LOCAL_KEY = 'fluxo-db-preview'
export const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname)

const saveLocal = data => {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
  return data
}

export async function loadData(seed) {
  if (isLocalPreview) {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY))
      return saved ? { ...seed, ...saved, recurringBills: saved.recurringBills || seed.recurringBills || [] } : saveLocal(seed)
    }
    catch { return saveLocal(seed) }
  }
  const response = await fetch('/api/data')
  if (!response.ok) throw new Error('Banco indisponível')
  return response.json()
}

export async function mutateData(action, payload, current) {
  if (!isLocalPreview) {
    const response = await fetch('/api/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || 'Operação não concluída')
    return data
  }

  const data = structuredClone(current)
  if (action === 'transaction.create') data.transactions.unshift(payload)
  if (action === 'transaction.delete') data.transactions = data.transactions.map(t => t.id === payload.id ? { ...t, deletedAt: new Date().toISOString() } : t)
  if (action === 'transaction.restore') data.transactions = data.transactions.map(t => t.id === payload.id ? { ...t, deletedAt: null } : t)
  if (action === 'debt.create') data.debts.unshift({ ...payload, payments: [] })
  if (action === 'debt.update') data.debts = data.debts.map(d => d.id === payload.id ? { ...d, ...payload } : d)
  if (action === 'debt.delete') data.debts = data.debts.filter(d => d.id !== payload.id)
  if (action === 'debt.pay') data.debts = data.debts.map(d => {
    if (d.id !== payload.id) return d
    const count = Math.min(payload.installmentsPaid, d.installments - d.paid)
    const payment = { id: Date.now(), debtId: d.id, installmentsPaid: count, amountPaid: payload.amountPaid, previousValue: d.monthly, nextValue: payload.nextValue, date: payload.date, note: payload.note }
    return { ...d, paid: d.paid + count, monthly: payload.nextValue, payments: [payment, ...(d.payments || [])] }
  })
  if (action === 'bill.create') data.recurringBills.unshift({ ...payload, payments: [] })
  if (action === 'bill.update') data.recurringBills = data.recurringBills.map(b => b.id === payload.id ? { ...b, ...payload } : b)
  if (action === 'bill.delete') data.recurringBills = data.recurringBills.filter(b => b.id !== payload.id)
  if (action === 'bill.pay') {
    const bill = data.recurringBills.find(b => b.id === payload.id)
    const alreadyPaid = bill?.payments?.some(p => p.month === payload.month)
    if (bill && !alreadyPaid) {
      const transactionId = Date.now()
      data.transactions.unshift({ id: transactionId, type: 'expense', description: bill.name, category: bill.category, amount: bill.amount, date: payload.date })
      data.recurringBills = data.recurringBills.map(b => b.id === payload.id ? { ...b, payments: [{ id: transactionId + 1, billId: b.id, transactionId, month: payload.month, paidAt: new Date().toISOString() }, ...(b.payments || [])] } : b)
    }
  }
  return saveLocal(data)
}
