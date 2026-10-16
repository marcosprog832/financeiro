import { Plus, Landmark, Wallet, TrendingUp, TrendingDown, CreditCard, ReceiptText, ArrowLeftRight, PiggyBank, AlertTriangle } from 'lucide-react'
import { StatCard, EmptyState } from '../components/ui'
import { money, formatDate, monthLabel } from '../lib/format'
import { monthTotals, overallBalance, committedMonthly, activeDebts, expensesByCategory, monthlySeries, budgetUsage } from '../lib/finance'

function EvolutionChart({ series }) {
  const W = 600, H = 210, padL = 8, padB = 28, padT = 12
  const max = Math.max(...series.flatMap(s => [s.income, s.expense]), 1)
  const slot = (W - padL) / series.length, bar = Math.min(26, slot / 3)
  const y = v => padT + (H - padT - padB) * (1 - v / max)
  return <div>
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Receitas e despesas dos últimos meses">
      {[0, .5, 1].map(f => <line key={f} x1={padL} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="currentColor" opacity=".1" />)}
      {series.map((s, i) => {
        const cx = padL + slot * i + slot / 2
        return <g key={s.ym}>
          <rect x={cx - bar - 2} y={y(s.income)} width={bar} height={Math.max(2, H - padB - y(s.income))} rx="6" fill="#b9e65f"><title>{`Receitas: ${money.format(s.income)}`}</title></rect>
          <rect x={cx + 2} y={y(s.expense)} width={bar} height={Math.max(2, H - padB - y(s.expense))} rx="6" fill="#ff8b6b"><title>{`Despesas: ${money.format(s.expense)}`}</title></rect>
          <text x={cx} y={H - 8} textAnchor="middle" fontSize="12" fill="currentColor" opacity=".6" className="capitalize">{s.label}</text>
        </g>
      })}
    </svg>
    <div className="subtle mt-2 flex gap-4 text-xs"><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#b9e65f]" />Receitas</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#ff8b6b]" />Despesas</span></div>
  </div>
}

export default function Dashboard({ transactions, debts, budgets, month, openTransaction, openDebt, goBudgets }) {
  const totals = monthTotals(transactions, month)
  const recent = transactions.filter(t => !t.deletedAt && t.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 5)
  const cats = expensesByCategory(transactions, month)
  const maxCat = Math.max(...cats.map(([, v]) => v), 1)
  const series = monthlySeries(transactions, month, 6)
  const alerts = budgetUsage(budgets, transactions, month).filter(b => b.level !== 'ok')
  const budgetOf = Object.fromEntries(budgets.map(b => [b.category, b.limit]))

  return <div className="space-y-6">
    <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
      <div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#6d8c31]">Visão geral · <span className="capitalize">{monthLabel(month)}</span></p>
        <h1 className="display text-3xl font-bold tracking-tight md:text-5xl">Seu dinheiro,<br /><span className="subtle">sem complicação.</span></h1>
      </div>
      <div className="flex gap-2"><button onClick={openTransaction} className="btn-primary"><Plus size={18} /> Transação</button><button onClick={openDebt} className="btn-ghost"><Landmark size={18} /> Dívida</button></div>
    </section>

    {alerts.length > 0 && <button onClick={goBudgets} className="card flex w-full items-start gap-3 rounded-[24px] border-l-4 border-[#ff8b6b] p-4 text-left">
      <AlertTriangle className="mt-0.5 shrink-0 text-[#d9532f]" size={20} />
      <div className="text-sm"><p className="font-bold">Atenção aos orçamentos deste mês</p>
        <p className="subtle mt-1 text-xs">{alerts.map(a => `${a.category}: ${Math.round(a.pct)}% do limite${a.level === 'over' ? ' (estourado)' : ''}`).join(' · ')}</p></div>
    </button>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Saldo geral" value={money.format(overallBalance(transactions))} icon={Wallet} tone="lime" note={`Neste mês: ${money.format(totals.balance)}`} />
      <StatCard label="Receitas do mês" value={money.format(totals.income)} icon={TrendingUp} tone="blue" note={`${totals.incomeCount} entradas registradas`} delay={60} />
      <StatCard label="Despesas do mês" value={money.format(totals.expense)} icon={TrendingDown} tone="coral" note={`${totals.expenseCount} saídas registradas`} delay={120} />
      <StatCard label="Parcelas mensais" value={money.format(committedMonthly(debts))} icon={CreditCard} tone="dark" note={`${activeDebts(debts).length} compromissos ativos`} delay={180} />
    </section>

    <section className="card rounded-[28px] p-6">
      <div className="mb-4"><h2 className="display text-lg font-bold">Evolução</h2><p className="subtle text-xs">Receitas e despesas dos últimos 6 meses</p></div>
      <EvolutionChart series={series} />
    </section>

    <section className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
      <div className="card overflow-hidden rounded-[28px]">
        <div className="flex items-center justify-between border-b border-black/5 px-6 py-5 dark:border-white/5"><div><h2 className="display text-lg font-bold">Últimas movimentações</h2><p className="subtle text-xs">Do mês selecionado</p></div><ReceiptText className="subtle" size={20} /></div>
        {recent.length ? <div className="divide-y divide-black/5 dark:divide-white/5">{recent.map(t => <div key={t.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-black/[.025] dark:hover:bg-white/[.025]">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${t.type === 'income' ? 'bg-[#b9e65f]/25 text-[#65852a]' : 'bg-[#ffd8cd] text-[#a1412c]'}`}>{t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{t.description}</p><p className="subtle text-xs">{t.category} · {formatDate(t.date)}</p></div>
          <p className={`text-sm font-bold ${t.type === 'income' ? 'text-[#65852a] dark:text-[#b9e65f]' : ''}`}>{t.type === 'income' ? '+' : '-'} {money.format(t.amount)}</p>
        </div>)}</div> : <EmptyState icon={ArrowLeftRight} title="Sem movimentações" text="Nada registrado neste mês." />}
      </div>

      <div className="card rounded-[28px] p-6">
        <div className="mb-6"><h2 className="display text-lg font-bold">Gastos por categoria</h2><p className="subtle text-xs">No mês selecionado</p></div>
        {cats.length ? <div className="space-y-5">{cats.slice(0, 6).map(([name, value], i) => {
          const limit = budgetOf[name]
          return <div key={name}>
            <div className="mb-2 flex justify-between gap-3 text-xs"><span className="font-semibold">{name}</span><span className="subtle">{money.format(value)}{limit ? ` / ${money.format(limit)}` : ''}</span></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${(limit ? Math.min(100, value / limit * 100) : value / maxCat * 100)}%`, background: (limit && value >= limit) || (!limit && i === 0) ? '#ff8b6b' : undefined }} /></div>
          </div>
        })}</div> : <EmptyState icon={PiggyBank} title="Tudo tranquilo" text="Nenhuma despesa neste mês." />}
      </div>
    </section>
  </div>
}
