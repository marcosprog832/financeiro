import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ToastProvider, ConfirmProvider } from '../components/ui'
import Dashboard from '../pages/Dashboard'
import Transactions from '../pages/Transactions'
import { Debts, DebtForm, PaymentForm } from '../pages/Debts'
import MonthlyBills, { BillForm } from '../pages/MonthlyBills'
import Budgets from '../pages/Budgets'
import RecurringTx from '../pages/RecurringTx'
import Tools from '../pages/Tools'
import Notifications from '../pages/Notifications'
import { TransactionForm, BudgetForm, RecurringTxForm } from '../components/forms'

const month = '2026-10', today = '2026-10-15'
const transactions = [
  { id: 1, type: 'income', description: 'Salário', category: 'Trabalho', amount: 5800, date: '2026-10-05', deletedAt: null, sourceKey: 'rectx:1:2026-10' },
  { id: 2, type: 'expense', description: 'Mercado', category: 'Alimentação', amount: 486.7, date: '2026-10-11', deletedAt: null, sourceKey: '' },
  { id: 3, type: 'expense', description: 'Excluída', category: 'Lazer', amount: 10, date: '2026-10-12', deletedAt: 'x', sourceKey: '' },
]
const debts = [{ id: 1, name: 'Notebook', creditor: 'Cartão', total: 4800, installments: 12, paid: 5, monthly: 400, dueDay: 18, payments: [{ id: 1, installmentsPaid: 1, amountPaid: 400, date: '2026-09-18' }] }]
const bills = [{ id: 1, name: 'Aluguel', category: 'Moradia', amount: 1650, dueDay: 8, payments: [] }, { id: 2, name: 'Luz', category: 'Contas', amount: 200, dueDay: 20, payments: [{ month }] }]
const budgets = [{ id: 1, category: 'Alimentação', limit: 500 }]
const recurringTx = [{ id: 1, type: 'income', description: 'Salário', category: 'Trabalho', amount: 5800, day: 5, active: true }]
const wrap = el => renderToString(<ToastProvider><ConfirmProvider>{el}</ConfirmProvider></ToastProvider>)
const noop = () => {}

describe('renderização das páginas', () => {
  it('Dashboard', () => {
    const html = wrap(<Dashboard transactions={transactions} debts={debts} budgets={budgets} month={month} openTransaction={noop} openDebt={noop} goBudgets={noop} />)
    expect(html).toContain('Evolução'); expect(html).toContain('Atenção aos orçamentos') // 97% do limite
  })
  it('Transações', () => expect(wrap(<Transactions transactions={transactions} month={month} onDelete={noop} onRestore={noop} onPurge={noop} onEdit={noop} onAdd={noop} />)).toContain('Mercado'))
  it('Dívidas e contas', () => {
    expect(wrap(<Debts debts={debts} onPay={noop} onEdit={noop} onAdd={noop} onDelete={noop} />)).toContain('Notebook')
    const h = wrap(<MonthlyBills bills={bills} month={month} today={today} onAdd={noop} onEdit={noop} onDelete={noop} onPay={noop} onUnpay={noop} />)
    expect(h).toContain('Atrasada'); expect(h).toContain('Paga')
  })
  it('Orçamentos, fixos e dados', () => {
    expect(wrap(<Budgets budgets={budgets} transactions={transactions} month={month} onAdd={noop} onEdit={noop} onDelete={noop} />)).toContain('Alimentação')
    expect(wrap(<RecurringTx items={recurringTx} transactions={transactions} currentMonth={month} onAdd={noop} onEdit={noop} onDelete={noop} onToggle={noop} />)).toContain('Lançado este mês')
    expect(wrap(<Tools data={{ transactions, debts }} onImport={noop} />)).toContain('Backup completo')
  })
  it('Avisos por e-mail', () => {
    expect(wrap(<Notifications settings={{ name: 'Marcos', email: 'a@b.com', enabled: true, daysBefore: 1 }} onSave={noop} onTest={noop} />)).toContain('vence <strong>amanhã')
    expect(wrap(<Notifications settings={null} onSave={noop} onTest={noop} />)).toContain('ainda não existe')
  })
  it('Formulários', () => {
    expect(wrap(<TransactionForm today={today} onSave={noop} onClose={noop} />)).toContain('Salvar transação')
    expect(wrap(<TransactionForm initial={transactions[1]} today={today} onSave={noop} onClose={noop} />)).toContain('Salvar alterações')
    expect(wrap(<BudgetForm usedCategories={['Alimentação']} onSave={noop} onClose={noop} />)).toContain('Salvar orçamento')
    expect(wrap(<RecurringTxForm onSave={noop} onClose={noop} />)).toContain('Criar lançamento fixo')
    expect(wrap(<DebtForm onSave={noop} onClose={noop} />)).toContain('Salvar dívida')
    expect(wrap(<PaymentForm debt={debts[0]} today={today} onSave={noop} onClose={noop} />)).toContain('Confirmar pagamento')
    expect(wrap(<BillForm onSave={noop} onClose={noop} />)).toContain('Adicionar conta mensal')
  })
})
