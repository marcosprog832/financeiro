import { useMemo, useState } from 'react'
import { Plus, Search, Trash2, RotateCcw, TrendingUp, TrendingDown, Pencil, Download, ArrowLeftRight, XCircle } from 'lucide-react'
import { EmptyState, PageHeader, useConfirm } from '../components/ui'
import { money, formatDate, monthLabel, toCents, fromCents } from '../lib/format'
import { filterTransactions } from '../lib/finance'
import { transactionsToCSV } from '../lib/csv'
import { download } from '../lib/download'

export default function Transactions({ transactions, month, onDelete, onRestore, onPurge, onEdit, onAdd }) {
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [trash, setTrash] = useState(false)
  const [period, setPeriod] = useState('month') // month | all | custom
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const range = period === 'month' ? { from: `${month}-01`, to: `${month}-31` } : period === 'custom' ? { from, to } : {}
  const visible = useMemo(() => filterTransactions(transactions, { trash, type: filter, search, ...range }), [transactions, trash, filter, search, period, from, to, month])
  const totals = useMemo(() => {
    let inc = 0, exp = 0
    for (const t of visible) { if (t.type === 'income') inc += toCents(t.amount); else exp += toCents(t.amount) }
    return { inc: fromCents(inc), exp: fromCents(exp), bal: fromCents(inc - exp) }
  }, [visible])

  const exportCSV = () => download(`transacoes-${period === 'month' ? month : 'periodo'}.csv`, transactionsToCSV(visible), 'text/csv;charset=utf-8')
  const purge = async t => { if (await confirm({ title: 'Excluir definitivamente?', text: `"${t.description}" será apagada para sempre.`, confirmLabel: 'Excluir' })) onPurge(t.id) }

  return <div className="space-y-6">
    <PageHeader eyebrow="Movimentações" title="Transações" subtitle="Acompanhe cada entrada e saída.">
      <button className="btn-ghost" onClick={exportCSV} disabled={!visible.length}><Download size={17} /> Exportar CSV</button>
      <button className="btn-primary" onClick={onAdd}><Plus size={18} /> Nova transação</button>
    </PageHeader>
    <section className="card rounded-[28px] p-4 md:p-6">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row">
        <label className="relative flex-1"><Search className="subtle absolute left-4 top-1/2 -translate-y-1/2" size={17} /><input value={search} onChange={e => setSearch(e.target.value)} className="input pl-11" placeholder="Buscar descrição ou categoria..." /></label>
        <div className="flex flex-wrap gap-2">
          {[['all', 'Todas'], ['income', 'Receitas'], ['expense', 'Despesas']].map(([id, label]) => <button key={id} className={`btn-ghost text-sm ${filter === id && !trash ? 'bg-[#111d2f] text-white dark:bg-[#b9e65f] dark:text-[#111d2f]' : ''}`} onClick={() => { setFilter(id); setTrash(false) }}>{label}</button>)}
          <button className={`btn-ghost text-sm ${trash ? 'bg-[#ffd8cd] text-[#7d2c1c]' : ''}`} onClick={() => setTrash(!trash)}><Trash2 size={15} /> Excluídas</button>
        </div>
      </div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-2">
          {[['month', `Mês (${monthLabel(month, { month: 'short', year: '2-digit' })})`], ['all', 'Tudo'], ['custom', 'Período']].map(([id, label]) => <button key={id} className={`btn-ghost text-sm capitalize ${period === id ? 'bg-[#b9e65f]/30' : ''}`} onClick={() => setPeriod(id)}>{label}</button>)}
        </div>
        {period === 'custom' && <div className="flex items-center gap-2 text-sm"><input type="date" className="input !py-2" value={from} onChange={e => setFrom(e.target.value)} aria-label="De" /><span className="subtle">até</span><input type="date" className="input !py-2" value={to} onChange={e => setTo(e.target.value)} aria-label="Até" /></div>}
        <div className="subtle text-xs sm:ml-auto">{visible.length} resultado(s) · Receitas <strong className="text-[#668629] dark:text-[#b9e65f]">{money.format(totals.inc)}</strong> · Despesas <strong>{money.format(totals.exp)}</strong> · Saldo <strong>{money.format(totals.bal)}</strong></div>
      </div>
      {visible.length ? <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left">
        <thead><tr className="subtle border-b border-black/10 text-[11px] uppercase tracking-[.14em] dark:border-white/10"><th className="px-3 py-3">Movimentação</th><th className="px-3 py-3">Categoria</th><th className="px-3 py-3">Data</th><th className="px-3 py-3 text-right">Valor</th><th className="px-3 py-3 text-right">Ação</th></tr></thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/5">{visible.map(t => <tr key={t.id} className="group hover:bg-black/[.025] dark:hover:bg-white/[.025]">
          <td className="px-3 py-4"><div className="flex items-center gap-3"><span className={`grid h-9 w-9 place-items-center rounded-xl ${t.type === 'income' ? 'bg-[#b9e65f]/25 text-[#68872b]' : 'bg-[#ffd8cd] text-[#9c3d29]'}`}>{t.type === 'income' ? <TrendingUp size={17} /> : <TrendingDown size={17} />}</span><div><p className="text-sm font-bold">{t.description}</p><p className="subtle text-xs">{t.type === 'income' ? 'Receita' : 'Despesa'}{t.sourceKey ? ' · automática' : ''}</p></div></div></td>
          <td className="px-3 py-4 text-sm">{t.category}</td><td className="subtle px-3 py-4 text-sm">{formatDate(t.date)}</td>
          <td className={`px-3 py-4 text-right text-sm font-bold ${t.type === 'income' ? 'text-[#668629] dark:text-[#b9e65f]' : ''}`}>{t.type === 'income' ? '+' : '-'} {money.format(t.amount)}</td>
          <td className="px-3 py-4 text-right"><div className="flex justify-end gap-1">
            {trash ? <>
              <button onClick={() => onRestore(t.id)} className="btn-ghost p-2" title="Restaurar"><RotateCcw size={16} /></button>
              <button onClick={() => purge(t)} className="btn-ghost p-2 text-red-500" title="Excluir definitivamente"><XCircle size={16} /></button>
            </> : <>
              <button onClick={() => onEdit(t)} className="btn-ghost p-2" title="Editar"><Pencil size={16} /></button>
              <button onClick={() => onDelete(t)} className="btn-ghost p-2" title="Excluir"><Trash2 size={16} /></button>
            </>}
          </div></td>
        </tr>)}</tbody>
      </table></div> : <EmptyState icon={trash ? Trash2 : Search} title={trash ? 'Lixeira vazia' : 'Nada encontrado'} text={trash ? 'As transações excluídas aparecerão aqui.' : 'Tente alterar os filtros ou cadastre uma transação.'} />}
    </section>
  </div>
}
