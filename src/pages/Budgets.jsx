import { Plus, Pencil, Trash2, Target, PiggyBank } from 'lucide-react'
import { EmptyState, PageHeader, StatCard, useConfirm } from '../components/ui'
import { money, monthLabel, fromCents, toCents } from '../lib/format'
import { budgetUsage, expensesByCategory } from '../lib/finance'

const levelStyle = { ok: '#8bb33e', warn: '#f2b134', over: '#ff6b45' }
const levelText = { ok: 'Dentro do limite', warn: 'Perto do limite', over: 'Limite estourado' }

export default function Budgets({ budgets, transactions, month, onAdd, onEdit, onDelete }) {
  const confirm = useConfirm()
  const usage = budgetUsage(budgets, transactions, month)
  const untracked = expensesByCategory(transactions, month).filter(([c]) => !budgets.some(b => b.category === c))
  const limitTotal = fromCents(usage.reduce((s, b) => s + toCents(b.limit), 0))
  const spentTotal = fromCents(usage.reduce((s, b) => s + toCents(b.spent), 0))
  const askDelete = async b => { if (await confirm({ title: 'Excluir orçamento?', text: `O limite de "${b.category}" será removido.`, confirmLabel: 'Excluir' })) onDelete(b.id) }

  return <div className="space-y-6">
    <PageHeader eyebrow="Controle" title="Orçamentos" subtitle={`Limites por categoria em ${monthLabel(month)}.`}>
      <button className="btn-primary" onClick={() => onAdd()}><Plus size={18} /> Novo orçamento</button>
    </PageHeader>
    <section className="grid gap-4 md:grid-cols-3">
      <StatCard label="Limite total" value={money.format(limitTotal)} icon={Target} tone="dark" note={`${usage.length} categorias com limite`} />
      <StatCard label="Gasto nelas" value={money.format(spentTotal)} icon={PiggyBank} tone="coral" note="No mês selecionado" delay={60} />
      <StatCard label="Disponível" value={money.format(Math.max(0, limitTotal - spentTotal))} icon={Target} tone="lime" note="Limite menos gasto" delay={120} />
    </section>
    <section className="grid gap-4 xl:grid-cols-2">
      {usage.map(b => <article key={b.id} className="card rounded-[28px] p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h3 className="display font-bold">{b.category}</h3><p className="text-xs font-bold" style={{ color: levelStyle[b.level] }}>{levelText[b.level]}</p></div>
          <div className="flex gap-1"><button className="btn-ghost p-2" onClick={() => onEdit(b)} title="Editar"><Pencil size={16} /></button><button className="btn-ghost p-2 text-red-500" onClick={() => askDelete(b)} title="Excluir"><Trash2 size={16} /></button></div>
        </div>
        <div className="subtle mb-2 flex justify-between text-xs"><span>{money.format(b.spent)} de {money.format(b.limit)}</span><span>{Math.round(b.pct)}%</span></div>
        <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.min(100, b.pct)}%`, background: levelStyle[b.level] }} /></div>
        {b.level === 'over' && <p className="mt-3 text-xs font-bold text-[#c2410c]">Passou {money.format(b.spent - b.limit)} do limite.</p>}
      </article>)}
      {!usage.length && <div className="card col-span-full rounded-[28px]"><EmptyState icon={Target} title="Nenhum orçamento ainda" text="Defina um limite mensal para categorias como Alimentação ou Lazer." /></div>}
    </section>
    {untracked.length > 0 && <section className="card rounded-[28px] p-6">
      <h2 className="display mb-1 text-lg font-bold">Gastos sem limite</h2><p className="subtle mb-4 text-xs">Categorias com despesa neste mês e sem orçamento.</p>
      <div className="grid gap-3 md:grid-cols-2">{untracked.map(([c, v]) => <div key={c} className="flex items-center gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10"><div className="flex-1"><p className="text-sm font-bold">{c}</p><p className="subtle text-xs">{money.format(v)} gastos</p></div><button className="btn-ghost text-xs" onClick={() => onAdd(c)}>Definir limite</button></div>)}</div>
    </section>}
  </div>
}
