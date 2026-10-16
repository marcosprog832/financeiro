import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { X, Check, AlertCircle, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { monthLabel } from '../lib/format'

export function Modal({ title, subtitle, onClose, children }) {
  useEffect(() => {
    const close = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#07101d]/70 p-4 backdrop-blur-sm" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" className="card modal-in max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-[28px] p-6 md:p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div><h2 className="display text-2xl font-bold">{title}</h2><p className="subtle mt-1 text-sm">{subtitle}</p></div>
        <button className="btn-ghost p-2" onClick={onClose} aria-label="Fechar"><X size={19} /></button>
      </div>
      {children}
    </div>
  </div>
}

export function StatCard({ label, value, icon: Icon, tone, note, delay = 0 }) {
  const tones = { lime: 'bg-[#b9e65f] text-[#111d2f]', blue: 'bg-[#d9e7ff] text-[#19365e]', coral: 'bg-[#ffd8cd] text-[#7d2c1c]', dark: 'bg-[#111d2f] text-white' }
  return <article className="card fade-up rounded-[24px] p-5" style={{ animationDelay: `${delay}ms` }}>
    <div className="mb-5 flex items-center justify-between">
      <span className={`grid h-10 w-10 place-items-center rounded-2xl ${tones[tone]}`}><Icon size={19} /></span>
      <span className="subtle text-[11px] font-bold uppercase tracking-[.16em]">{label}</span>
    </div>
    <p className="display text-[clamp(1.45rem,2vw,2rem)] font-bold tracking-tight">{value}</p>
    <p className="subtle mt-2 text-xs">{note}</p>
  </article>
}

export function EmptyState({ icon: Icon, title, text }) {
  return <div className="grid place-items-center px-5 py-16 text-center">
    <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#b9e65f]/20 text-[#6d8c31]"><Icon /></div>
    <h3 className="display font-bold">{title}</h3><p className="subtle mt-1 max-w-xs text-sm">{text}</p>
  </div>
}

export function PageHeader({ eyebrow, title, subtitle, children }) {
  return <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
    <div><p className="mb-2 text-xs font-bold uppercase tracking-[.2em] text-[#6d8c31]">{eyebrow}</p><h1 className="display text-3xl font-bold md:text-4xl">{title}</h1>{subtitle && <p className="subtle mt-1">{subtitle}</p>}</div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </header>
}

export function MonthPicker({ month, currentMonth, onChange, shift }) {
  return <div className="flex items-center gap-2">
    <div className="card flex items-center rounded-2xl">
      <button className="btn-ghost p-2.5" onClick={() => onChange(shift(month, -1))} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
      <span className="display min-w-[9.5rem] px-2 text-center text-sm font-bold capitalize">{monthLabel(month)}</span>
      <button className="btn-ghost p-2.5" onClick={() => onChange(shift(month, 1))} aria-label="Próximo mês"><ChevronRight size={18} /></button>
    </div>
    {month !== currentMonth && <button className="btn-ghost text-sm" onClick={() => onChange(currentMonth)}><CalendarDays size={16} /> Hoje</button>}
  </div>
}

// ---------- Avisos (toasts) ----------
const ToastCtx = createContext({ push: () => {} })
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }) {
  const [items, setItems] = useState([])
  const seq = useRef(0)
  const remove = useCallback(id => setItems(list => list.filter(t => t.id !== id)), [])
  const push = useCallback((message, { type = 'success', action } = {}) => {
    const id = ++seq.current
    setItems(list => [...list, { id, message, type, action }])
    setTimeout(() => remove(id), action ? 7000 : type === 'error' ? 8000 : 3500)
  }, [remove])
  return <ToastCtx.Provider value={{ push }}>
    {children}
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,24rem)] flex-col gap-2">
      {items.map(t => <div key={t.id} role="status" className={`pointer-events-auto modal-in flex items-start gap-3 rounded-2xl p-4 text-sm font-bold shadow-xl ${t.type === 'error' ? 'bg-[#ffd8cd] text-[#7d2c1c]' : 'bg-[#111d2f] text-white'}`}>
        {t.type === 'error' ? <AlertCircle size={18} className="mt-0.5 shrink-0" /> : <Check size={18} className="mt-0.5 shrink-0 text-[#b9e65f]" />}
        <span className="flex-1">{t.message}</span>
        {t.action && <button className="shrink-0 rounded-lg bg-white/15 px-2 py-1 text-xs hover:bg-white/25" onClick={() => { t.action.onClick(); remove(t.id) }}>{t.action.label}</button>}
      </div>)}
    </div>
  </ToastCtx.Provider>
}

// ---------- Confirmação ----------
const ConfirmCtx = createContext(() => Promise.resolve(true))
export const useConfirm = () => useContext(ConfirmCtx)

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null)
  const confirm = useCallback(opts => new Promise(resolve => setState({ ...opts, resolve })), [])
  const close = value => { state.resolve(value); setState(null) }
  return <ConfirmCtx.Provider value={confirm}>
    {children}
    {state && <Modal title={state.title || 'Tem certeza?'} subtitle={state.text} onClose={() => close(false)}>
      <div className="flex gap-3">
        <button className="btn-ghost flex-1" onClick={() => close(false)}>Cancelar</button>
        <button autoFocus className={`flex-1 ${state.danger === false ? 'btn-primary' : 'btn-primary !bg-[#ff8b6b] !text-[#3a130a]'}`} onClick={() => close(true)}>{state.confirmLabel || 'Confirmar'}</button>
      </div>
    </Modal>}
  </ConfirmCtx.Provider>
}
