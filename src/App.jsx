import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, Landmark, Moon, Sun, Menu, CircleDollarSign, Database,
  LoaderCircle, AlertCircle, Target, Repeat, Archive, RefreshCw, BellRing,
} from 'lucide-react'
import { isLocalPreview, loadData, mutateData, generateRecurring, sendTestEmail } from './dataService'
import { supabase } from './supabaseClient'
import { ToastProvider, ConfirmProvider, Modal, MonthPicker, useToast } from './components/ui'
import { TransactionForm, BudgetForm, RecurringTxForm } from './components/forms'
import useToday from './hooks/useToday'
import { addMonths } from './lib/format'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import { Debts, DebtForm, PaymentForm } from './pages/Debts'
import MonthlyBills, { BillForm } from './pages/MonthlyBills'
import Budgets from './pages/Budgets'
import RecurringTx from './pages/RecurringTx'
import Tools from './pages/Tools'
import Notifications from './pages/Notifications'

const EMPTY = { transactions: [], debts: [], recurringBills: [], budgets: [], recurringTx: [], notifications: null }

// Atualiza a tela na hora (antes do banco responder). Se falhar, volta ao estado anterior.
const optimistic = {
  'transaction.delete': (d, p) => ({ ...d, transactions: d.transactions.map(t => t.id === p.id ? { ...t, deletedAt: new Date().toISOString() } : t) }),
  'transaction.restore': (d, p) => ({ ...d, transactions: d.transactions.map(t => t.id === p.id ? { ...t, deletedAt: null } : t) }),
  'transaction.purge': (d, p) => ({ ...d, transactions: d.transactions.filter(t => t.id !== p.id) }),
  'debt.delete': (d, p) => ({ ...d, debts: d.debts.filter(x => x.id !== p.id) }),
  'bill.delete': (d, p) => ({ ...d, recurringBills: d.recurringBills.filter(x => x.id !== p.id) }),
  'budget.delete': (d, p) => ({ ...d, budgets: d.budgets.filter(x => x.id !== p.id) }),
  'rectx.delete': (d, p) => ({ ...d, recurringTx: d.recurringTx.filter(x => x.id !== p.id) }),
}

function useStoredState(key, initial) {
  const [state, setState] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : initial }
    catch { return initial }
  })
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(state)) } catch { /* ignora */ } }, [key, state])
  return [state, setState]
}

const NAV = [
  ['dashboard', 'Visão geral', LayoutDashboard], ['transactions', 'Transações', ArrowLeftRight],
  ['debts', 'Dívidas & contas', Landmark], ['budgets', 'Orçamentos', Target],
  ['recurring', 'Lançamentos fixos', Repeat], ['notifications', 'Avisos por e-mail', BellRing], ['tools', 'Dados & backup', Archive],
]
const WITH_MONTH = ['dashboard', 'transactions', 'debts', 'budgets']

function Fluxo() {
  const { push } = useToast()
  const today = useToday()
  const currentMonth = today.slice(0, 7)
  const [data, setData] = useState(EMPTY)
  const [theme, setTheme] = useStoredState('fluxo-theme', 'light')
  const [page, setPage] = useState('dashboard')
  const [month, setMonth] = useState(currentMonth)
  const [modal, setModal] = useState(null)
  const [mobile, setMobile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const dataRef = useRef(data)
  dataRef.current = data

  useEffect(() => { document.documentElement.classList.toggle('dark', theme === 'dark') }, [theme])

  const refresh = useCallback(async () => {
    setLoading(true); setError('')
    try { setData(await loadData()); setReady(true) }
    catch (e) { setError(`Não foi possível conectar ao banco de dados. ${e.message}`) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { refresh() }, [refresh])

  // Lança os fixos do mês (salário etc.) quando o dia chega — uma vez por mês, sem duplicar.
  useEffect(() => {
    if (!ready) return
    generateRecurring(today).then(async n => {
      if (n > 0) { setData(await loadData()); push(`${n} lançamento(s) fixo(s) adicionado(s) automaticamente.`) }
    }).catch(e => push(`Lançamentos fixos indisponíveis: ${e.message}`, { type: 'error' }))
  }, [ready, today, push])

  // Tempo real: se mudar em outro aparelho, atualiza aqui.
  useEffect(() => {
    if (!supabase) return
    let timer
    const channel = supabase.channel('fluxo-sync')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        clearTimeout(timer); timer = setTimeout(() => loadData().then(setData).catch(() => {}), 700)
      }).subscribe()
    return () => { clearTimeout(timer); supabase.removeChannel(channel) }
  }, [])

  const act = useCallback(async (action, payload, success) => {
    const previous = dataRef.current
    if (optimistic[action]) setData(optimistic[action](previous, payload))
    try {
      setData(await mutateData(action, payload))
      if (success) push(success)
      return true
    } catch (e) {
      setData(previous); push(e.message, { type: 'error' })
      return false
    }
  }, [push])

  const { transactions, debts, recurringBills, budgets, recurringTx, notifications } = data
  const testEmail = async () => {
    try { const r = await sendTestEmail(); push(`E-mail de teste enviado para ${r.to}.`) }
    catch (e) { push(e.message, { type: 'error' }) }
  }
  const go = id => { setPage(id); setMobile(false); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const saveTransaction = t => act(t.id ? 'transaction.update' : 'transaction.create', t, t.id ? 'Transação atualizada.' : 'Transação adicionada.')
  const deleteTransaction = async t => {
    if (await act('transaction.delete', { id: t.id }))
      push('Transação excluída.', { action: { label: 'Desfazer', onClick: () => act('transaction.restore', { id: t.id }, 'Transação restaurada.') } })
  }

  return <div className={theme === 'dark' ? 'dark' : ''}>
    <div className="app-shell flex">
      {mobile && <button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-[#07101d]/50 lg:hidden" onClick={() => setMobile(false)} />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col bg-[#111d2f] p-6 text-white transition-transform lg:translate-x-0 ${mobile ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-10 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#b9e65f] text-[#111d2f]"><CircleDollarSign size={23} /></span><div><p className="display text-xl font-bold leading-none">fluxo.</p><p className="mt-1 text-[10px] uppercase tracking-[.18em] text-slate-400">finanças pessoais</p></div></div>
        <nav className="space-y-2">{NAV.map(([id, label, Icon]) => <button key={id} onClick={() => go(id)} className={`nav-item flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-300 ${page === id ? 'nav-active' : ''}`}><Icon size={18} />{label}</button>)}</nav>
        <div className="mt-auto rounded-[22px] border border-white/10 bg-white/[.04] p-4"><p className="mb-1 flex items-center gap-2 text-xs font-bold text-[#b9e65f]"><Database size={14} />{isLocalPreview ? 'Prévia local' : 'Supabase conectado'}</p><p className="text-[11px] leading-relaxed text-slate-400">Alterações salvas no banco de dados.</p></div>
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4"><div><p className="text-sm font-bold">Minha conta</p><p className="text-[11px] text-slate-400">Controle pessoal</p></div><button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" aria-label="Alternar tema">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-[270px]">
        <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/5 bg-[#f3f0e8]/80 px-4 backdrop-blur-xl dark:border-white/5 dark:bg-[#0d1522]/80 lg:hidden"><button className="btn-ghost p-2" onClick={() => setMobile(true)} aria-label="Abrir menu"><Menu size={20} /></button><span className="display font-bold">fluxo.</span><button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} className="btn-ghost p-2" aria-label="Alternar tema">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</button></div>
        <div className="mx-auto max-w-[1440px] p-4 pb-16 sm:p-6 md:p-8 xl:p-12">
          {!isLocalPreview && <div className="mb-5 flex items-center gap-2 rounded-2xl border border-amber-400/40 bg-amber-100 p-4 text-sm font-bold text-amber-900"><AlertCircle size={18} /> Acesso ainda sem login. Não cadastre dados reais até ativarmos a autenticação.</div>}
          {loading && <div className="mb-5 flex items-center gap-2 rounded-2xl bg-[#d9e7ff] p-4 text-sm font-bold text-[#19365e]"><LoaderCircle className="animate-spin" size={18} /> Carregando seus dados...</div>}
          {error && <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[#ffd8cd] p-4 text-sm font-bold text-[#7d2c1c]"><AlertCircle size={18} className="shrink-0" /><span className="flex-1">{error}</span><button className="btn-ghost shrink-0 text-xs" onClick={refresh}><RefreshCw size={14} /> Tentar de novo</button></div>}

          {WITH_MONTH.includes(page) && <div className="mb-6 flex justify-end"><MonthPicker month={month} currentMonth={currentMonth} onChange={setMonth} shift={addMonths} /></div>}

          {page === 'dashboard' && <Dashboard transactions={transactions} debts={debts} budgets={budgets} month={month} openTransaction={() => setModal('transaction')} openDebt={() => setModal('debt')} goBudgets={() => go('budgets')} />}
          {page === 'transactions' && <Transactions transactions={transactions} month={month} onDelete={deleteTransaction} onRestore={id => act('transaction.restore', { id }, 'Transação restaurada.')} onPurge={id => act('transaction.purge', { id }, 'Transação excluída definitivamente.')} onEdit={tx => setModal({ type: 'editTx', tx })} onAdd={() => setModal('transaction')} />}
          {page === 'debts' && <div className="space-y-8">
            <Debts debts={debts} onPay={debt => setModal({ type: 'payment', debt })} onEdit={debt => setModal({ type: 'editDebt', debt })} onAdd={() => setModal('debt')} onDelete={id => act('debt.delete', { id }, 'Dívida excluída.')} />
            <MonthlyBills bills={recurringBills} month={month} today={today} onAdd={() => setModal('bill')} onEdit={bill => setModal({ type: 'editBill', bill })} onDelete={id => act('bill.delete', { id }, 'Conta excluída.')} onPay={p => act('bill.pay', p, 'Conta marcada como paga e lançada em Transações.')} onUnpay={p => act('bill.unpay', p, 'Pagamento desfeito.')} />
          </div>}
          {page === 'budgets' && <Budgets budgets={budgets} transactions={transactions} month={month} onAdd={category => setModal({ type: 'budget', category })} onEdit={b => setModal({ type: 'budget', initial: b })} onDelete={id => act('budget.delete', { id }, 'Orçamento excluído.')} />}
          {page === 'recurring' && <RecurringTx items={recurringTx} transactions={transactions} currentMonth={currentMonth} onAdd={() => setModal('rectx')} onEdit={item => setModal({ type: 'editRectx', item })} onDelete={id => act('rectx.delete', { id }, 'Lançamento fixo excluído.')} onToggle={r => act('rectx.save', { ...r, active: !r.active }, r.active ? 'Lançamento pausado.' : 'Lançamento ativado.')} />}
          {page === 'notifications' && <Notifications settings={notifications} onSave={s => act('notify.save', s, 'Preferências de aviso salvas.')} onTest={testEmail} />}
          {page === 'tools' && <Tools data={data} onImport={rows => act('transactions.import', { rows }, `${rows.length} transações importadas.`)} />}
        </div>
      </main>

      {modal === 'transaction' && <Modal title="Nova transação" subtitle="Registre uma entrada ou saída." onClose={() => setModal(null)}><TransactionForm today={today} onSave={saveTransaction} onClose={() => setModal(null)} /></Modal>}
      {modal?.type === 'editTx' && <Modal title="Editar transação" subtitle="Corrija qualquer informação." onClose={() => setModal(null)}><TransactionForm initial={modal.tx} today={today} onSave={saveTransaction} onClose={() => setModal(null)} /></Modal>}
      {modal === 'debt' && <Modal title="Nova dívida" subtitle="Cadastre o parcelamento e acompanhe o progresso." onClose={() => setModal(null)}><DebtForm onSave={d => act('debt.create', d, 'Dívida cadastrada.')} onClose={() => setModal(null)} /></Modal>}
      {modal?.type === 'editDebt' && <Modal title="Editar dívida" subtitle="Todos os dados podem ser corrigidos." onClose={() => setModal(null)}><DebtForm initial={modal.debt} onSave={d => act('debt.update', d, 'Dívida atualizada.')} onClose={() => setModal(null)} /></Modal>}
      {modal?.type === 'payment' && <Modal title="Registrar pagamento" subtitle="Quite uma ou várias parcelas. O valor também entra como despesa em Transações." onClose={() => setModal(null)}><PaymentForm debt={modal.debt} today={today} onSave={p => act('debt.pay', p, 'Pagamento registrado e lançado em Transações.')} onClose={() => setModal(null)} /></Modal>}
      {modal === 'bill' && <Modal title="Nova conta mensal" subtitle="Ela aparecerá automaticamente todos os meses." onClose={() => setModal(null)}><BillForm onSave={bill => act('bill.create', bill, 'Conta mensal adicionada.')} onClose={() => setModal(null)} /></Modal>}
      {modal?.type === 'editBill' && <Modal title="Editar conta mensal" subtitle="As alterações valerão para os próximos pagamentos." onClose={() => setModal(null)}><BillForm initial={modal.bill} onSave={bill => act('bill.update', bill, 'Conta atualizada.')} onClose={() => setModal(null)} /></Modal>}
      {modal?.type === 'budget' && <Modal title={modal.initial ? 'Editar orçamento' : 'Novo orçamento'} subtitle="Defina o limite mensal da categoria." onClose={() => setModal(null)}><BudgetForm initial={modal.initial || (modal.category ? { category: modal.category, limit: '' } : undefined)} usedCategories={budgets.map(b => b.category)} onSave={b => act('budget.save', b, 'Orçamento salvo.')} onClose={() => setModal(null)} /></Modal>}
      {modal === 'rectx' && <Modal title="Novo lançamento fixo" subtitle="Entra sozinho em Transações todo mês." onClose={() => setModal(null)}><RecurringTxForm onSave={r => act('rectx.save', r, 'Lançamento fixo salvo.')} onClose={() => setModal(null)} /></Modal>}
      {modal?.type === 'editRectx' && <Modal title="Editar lançamento fixo" subtitle="As mudanças valem para os próximos meses." onClose={() => setModal(null)}><RecurringTxForm initial={modal.item} onSave={r => act('rectx.save', r, 'Lançamento fixo atualizado.')} onClose={() => setModal(null)} /></Modal>}
    </div>
  </div>
}

export default function App() {
  return <ToastProvider><ConfirmProvider><Fluxo /></ConfirmProvider></ToastProvider>
}
