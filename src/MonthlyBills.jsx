import { useState } from 'react'
import { Plus, Check, Clock3, AlertTriangle, Pencil, Trash2, CalendarCheck2, ReceiptText } from 'lucide-react'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const now = new Date()
const localToday = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
export const currentMonth = localToday.slice(0, 7)
const today = localToday
const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(now)

export function BillForm({ initial, onSave, onClose }) {
  const [form,setForm]=useState(initial ? {...initial} : {name:'',category:'Contas',amount:'',dueDay:'10'})
  const categories=['Moradia','Contas','Transporte','Empréstimos','Compras parceladas','Educação','Saúde','Assinaturas','Outros']
  const update=(key,value)=>setForm(f=>({...f,[key]:value}))
  const submit=e=>{e.preventDefault();if(!form.name.trim()||Number(form.amount)<=0)return;onSave({...form,id:form.id||Date.now(),amount:Number(form.amount),dueDay:Number(form.dueDay)});onClose()}
  return <form className="space-y-4" onSubmit={submit}>
    <label className="block"><span className="mb-2 block text-xs font-bold">Nome da conta</span><input autoFocus className="input" value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Ex.: Aluguel" required/></label>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold">Valor mensal</span><input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>update('amount',e.target.value)} placeholder="0,00" required/></label><label><span className="mb-2 block text-xs font-bold">Dia do vencimento</span><input className="input" type="number" min="1" max="31" value={form.dueDay} onChange={e=>update('dueDay',e.target.value)} required/></label></div>
    <label className="block"><span className="mb-2 block text-xs font-bold">Categoria da despesa</span><select className="input" value={form.category} onChange={e=>update('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label>
    <div className="rounded-2xl bg-[#d9e7ff] p-4 text-xs leading-relaxed text-[#19365e]">Ao marcar como paga, esta conta será adicionada automaticamente em <strong>Transações</strong> como despesa.</div>
    <button className="btn-primary w-full" type="submit"><Check size={18}/> {initial?'Salvar alterações':'Adicionar conta mensal'}</button>
  </form>
}

export default function MonthlyBills({ bills, onAdd, onEdit, onDelete, onPay }) {
  const statusOf=bill=>{
    if ((bill.payments||[]).some(p=>p.month===currentMonth)) return 'paid'
    const [year,month]=currentMonth.split('-').map(Number)
    const lastDay=new Date(year,month,0).getDate()
    const due=new Date(`${currentMonth}-${String(Math.min(bill.dueDay,lastDay)).padStart(2,'0')}T23:59:59`)
    return now>due?'late':'pending'
  }
  const sorted=[...bills].sort((a,b)=>a.dueDay-b.dueDay)
  const paid=sorted.filter(b=>statusOf(b)==='paid')
  const late=sorted.filter(b=>statusOf(b)==='late')
  const pending=sorted.filter(b=>statusOf(b)==='pending')
  const openTotal=[...late,...pending].reduce((sum,b)=>sum+b.amount,0)
  const styles={paid:'bg-[#b9e65f]/20 text-[#5b7724]',late:'bg-[#ffd8cd] text-[#983c27]',pending:'bg-[#d9e7ff] text-[#294b78]'}
  const labels={paid:'Paga',late:'Atrasada',pending:'Pendente'}
  const icons={paid:Check,late:AlertTriangle,pending:Clock3}

  return <section className="card overflow-hidden rounded-[28px]">
    <div className="flex flex-col justify-between gap-4 border-b border-black/5 p-6 dark:border-white/5 md:flex-row md:items-center">
      <div><p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-[#6d8c31]">Checklist recorrente</p><h2 className="display text-xl font-bold">Contas de <span className="capitalize">{monthLabel}</span></h2><p className="subtle mt-1 text-xs">Marque como paga e a despesa irá para Transações.</p></div>
      <button className="btn-primary" onClick={onAdd}><Plus size={18}/> Nova conta mensal</button>
    </div>
    <div className="grid grid-cols-3 border-b border-black/5 dark:border-white/5">
      <div className="p-4 text-center"><p className="subtle text-[10px] font-bold uppercase tracking-wider">Em aberto</p><p className="mt-1 font-bold">{money.format(openTotal)}</p></div>
      <div className="border-x border-black/5 p-4 text-center dark:border-white/5"><p className="subtle text-[10px] font-bold uppercase tracking-wider">Pagas</p><p className="mt-1 font-bold text-[#638124]">{paid.length}/{bills.length}</p></div>
      <div className="p-4 text-center"><p className="subtle text-[10px] font-bold uppercase tracking-wider">Atrasadas</p><p className="mt-1 font-bold text-[#a1412c]">{late.length}</p></div>
    </div>
    {sorted.length ? <div className="divide-y divide-black/5 dark:divide-white/5">{sorted.map(bill=>{
      const status=statusOf(bill), Icon=icons[status]
      return <div key={bill.id} className="group flex flex-col gap-3 p-4 transition hover:bg-black/[.025] dark:hover:bg-white/[.025] sm:flex-row sm:items-center">
        <button disabled={status==='paid'} onClick={()=>onPay({id:bill.id,month:currentMonth,date:today})} className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl border-2 transition ${status==='paid'?'border-[#8bb33e] bg-[#b9e65f] text-[#111d2f]':'border-slate-300 hover:border-[#8bb33e] hover:bg-[#b9e65f]/20 dark:border-slate-600'}`} aria-label={status==='paid'?'Conta paga':'Marcar como paga'}><Check size={20} className={status==='paid'?'opacity-100':'opacity-25'}/></button>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className={`font-bold ${status==='paid'?'line-through opacity-60':''}`}>{bill.name}</h3><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${styles[status]}`}><Icon size={11}/>{labels[status]}</span></div><p className="subtle mt-1 text-xs">{bill.category} · vence dia {bill.dueDay}</p></div>
        <div className="flex items-center justify-between gap-3 sm:justify-end"><p className="display min-w-28 text-right font-bold">{money.format(bill.amount)}</p><div className="flex gap-1"><button className="btn-ghost p-2" onClick={()=>onEdit(bill)} title="Editar conta"><Pencil size={15}/></button><button className="btn-ghost p-2 text-red-500" onClick={()=>onDelete(bill.id)} title="Excluir conta"><Trash2 size={15}/></button></div></div>
      </div>
    })}</div> : <div className="grid place-items-center px-6 py-14 text-center"><span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#b9e65f]/20 text-[#638124]"><CalendarCheck2/></span><h3 className="display font-bold">Crie seu checklist mensal</h3><p className="subtle mt-1 max-w-sm text-sm">Adicione aluguel, internet, água, luz, empréstimos e outras contas recorrentes.</p></div>}
    {bills.length>0&&<div className="flex items-center gap-2 border-t border-black/5 bg-black/[.02] px-6 py-4 text-xs dark:border-white/5 dark:bg-white/[.02]"><ReceiptText size={15} className="subtle"/><span className="subtle">As contas reaparecem automaticamente como pendentes no início de cada mês.</span></div>}
  </section>
}
