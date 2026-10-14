import { useEffect, useMemo, useState } from 'react'
import {
  LayoutDashboard, ArrowLeftRight, Landmark, Moon, Sun, Plus, TrendingUp,
  TrendingDown, Wallet, CreditCard, Search, Trash2, RotateCcw, X, Check,
  ChevronRight, Menu, CalendarDays, CircleDollarSign, PiggyBank, ReceiptText,
  Pencil, History, Database, LoaderCircle, AlertCircle,
} from 'lucide-react'
import { isLocalPreview, loadData, mutateData } from './dataService'
import MonthlyBills, { BillForm } from './MonthlyBills'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const clock = new Date()
const today = `${clock.getFullYear()}-${String(clock.getMonth()+1).padStart(2,'0')}-${String(clock.getDate()).padStart(2,'0')}`
const monthKey = today.slice(0, 7)
const formatDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR')

const seedTransactions = [
  { id: 1, type: 'income', description: 'Salário', category: 'Trabalho', amount: 5800, date: `${monthKey}-05` },
  { id: 2, type: 'expense', description: 'Aluguel', category: 'Moradia', amount: 1650, date: `${monthKey}-08` },
  { id: 3, type: 'expense', description: 'Supermercado', category: 'Alimentação', amount: 486.7, date: `${monthKey}-11` },
  { id: 4, type: 'income', description: 'Projeto freelance', category: 'Renda extra', amount: 1200, date: `${monthKey}-12` },
  { id: 5, type: 'expense', description: 'Internet', category: 'Contas', amount: 119.9, date: `${monthKey}-13` },
]
const seedDebts = [
  { id: 101, name: 'Notebook', creditor: 'Cartão principal', total: 4800, installments: 12, paid: 5, monthly: 400, dueDay: 18 },
  { id: 102, name: 'Empréstimo pessoal', creditor: 'Banco', total: 6000, installments: 10, paid: 7, monthly: 600, dueDay: 25 },
]
const seedBills = [
  { id: 201, name: 'Aluguel', category: 'Moradia', amount: 1650, dueDay: 8, payments: [] },
  { id: 202, name: 'Internet', category: 'Contas', amount: 119.9, dueDay: 12, payments: [] },
  { id: 203, name: 'Energia elétrica', category: 'Contas', amount: 238.4, dueDay: 20, payments: [] },
]

function useStoredState(key, initial) {
  const [state, setState] = useState(() => {
    try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) : initial }
    catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)) }, [key, state])
  return [state, setState]
}

function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const close = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#07101d]/70 p-4 backdrop-blur-sm" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" className="card modal-in max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] p-6 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h2 className="display text-2xl font-bold">{title}</h2><p className="subtle mt-1 text-sm">{subtitle}</p></div>
        <button className="btn-ghost p-2" onClick={onClose} aria-label="Fechar"><X size={19}/></button>
      </div>
      {children}
    </div>
  </div>
}

function StatCard({ label, value, icon: Icon, tone, note, delay = 0 }) {
  const tones = { lime: 'bg-[#b9e65f] text-[#111d2f]', blue: 'bg-[#d9e7ff] text-[#19365e]', coral: 'bg-[#ffd8cd] text-[#7d2c1c]', dark: 'bg-[#111d2f] text-white' }
  return <article className="card fade-up rounded-[24px] p-5" style={{ animationDelay: `${delay}ms` }}>
    <div className="mb-5 flex items-center justify-between">
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tones[tone]}`}><Icon size={19}/></span>
      <span className="subtle text-[11px] font-bold uppercase tracking-[.16em]">{label}</span>
    </div>
    <p className="display text-[clamp(1.45rem,2vw,2rem)] font-bold tracking-tight">{value}</p>
    <p className="subtle mt-2 text-xs">{note}</p>
  </article>
}

function EmptyState({ icon: Icon, title, text }) {
  return <div className="grid place-items-center px-5 py-16 text-center">
    <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#b9e65f]/20 text-[#6d8c31]"><Icon/></div>
    <h3 className="display font-bold">{title}</h3><p className="subtle mt-1 max-w-xs text-sm">{text}</p>
  </div>
}

function Dashboard({ transactions, debts, totals, openTransaction, openDebt }) {
  const recent = [...transactions].filter(t => !t.deletedAt).sort((a,b) => b.date.localeCompare(a.date)).slice(0, 5)
  const expenses = transactions.filter(t => !t.deletedAt && t.type === 'expense' && t.date.startsWith(monthKey))
  const cats = Object.entries(expenses.reduce((acc, t) => ({ ...acc, [t.category]: (acc[t.category] || 0) + t.amount }), {})).sort((a,b) => b[1] - a[1])
  const maxCat = Math.max(...cats.map(([,v]) => v), 1)
  const activeDebts = debts.filter(d => d.paid < d.installments)

  return <div className="space-y-6">
    <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#6d8c31]">Visão geral</p>
        <h1 className="display text-3xl font-bold tracking-tight md:text-5xl">Seu dinheiro,<br/><span className="subtle">sem complicação.</span></h1>
      </div>
      <div className="flex gap-2"><button onClick={openTransaction} className="btn-primary"><Plus size={18}/> Transação</button><button onClick={openDebt} className="btn-ghost"><Landmark size={18}/> Dívida</button></div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Saldo geral" value={money.format(totals.balance)} icon={Wallet} tone="lime" note="Receitas menos despesas"/>
      <StatCard label="Receitas do mês" value={money.format(totals.income)} icon={TrendingUp} tone="blue" note={`${totals.incomeCount} entradas registradas`} delay={60}/>
      <StatCard label="Despesas do mês" value={money.format(totals.expense)} icon={TrendingDown} tone="coral" note={`${totals.expenseCount} saídas registradas`} delay={120}/>
      <StatCard label="Parcelas mensais" value={money.format(totals.committed)} icon={CreditCard} tone="dark" note={`${activeDebts.length} compromissos ativos`} delay={180}/>
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <div className="card overflow-hidden rounded-[28px]">
        <div className="flex items-center justify-between border-b border-black/5 px-6 py-5 dark:border-white/5"><div><h2 className="display text-lg font-bold">Últimas movimentações</h2><p className="subtle text-xs">Atualizadas automaticamente</p></div><ReceiptText className="subtle" size={20}/></div>
        {recent.length ? <div className="divide-y divide-black/5 dark:divide-white/5">{recent.map(t => <div key={t.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-black/[.025] dark:hover:bg-white/[.025]">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${t.type === 'income' ? 'bg-[#b9e65f]/25 text-[#65852a]' : 'bg-[#ffd8cd] text-[#a1412c]'}`}>{t.type === 'income' ? <TrendingUp size={18}/> : <TrendingDown size={18}/>}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{t.description}</p><p className="subtle text-xs">{t.category} · {formatDate(t.date)}</p></div>
          <p className={`text-sm font-bold ${t.type === 'income' ? 'text-[#65852a] dark:text-[#b9e65f]' : ''}`}>{t.type === 'income' ? '+' : '-'} {money.format(t.amount)}</p>
        </div>)}</div> : <EmptyState icon={ArrowLeftRight} title="Sem movimentações" text="Adicione uma transação para começar."/>}
      </div>

      <div className="card rounded-[28px] p-6">
        <div className="mb-6"><h2 className="display text-lg font-bold">Gastos por categoria</h2><p className="subtle text-xs">No mês atual</p></div>
        {cats.length ? <div className="space-y-5">{cats.slice(0,5).map(([name, value], i) => <div key={name}>
          <div className="mb-2 flex justify-between gap-3 text-xs"><span className="font-semibold">{name}</span><span className="subtle">{money.format(value)}</span></div>
          <div className="progress-track"><div className="progress-fill" style={{width: `${(value / maxCat) * 100}%`, background: i === 0 ? '#ff8b6b' : undefined}}/></div>
        </div>)}</div> : <EmptyState icon={PiggyBank} title="Tudo tranquilo" text="Nenhuma despesa neste mês."/>}
      </div>
    </section>
  </div>
}

function Transactions({ transactions, onDelete, onRestore, onAdd }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [trash, setTrash] = useState(false)
  const visible = transactions.filter(t => Boolean(t.deletedAt) === trash).filter(t => filter === 'all' || t.type === filter).filter(t => `${t.description} ${t.category}`.toLowerCase().includes(search.toLowerCase())).sort((a,b) => b.date.localeCompare(a.date))
  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#6d8c31]">Movimentações</p><h1 className="display text-3xl font-bold md:text-4xl">Transações</h1><p className="subtle mt-1">Acompanhe cada entrada e saída.</p></div><button className="btn-primary" onClick={onAdd}><Plus size={18}/> Nova transação</button></header>
    <section className="card rounded-[28px] p-4 md:p-6">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row">
        <label className="relative flex-1"><Search className="subtle absolute left-4 top-1/2 -translate-y-1/2" size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} className="input pl-11" placeholder="Buscar descrição ou categoria..."/></label>
        <div className="flex flex-wrap gap-2">
          {[['all','Todas'],['income','Receitas'],['expense','Despesas']].map(([id,label]) => <button key={id} className={`btn-ghost text-sm ${filter === id && !trash ? 'bg-[#111d2f] text-white dark:bg-[#b9e65f] dark:text-[#111d2f]' : ''}`} onClick={()=>{setFilter(id);setTrash(false)}}>{label}</button>)}
          <button className={`btn-ghost text-sm ${trash ? 'bg-[#ffd8cd] text-[#7d2c1c]' : ''}`} onClick={()=>setTrash(!trash)}><Trash2 size={15}/> Excluídas</button>
        </div>
      </div>
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left">
        <thead><tr className="subtle border-b border-black/10 text-[11px] uppercase tracking-[.14em] dark:border-white/10"><th className="px-3 py-3">Movimentação</th><th className="px-3 py-3">Categoria</th><th className="px-3 py-3">Data</th><th className="px-3 py-3 text-right">Valor</th><th className="px-3 py-3 text-right">Ação</th></tr></thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/5">{visible.map(t => <tr key={t.id} className="group hover:bg-black/[.025] dark:hover:bg-white/[.025]">
          <td className="px-3 py-4"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center rounded-xl ${t.type==='income'?'bg-[#b9e65f]/25 text-[#68872b]':'bg-[#ffd8cd] text-[#9c3d29]'}`}>{t.type==='income'?<TrendingUp size={17}/>:<TrendingDown size={17}/>}</span><div><p className="text-sm font-bold">{t.description}</p><p className="subtle text-xs">{t.type==='income'?'Receita':'Despesa'}</p></div></div></td>
          <td className="px-3 py-4 text-sm">{t.category}</td><td className="subtle px-3 py-4 text-sm">{formatDate(t.date)}</td>
          <td className={`px-3 py-4 text-right text-sm font-bold ${t.type==='income'?'text-[#668629] dark:text-[#b9e65f]':''}`}>{t.type==='income'?'+':'-'} {money.format(t.amount)}</td>
          <td className="px-3 py-4 text-right"><button onClick={()=>trash?onRestore(t.id):onDelete(t.id)} className="btn-ghost p-2" title={trash?'Restaurar':'Excluir'}>{trash?<RotateCcw size={16}/>:<Trash2 size={16}/>}</button></td>
        </tr>)}</tbody>
      </table></div> : <EmptyState icon={trash?Trash2:Search} title={trash?'Lixeira vazia':'Nada encontrado'} text={trash?'As transações excluídas aparecerão aqui.':'Tente alterar os filtros ou cadastre uma transação.'}/>} 
    </section>
  </div>
}

function Debts({ debts, onPay, onEdit, onAdd, onDelete }) {
  const active = debts.filter(d => d.paid < d.installments)
  const finished = debts.filter(d => d.paid >= d.installments)
  const totalLeft = active.reduce((s,d) => s + (d.installments-d.paid)*d.monthly, 0)
  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#6d8c31]">Planejamento</p><h1 className="display text-3xl font-bold md:text-4xl">Dívidas & parcelas</h1><p className="subtle mt-1">Veja o fim de cada compromisso.</p></div><button className="btn-primary" onClick={onAdd}><Plus size={18}/> Nova dívida</button></header>
    <section className="grid gap-4 md:grid-cols-3">
      <StatCard label="Saldo devedor" value={money.format(totalLeft)} icon={Landmark} tone="coral" note="Estimativa das parcelas restantes"/>
      <StatCard label="Compromissos ativos" value={String(active.length).padStart(2,'0')} icon={CreditCard} tone="dark" note={`${finished.length} já foram concluídos`} delay={60}/>
      <StatCard label="Compromisso mensal" value={money.format(active.reduce((s,d)=>s+d.monthly,0))} icon={CalendarDays} tone="lime" note="Soma das parcelas ativas" delay={120}/>
    </section>
    <section className="grid gap-4 xl:grid-cols-2">
      {active.map(d => { const left=d.installments-d.paid; const pct=Math.min(100,d.paid/d.installments*100); return <article key={d.id} className="card rounded-[28px] p-6">
        <div className="mb-6 flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111d2f] text-[#b9e65f] dark:bg-[#b9e65f] dark:text-[#111d2f]"><CreditCard size={20}/></span><div><h3 className="display font-bold">{d.name}</h3><p className="subtle text-xs">{d.creditor}</p></div></div><div className="flex gap-1"><button className="btn-ghost p-2" onClick={()=>onEdit(d)} title="Editar todas as informações"><Pencil size={16}/></button><button className="btn-ghost p-2 text-red-500" onClick={()=>onDelete(d.id)} title="Excluir dívida"><Trash2 size={16}/></button></div></div>
        <div className="mb-5 grid grid-cols-3 gap-3"><div><p className="subtle text-[10px] font-bold uppercase tracking-wider">Parcela</p><p className="mt-1 font-bold">{money.format(d.monthly)}</p></div><div><p className="subtle text-[10px] font-bold uppercase tracking-wider">Restam</p><p className="mt-1 font-bold">{left}x</p></div><div><p className="subtle text-[10px] font-bold uppercase tracking-wider">Vencimento</p><p className="mt-1 font-bold">Dia {d.dueDay}</p></div></div>
        <div className="mb-5"><div className="subtle mb-2 flex justify-between text-xs"><span>{d.paid} de {d.installments} pagas</span><span>{Math.round(pct)}%</span></div><div className="progress-track"><div className="progress-fill" style={{width:`${pct}%`}}/></div></div>
        {(d.payments||[]).length>0&&<div className="mb-5 rounded-2xl bg-black/[.035] p-3 dark:bg-white/[.035]"><div className="subtle mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><History size={13}/> Pagamentos recentes</div>{d.payments.slice(0,2).map(p=><div key={p.id} className="flex justify-between py-1 text-xs"><span>{p.installmentsPaid} parcela{p.installmentsPaid>1?'s':''} · {formatDate(p.date)}</span><strong>{money.format(p.amountPaid)}</strong></div>)}</div>}
        <button className="btn-primary w-full" onClick={()=>onPay(d)}><Check size={18}/> Registrar pagamento</button>
      </article>})}
      {!active.length && <div className="card col-span-full rounded-[28px]"><EmptyState icon={Check} title="Nenhuma dívida ativa" text="Seus compromissos ativos aparecerão aqui."/></div>}
    </section>
    {finished.length > 0 && <section className="card rounded-[28px] p-6"><h2 className="display mb-4 text-lg font-bold">Concluídas</h2><div className="grid gap-3 md:grid-cols-2">{finished.map(d=><div key={d.id} className="flex items-center gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b9e65f]/25 text-[#638124]"><Check size={17}/></span><div className="flex-1"><p className="text-sm font-bold">{d.name}</p><p className="subtle text-xs">{d.installments} parcelas · {money.format(d.total)}</p></div><button className="btn-ghost p-2" onClick={()=>onEdit(d)}><Pencil size={15}/></button><button className="btn-ghost p-2" onClick={()=>onDelete(d.id)}><Trash2 size={15}/></button></div>)}</div></section>}
  </div>
}

function TransactionForm({ onSave, onClose }) {
  const [form,setForm]=useState({type:'expense',description:'',category:'Alimentação',amount:'',date:today})
  const categories=form.type==='income'?['Trabalho','Renda extra','Investimentos','Presente','Outros']:['Alimentação','Moradia','Transporte','Saúde','Lazer','Contas','Educação','Outros']
  const update=(key,value)=>setForm(f=>({...f,[key]:value}))
  const submit=e=>{e.preventDefault(); if(!form.description.trim()||Number(form.amount)<=0)return; onSave({...form,amount:Number(form.amount),id:Date.now()});onClose()}
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/5 p-1 dark:bg-white/5">{[['expense','Despesa',TrendingDown],['income','Receita',TrendingUp]].map(([id,label,Icon])=><button type="button" key={id} onClick={()=>setForm(f=>({...f,type:id,category:id==='income'?'Trabalho':'Alimentação'}))} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${form.type===id?(id==='income'?'bg-[#b9e65f] text-[#111d2f]':'bg-[#ff8b6b] text-[#3a130a]'):''}`}><Icon size={17}/>{label}</button>)}</div>
    <label className="block"><span className="mb-2 block text-xs font-bold">Descrição</span><input autoFocus className="input" value={form.description} onChange={e=>update('description',e.target.value)} placeholder="Ex.: Supermercado" required/></label>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold">Valor</span><input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>update('amount',e.target.value)} placeholder="0,00" required/></label><label><span className="mb-2 block text-xs font-bold">Data</span><input className="input" type="date" value={form.date} onChange={e=>update('date',e.target.value)} required/></label></div>
    <label className="block"><span className="mb-2 block text-xs font-bold">Categoria</span><select className="input" value={form.category} onChange={e=>update('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <button className="btn-primary mt-2 w-full" type="submit"><Check size={18}/> Salvar transação</button>
  </form>
}

function DebtForm({ onSave, onClose, initial }) {
  const [form,setForm]=useState(initial ? {...initial} : {name:'',creditor:'',total:'',installments:'',paid:'0',monthly:'',dueDay:'10'})
  const update=(key,value)=>setForm(f=>({...f,[key]:value}))
  const submit=e=>{e.preventDefault();const total=Number(form.total), installments=Number(form.installments), monthly=Number(form.monthly)||total/installments;if(!form.name||total<=0||installments<=0||monthly<0)return;onSave({...form,id:form.id||Date.now(),total,installments,paid:Math.min(Number(form.paid)||0,installments),monthly,dueDay:Number(form.dueDay)});onClose()}
  return <form onSubmit={submit} className="space-y-4">
    <label className="block"><span className="mb-2 block text-xs font-bold">Nome da dívida</span><input autoFocus className="input" value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Ex.: Celular novo" required/></label>
    <label className="block"><span className="mb-2 block text-xs font-bold">Credor / instituição</span><input className="input" value={form.creditor} onChange={e=>update('creditor',e.target.value)} placeholder="Ex.: Cartão principal"/></label>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold">Valor total</span><input className="input" type="number" min="0.01" step="0.01" value={form.total} onChange={e=>update('total',e.target.value)} placeholder="0,00" required/></label><label><span className="mb-2 block text-xs font-bold">Nº de parcelas</span><input className="input" type="number" min="1" value={form.installments} onChange={e=>update('installments',e.target.value)} placeholder="12" required/></label></div>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold">Parcelas já pagas</span><input className="input" type="number" min="0" max={form.installments||undefined} value={form.paid} onChange={e=>update('paid',e.target.value)}/></label><label><span className="mb-2 block text-xs font-bold">Valor da próxima parcela</span><input className="input" type="number" min="0" step="0.01" value={form.monthly} onChange={e=>update('monthly',e.target.value)} placeholder={form.total&&form.installments?(Number(form.total)/Number(form.installments)).toFixed(2):'0,00'} required={Boolean(initial)}/></label></div>
    <label className="block"><span className="mb-2 block text-xs font-bold">Dia do vencimento</span><input className="input" type="number" min="1" max="31" value={form.dueDay} onChange={e=>update('dueDay',e.target.value)} required/></label>
    <button className="btn-primary w-full" type="submit"><Check size={18}/> {initial?'Salvar alterações':'Salvar dívida'}</button>
  </form>
}

function PaymentForm({ debt, onSave, onClose }) {
  const remaining=debt.installments-debt.paid
  const [form,setForm]=useState({installmentsPaid:1,amountPaid:debt.monthly,nextValue:debt.monthly,date:today,note:''})
  const update=(key,value)=>setForm(f=>({...f,[key]:value}))
  const changeCount=value=>{const count=Math.max(1,Math.min(Number(value)||1,remaining));setForm(f=>({...f,installmentsPaid:count,amountPaid:Number((debt.monthly*count).toFixed(2))}))}
  const submit=e=>{e.preventDefault();if(Number(form.amountPaid)<=0||Number(form.nextValue)<0)return;onSave({id:debt.id,installmentsPaid:Number(form.installmentsPaid),amountPaid:Number(form.amountPaid),nextValue:Number(form.nextValue),date:form.date,note:form.note});onClose()}
  return <form onSubmit={submit} className="space-y-4">
    <div className="rounded-2xl bg-[#b9e65f]/20 p-4"><p className="text-sm font-bold">{debt.name}</p><p className="subtle mt-1 text-xs">Restam {remaining} parcelas · atual {money.format(debt.monthly)}</p></div>
    <label className="block"><span className="mb-2 block text-xs font-bold">Quantas parcelas está pagando?</span><input autoFocus className="input" type="number" min="1" max={remaining} value={form.installmentsPaid} onChange={e=>changeCount(e.target.value)} required/></label>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold">Valor total pago agora</span><input className="input" type="number" min="0.01" step="0.01" value={form.amountPaid} onChange={e=>update('amountPaid',e.target.value)} required/></label><label><span className="mb-2 block text-xs font-bold">Novo valor da próxima</span><input className="input" type="number" min="0" step="0.01" value={form.nextValue} onChange={e=>update('nextValue',e.target.value)} required/></label></div>
    <label className="block"><span className="mb-2 block text-xs font-bold">Data do pagamento</span><input className="input" type="date" value={form.date} onChange={e=>update('date',e.target.value)} required/></label>
    <label className="block"><span className="mb-2 block text-xs font-bold">Observação (opcional)</span><input className="input" value={form.note} onChange={e=>update('note',e.target.value)} placeholder="Ex.: adiantamento de duas parcelas"/></label>
    <div className="rounded-2xl border border-black/10 p-4 text-sm dark:border-white/10"><div className="flex justify-between"><span className="subtle">Depois deste pagamento</span><strong>{remaining-Number(form.installmentsPaid||0)} parcelas restantes</strong></div><div className="mt-2 flex justify-between"><span className="subtle">Próxima parcela</span><strong>{money.format(Number(form.nextValue)||0)}</strong></div></div>
    <button className="btn-primary w-full" type="submit"><Check size={18}/> Confirmar pagamento</button>
  </form>
}

export default function App() {
  const [data,setData]=useState({transactions:[],debts:[],recurringBills:[]})
  const [theme,setTheme]=useStoredState('fluxo-theme','light')
  const [page,setPage]=useState('dashboard')
  const [modal,setModal]=useState(null)
  const [mobile,setMobile]=useState(false)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  useEffect(()=>{document.documentElement.classList.toggle('dark',theme==='dark')},[theme])
  useEffect(()=>{loadData({transactions:seedTransactions,debts:seedDebts.map(d=>({...d,payments:[]})),recurringBills:seedBills}).then(setData).catch(()=>setError('Não foi possível conectar ao banco de dados.')).finally(()=>setLoading(false))},[])

  const {transactions,debts,recurringBills=[]}=data
  const act=async(action,payload)=>{
    setError('')
    try { setData(await mutateData(action,payload,data)) }
    catch(e) { setError(e.message) }
  }

  const active=transactions.filter(t=>!t.deletedAt)
  const totals=useMemo(()=>{
    const current=active.filter(t=>t.date.startsWith(monthKey))
    const income=current.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)
    const expense=current.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)
    const allIncome=active.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0)
    const allExpense=active.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0)
    return {income,expense,balance:allIncome-allExpense,committed:debts.filter(d=>d.paid<d.installments).reduce((s,d)=>s+d.monthly,0),incomeCount:current.filter(t=>t.type==='income').length,expenseCount:current.filter(t=>t.type==='expense').length}
  },[transactions,debts])

  const navigation=[['dashboard','Visão geral',LayoutDashboard],['transactions','Transações',ArrowLeftRight],['debts','Dívidas & parcelas',Landmark]]
  const go=id=>{setPage(id);setMobile(false);window.scrollTo({top:0,behavior:'smooth'})}
  const saveTransaction=t=>act('transaction.create',t)
  const saveDebt=d=>act('debt.create',d)

  return <div className={theme==='dark'?'dark':''}>
    <div className="app-shell flex">
      {mobile&&<button aria-label="Fechar menu" className="fixed inset-0 z-30 bg-[#07101d]/50 lg:hidden" onClick={()=>setMobile(false)}/>}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col bg-[#111d2f] p-6 text-white transition-transform lg:translate-x-0 ${mobile?'translate-x-0':'-translate-x-full'}`}>
        <div className="mb-10 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#b9e65f] text-[#111d2f]"><CircleDollarSign size={23}/></span><div><p className="display text-xl font-bold leading-none">fluxo.</p><p className="mt-1 text-[10px] uppercase tracking-[.18em] text-slate-400">finanças pessoais</p></div></div>
        <nav className="space-y-2">{navigation.map(([id,label,Icon])=><button key={id} onClick={()=>go(id)} className={`nav-item flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-300 ${page===id?'nav-active':''}`}><Icon size={18}/>{label}</button>)}</nav>
        <div className="mt-auto rounded-[22px] border border-white/10 bg-white/[.04] p-4"><p className="mb-1 flex items-center gap-2 text-xs font-bold text-[#b9e65f]"><Database size={14}/>{isLocalPreview?'Prévia local':'Supabase conectado'}</p><p className="text-[11px] leading-relaxed text-slate-400">Alterações salvas na nuvem.</p></div>
        <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4"><div><p className="text-sm font-bold">Minha conta</p><p className="text-[11px] text-slate-400">Controle pessoal</p></div><button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} className="grid h-10 w-10 place-items-center rounded-xl bg-white/10" aria-label="Alternar tema">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button></div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-[270px]">
        <div className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-black/5 bg-[#f3f0e8]/80 px-4 backdrop-blur-xl dark:border-white/5 dark:bg-[#0d1522]/80 lg:hidden"><button className="btn-ghost p-2" onClick={()=>setMobile(true)}><Menu size={20}/></button><span className="display font-bold">fluxo.</span><button onClick={()=>setTheme(t=>t==='dark'?'light':'dark')} className="btn-ghost p-2">{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button></div>
        <div className="mx-auto max-w-[1440px] p-4 pb-16 sm:p-6 md:p-8 xl:p-12">
          {loading&&<div className="mb-5 flex items-center gap-2 rounded-2xl bg-[#d9e7ff] p-4 text-sm font-bold text-[#19365e]"><LoaderCircle className="animate-spin" size={18}/> Carregando seus dados...</div>}
          {error&&<div className="mb-5 flex items-center gap-2 rounded-2xl bg-[#ffd8cd] p-4 text-sm font-bold text-[#7d2c1c]"><AlertCircle size={18}/> {error}</div>}
          {page==='dashboard'&&<Dashboard transactions={transactions} debts={debts} totals={totals} openTransaction={()=>setModal('transaction')} openDebt={()=>setModal('debt')}/>} 
          {page==='transactions'&&<Transactions transactions={transactions} onDelete={id=>act('transaction.delete',{id})} onRestore={id=>act('transaction.restore',{id})} onAdd={()=>setModal('transaction')}/>} 
          {page==='debts'&&<div className="space-y-8"><Debts debts={debts} onPay={debt=>setModal({type:'payment',debt})} onEdit={debt=>setModal({type:'editDebt',debt})} onAdd={()=>setModal('debt')} onDelete={id=>act('debt.delete',{id})}/><MonthlyBills bills={recurringBills} onAdd={()=>setModal('bill')} onEdit={bill=>setModal({type:'editBill',bill})} onDelete={id=>act('bill.delete',{id})} onPay={payload=>act('bill.pay',payload)}/></div>} 
        </div>
      </main>
      {modal==='transaction'&&<Modal title="Nova transação" subtitle="Registre uma entrada ou saída." onClose={()=>setModal(null)}><TransactionForm onSave={saveTransaction} onClose={()=>setModal(null)}/></Modal>}
      {modal==='debt'&&<Modal title="Nova dívida" subtitle="Cadastre o parcelamento e acompanhe o progresso." onClose={()=>setModal(null)}><DebtForm onSave={saveDebt} onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==='editDebt'&&<Modal title="Editar dívida" subtitle="Todos os dados podem ser corrigidos." onClose={()=>setModal(null)}><DebtForm initial={modal.debt} onSave={d=>act('debt.update',d)} onClose={()=>setModal(null)}/></Modal>}
      {modal?.type==='payment'&&<Modal title="Registrar pagamento" subtitle="Quite uma ou várias parcelas de uma vez." onClose={()=>setModal(null)}><PaymentForm debt={modal.debt} onSave={p=>act('debt.pay',p)} onClose={()=>setModal(null)}/></Modal>}
      {modal==='bill'&&<Modal title="Nova conta mensal" subtitle="Ela aparecerá automaticamente todos os meses." onClose={()=>setModal(null)}><BillForm onSave={bill=>act('bill.create',bill)} onClose={()=>setModal(null)}/></Modal>}
    </div>
  </div>
}