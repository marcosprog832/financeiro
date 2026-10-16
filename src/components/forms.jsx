import { useState } from 'react'
import { Check, TrendingDown, TrendingUp } from 'lucide-react'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../lib/categories'

const Field = ({ label, children }) => <label className="block"><span className="mb-2 block text-xs font-bold">{label}</span>{children}</label>

export function TransactionForm({ initial, onSave, onClose, today }) {
  const [form, setForm] = useState(initial ? { ...initial, amount: String(initial.amount) } : { type: 'expense', description: '', category: 'Alimentação', amount: '', date: today })
  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const list = categories.includes(form.category) ? categories : [form.category, ...categories]
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const submit = e => {
    e.preventDefault()
    if (!form.description.trim() || Number(form.amount) <= 0) return
    onSave({ ...form, amount: Number(form.amount) }); onClose()
  }
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/5 p-1 dark:bg-white/5">{[['expense', 'Despesa', TrendingDown], ['income', 'Receita', TrendingUp]].map(([id, label, Icon]) => <button type="button" key={id} onClick={() => setForm(f => ({ ...f, type: id, category: id === 'income' ? 'Trabalho' : 'Alimentação' }))} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${form.type === id ? (id === 'income' ? 'bg-[#b9e65f] text-[#111d2f]' : 'bg-[#ff8b6b] text-[#3a130a]') : ''}`}><Icon size={17} />{label}</button>)}</div>
    <Field label="Descrição"><input autoFocus className="input" value={form.description} onChange={e => update('description', e.target.value)} placeholder="Ex.: Supermercado" required /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Valor"><input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} placeholder="0,00" required /></Field>
      <Field label="Data"><input className="input" type="date" value={form.date} onChange={e => update('date', e.target.value)} required /></Field>
    </div>
    <Field label="Categoria"><select className="input" value={form.category} onChange={e => update('category', e.target.value)}>{list.map(c => <option key={c}>{c}</option>)}</select></Field>
    <button className="btn-primary mt-2 w-full" type="submit"><Check size={18} /> {initial ? 'Salvar alterações' : 'Salvar transação'}</button>
  </form>
}

export function BudgetForm({ initial, usedCategories = [], onSave, onClose }) {
  const free = EXPENSE_CATEGORIES.filter(c => !usedCategories.includes(c) || c === initial?.category)
  const isEdit = Boolean(initial?.id)
  const [form, setForm] = useState({ category: initial?.category || free[0] || 'Outros', limit: initial?.limit ? String(initial.limit) : '' })
  const submit = e => { e.preventDefault(); if (Number(form.limit) <= 0) return; onSave({ category: form.category, limit: Number(form.limit) }); onClose() }
  return <form onSubmit={submit} className="space-y-4">
    <Field label="Categoria"><select className="input" disabled={isEdit} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>{(isEdit ? [initial.category] : free).map(c => <option key={c}>{c}</option>)}</select></Field>
    <Field label="Limite mensal"><input autoFocus className="input" type="number" min="0.01" step="0.01" value={form.limit} onChange={e => setForm(f => ({ ...f, limit: e.target.value }))} placeholder="0,00" required /></Field>
    <div className="rounded-2xl bg-[#d9e7ff] p-4 text-xs leading-relaxed text-[#19365e]">Você será avisado na Visão geral quando os gastos da categoria passarem de 80% do limite.</div>
    <button className="btn-primary w-full" type="submit"><Check size={18} /> Salvar orçamento</button>
  </form>
}

export function RecurringTxForm({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial ? { ...initial, amount: String(initial.amount), day: String(initial.day) } : { type: 'income', description: '', category: 'Trabalho', amount: '', day: '5', active: true })
  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const update = (key, value) => setForm(f => ({ ...f, [key]: value }))
  const submit = e => {
    e.preventDefault()
    if (!form.description.trim() || Number(form.amount) <= 0) return
    onSave({ ...form, amount: Number(form.amount), day: Number(form.day) }); onClose()
  }
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/5 p-1 dark:bg-white/5">{[['income', 'Receita', TrendingUp], ['expense', 'Despesa', TrendingDown]].map(([id, label, Icon]) => <button type="button" key={id} onClick={() => setForm(f => ({ ...f, type: id, category: id === 'income' ? 'Trabalho' : 'Contas' }))} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold ${form.type === id ? (id === 'income' ? 'bg-[#b9e65f] text-[#111d2f]' : 'bg-[#ff8b6b] text-[#3a130a]') : ''}`}><Icon size={17} />{label}</button>)}</div>
    <Field label="Descrição"><input autoFocus className="input" value={form.description} onChange={e => update('description', e.target.value)} placeholder="Ex.: Salário" required /></Field>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Valor"><input className="input" type="number" min="0.01" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} placeholder="0,00" required /></Field>
      <Field label="Dia do mês"><input className="input" type="number" min="1" max="31" value={form.day} onChange={e => update('day', e.target.value)} required /></Field>
    </div>
    <Field label="Categoria"><select className="input" value={form.category} onChange={e => update('category', e.target.value)}>{categories.map(c => <option key={c}>{c}</option>)}</select></Field>
    <div className="rounded-2xl bg-[#d9e7ff] p-4 text-xs leading-relaxed text-[#19365e]">No dia escolhido, o lançamento entra sozinho em <strong>Transações</strong> (uma vez por mês). Em meses curtos, usa o último dia.</div>
    <button className="btn-primary w-full" type="submit"><Check size={18} /> {initial ? 'Salvar alterações' : 'Criar lançamento fixo'}</button>
  </form>
}
