export const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// Dinheiro é calculado em centavos (inteiros) para nunca ter erro de arredondamento.
export const toCents = v => Math.round((Number(String(v ?? 0).replace(',', '.')) || 0) * 100)
export const fromCents = c => c / 100
export const round2 = v => fromCents(toCents(v))

export const pad = n => String(n).padStart(2, '0')
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const monthOf = iso => String(iso).slice(0, 7)
export const formatDate = v => new Date(`${v}T12:00:00`).toLocaleDateString('pt-BR')
export const daysInMonth = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate() }
export const dueDateOf = (ym, day) => `${ym}-${pad(Math.min(Number(day) || 1, daysInMonth(ym)))}`
export const addMonths = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
export const monthLabel = (ym, opts = { month: 'long', year: 'numeric' }) =>
  new Intl.DateTimeFormat('pt-BR', opts).format(new Date(`${ym}-01T12:00:00`))
