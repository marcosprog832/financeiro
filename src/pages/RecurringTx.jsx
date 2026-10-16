import { Plus, Pencil, Trash2, Repeat, TrendingUp, TrendingDown, Check } from 'lucide-react'
import { EmptyState, PageHeader, useConfirm } from '../components/ui'
import { money } from '../lib/format'

export default function RecurringTx({ items, transactions, currentMonth, onAdd, onEdit, onDelete, onToggle }) {
  const confirm = useConfirm()
  const generated = id => transactions.some(t => t.sourceKey === `rectx:${id}:${currentMonth}`)
  const askDelete = async r => { if (await confirm({ title: 'Excluir lançamento fixo?', text: `"${r.description}" não será mais lançado. O que já foi lançado continua em Transações.`, confirmLabel: 'Excluir' })) onDelete(r.id) }
  return <div className="space-y-6">
    <PageHeader eyebrow="Automação" title="Lançamentos fixos" subtitle="Salário, mensalidades e outras entradas ou saídas que se repetem todo mês.">
      <button className="btn-primary" onClick={onAdd}><Plus size={18} /> Novo lançamento fixo</button>
    </PageHeader>
    <section className="card overflow-hidden rounded-[28px]">
      {items.length ? <div className="divide-y divide-black/5 dark:divide-white/5">{items.map(r => <div key={r.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${r.active ? '' : 'opacity-55'}`}>
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${r.type === 'income' ? 'bg-[#b9e65f]/25 text-[#65852a]' : 'bg-[#ffd8cd] text-[#a1412c]'}`}>{r.type === 'income' ? <TrendingUp size={19} /> : <TrendingDown size={19} />}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{r.description}</h3>{r.active && generated(r.id) && <span className="inline-flex items-center gap-1 rounded-full bg-[#b9e65f]/25 px-2 py-1 text-[10px] font-bold text-[#5b7724]"><Check size={11} />Lançado este mês</span>}{!r.active && <span className="rounded-full bg-black/10 px-2 py-1 text-[10px] font-bold">Pausado</span>}</div><p className="subtle mt-1 text-xs">{r.category} · todo dia {r.day}</p></div>
        <div className="flex items-center justify-between gap-3 sm:justify-end"><p className="display min-w-28 text-right font-bold">{r.type === 'income' ? '+' : '-'} {money.format(r.amount)}</p>
          <div className="flex gap-1"><button className="btn-ghost px-3 py-2 text-xs" onClick={() => onToggle(r)}>{r.active ? 'Pausar' : 'Ativar'}</button><button className="btn-ghost p-2" onClick={() => onEdit(r)} title="Editar"><Pencil size={15} /></button><button className="btn-ghost p-2 text-red-500" onClick={() => askDelete(r)} title="Excluir"><Trash2 size={15} /></button></div></div>
      </div>)}</div> : <EmptyState icon={Repeat} title="Nenhum lançamento fixo" text="Cadastre seu salário para ele entrar sozinho todo mês." />}
    </section>
  </div>
}
