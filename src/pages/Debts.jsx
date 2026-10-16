import { Landmark, CreditCard, CalendarDays, Plus, Pencil, Trash2, Check, History } from 'lucide-react'
import { useState } from 'react'
import { StatCard, EmptyState, useConfirm } from '../components/ui'
import { money, formatDate } from '../lib/format'

export function Debts({ debts, onPay, onEdit, onAdd, onDelete }) {
  const confirm = useConfirm()
  const askDelete = async d => { if (await confirm({ title: 'Excluir dívida?', text: `"${d.name}" e o histórico de pagamentos serão apagados. As despesas já lançadas em Transações continuam.`, confirmLabel: 'Excluir' })) onDelete(d.id) }
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
        <div className="mb-6 flex items-start justify-between gap-3"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#111d2f] text-[#b9e65f] dark:bg-[#b9e65f] dark:text-[#111d2f]"><CreditCard size={20}/></span><div><h3 className="display font-bold">{d.name}</h3><p className="subtle text-xs">{d.creditor}</p></div></div><div className="flex gap-1"><button className="btn-ghost p-2" onClick={()=>onEdit(d)} title="Editar todas as informações"><Pencil size={16}/></button><button className="btn-ghost p-2 text-red-500" onClick={()=>askDelete(d)} title="Excluir dívida"><Trash2 size={16}/></button></div></div>
        <div className="mb-5 grid grid-cols-3 gap-3"><div><p className="subtle text-[10px] font-bold uppercase tracking-wider">Parcela</p><p className="mt-1 font-bold">{money.format(d.monthly)}</p></div><div><p className="subtle text-[10px] font-bold uppercase tracking-wider">Restam</p><p className="mt-1 font-bold">{left}x</p></div><div><p className="subtle text-[10px] font-bold uppercase tracking-wider">Vencimento</p><p className="mt-1 font-bold">Dia {d.dueDay}</p></div></div>
        <div className="mb-5"><div className="subtle mb-2 flex justify-between text-xs"><span>{d.paid} de {d.installments} pagas</span><span>{Math.round(pct)}%</span></div><div className="progress-track"><div className="progress-fill" style={{width:`${pct}%`}}/></div></div>
        {(d.payments||[]).length>0&&<div className="mb-5 rounded-2xl bg-black/[.035] p-3 dark:bg-white/[.035]"><div className="subtle mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><History size={13}/> Pagamentos recentes</div>{d.payments.slice(0,2).map(p=><div key={p.id} className="flex justify-between py-1 text-xs"><span>{p.installmentsPaid} parcela{p.installmentsPaid>1?'s':''} · {formatDate(p.date)}</span><strong>{money.format(p.amountPaid)}</strong></div>)}</div>}
        <button className="btn-primary w-full" onClick={()=>onPay(d)}><Check size={18}/> Registrar pagamento</button>
      </article>})}
      {!active.length && <div className="card col-span-full rounded-[28px]"><EmptyState icon={Check} title="Nenhuma dívida ativa" text="Seus compromissos ativos aparecerão aqui."/></div>}
    </section>
    {finished.length > 0 && <section className="card rounded-[28px] p-6"><h2 className="display mb-4 text-lg font-bold">Concluídas</h2><div className="grid gap-3 md:grid-cols-2">{finished.map(d=><div key={d.id} className="flex items-center gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#b9e65f]/25 text-[#638124]"><Check size={17}/></span><div className="flex-1"><p className="text-sm font-bold">{d.name}</p><p className="subtle text-xs">{d.installments} parcelas · {money.format(d.total)}</p></div><button className="btn-ghost p-2" onClick={()=>onEdit(d)}><Pencil size={15}/></button><button className="btn-ghost p-2" onClick={()=>askDelete(d)}><Trash2 size={15}/></button></div>)}</div></section>}
  </div>
}

export function DebtForm({ onSave, onClose, initial }) {
  const [form,setForm]=useState(initial ? {...initial} : {name:'',creditor:'',total:'',installments:'',paid:'0',monthly:'',dueDay:'10'})
  const update=(key,value)=>setForm(f=>({...f,[key]:value}))
  const submit=e=>{e.preventDefault();const total=Number(form.total), installments=Number(form.installments), monthly=Number(form.monthly)||total/installments;if(!form.name||total<=0||installments<=0||monthly<0)return;onSave({...form,id:form.id,total,installments,paid:Math.min(Number(form.paid)||0,installments),monthly,dueDay:Number(form.dueDay)});onClose()}
  return <form onSubmit={submit} className="space-y-4">
    <label className="block"><span className="mb-2 block text-xs font-bold">Nome da dívida</span><input autoFocus className="input" value={form.name} onChange={e=>update('name',e.target.value)} placeholder="Ex.: Celular novo" required/></label>
    <label className="block"><span className="mb-2 block text-xs font-bold">Credor / instituição</span><input className="input" value={form.creditor} onChange={e=>update('creditor',e.target.value)} placeholder="Ex.: Cartão principal"/></label>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold">Valor total</span><input className="input" type="number" min="0.01" step="0.01" value={form.total} onChange={e=>update('total',e.target.value)} placeholder="0,00" required/></label><label><span className="mb-2 block text-xs font-bold">Nº de parcelas</span><input className="input" type="number" min="1" value={form.installments} onChange={e=>update('installments',e.target.value)} placeholder="12" required/></label></div>
    <div className="grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-xs font-bold">Parcelas já pagas</span><input className="input" type="number" min="0" max={form.installments||undefined} value={form.paid} onChange={e=>update('paid',e.target.value)}/></label><label><span className="mb-2 block text-xs font-bold">Valor da próxima parcela</span><input className="input" type="number" min="0" step="0.01" value={form.monthly} onChange={e=>update('monthly',e.target.value)} placeholder={form.total&&form.installments?(Number(form.total)/Number(form.installments)).toFixed(2):'0,00'} required={Boolean(initial)}/></label></div>
    <label className="block"><span className="mb-2 block text-xs font-bold">Dia do vencimento</span><input className="input" type="number" min="1" max="31" value={form.dueDay} onChange={e=>update('dueDay',e.target.value)} required/></label>
    <button className="btn-primary w-full" type="submit"><Check size={18}/> {initial?'Salvar alterações':'Salvar dívida'}</button>
  </form>
}

export function PaymentForm({ debt, onSave, onClose, today }) {
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
