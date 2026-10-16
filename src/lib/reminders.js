// Regras puras dos avisos por e-mail (usadas pelo servidor e testadas aqui).
import { dueDateOf } from './format.js'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const num = v => Number(v ?? 0)

// Data de "hoje" no fuso do usuário (Sorriso-MT = America/Cuiaba), no formato AAAA-MM-DD.
export const todayInZone = (tz = 'America/Cuiaba', now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)

export const addDaysISO = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export const whenText = n => (n <= 0 ? 'hoje' : n === 1 ? 'amanhã' : `em ${n} dias`)
const fmtDate = iso => iso.split('-').reverse().join('/')
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

// Quais contas/parcelas vencem exatamente em (hoje + daysBefore) e ainda não foram pagas nem avisadas.
export function dueReminders({ today, daysBefore, bills = [], billPayments = [], debts = [], debtPayments = [], sentKeys = [] }) {
  const target = addDaysISO(today, daysBefore)
  const ym = target.slice(0, 7)
  const sent = new Set(sentKeys)
  const items = []
  for (const b of bills) {
    if (dueDateOf(ym, b.due_day) !== target) continue
    if (billPayments.some(p => num(p.bill_id) === num(b.id) && p.reference_month === ym)) continue
    items.push({ key: `bill:${b.id}:${ym}:d${daysBefore}`, kind: 'bill', name: b.name, amount: num(b.amount), dueDate: target })
  }
  for (const d of debts) {
    if (num(d.paid_installments) >= num(d.installment_count)) continue
    if (dueDateOf(ym, d.due_day) !== target) continue
    if (debtPayments.some(p => num(p.debt_id) === num(d.id) && String(p.payment_date).startsWith(ym))) continue
    items.push({ key: `debt:${d.id}:${ym}:d${daysBefore}`, kind: 'debt', name: d.name, amount: num(d.current_installment_value), dueDate: target })
  }
  return items.filter(i => !sent.has(i.key))
}

export function buildEmail({ name, items, daysBefore }) {
  const hello = name?.trim() ? `Olá ${name.trim()}` : 'Olá'
  const when = whenText(daysBefore)
  const line = i => `${i.kind === 'debt' ? 'parcela' : 'conta'} "${i.name}" do dia ${fmtDate(i.dueDate)} no valor de ${BRL.format(i.amount)}`
  const subject = items.length === 1 ? `Lembrete: ${items[0].name} vence ${when}` : `Lembrete: ${items.length} pagamentos vencem ${when}`
  let text, body
  if (items.length === 1) {
    text = `${hello}, sua ${line(items[0])} vence ${when}. Se programe para efetuar o pagamento.`
    body = `<p>${esc(hello)}, sua ${esc(line(items[0]))} vence <strong>${when}</strong>.</p><p>Se programe para efetuar o pagamento.</p>`
  } else {
    text = `${hello}, estes pagamentos vencem ${when}:\n\n${items.map(i => `• ${line(i)}`).join('\n')}\n\nSe programe para efetuar os pagamentos.`
    body = `<p>${esc(hello)}, estes pagamentos vencem <strong>${when}</strong>:</p><ul>${items.map(i => `<li>${esc(line(i))}</li>`).join('')}</ul><p>Se programe para efetuar os pagamentos.</p>`
  }
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#172033;line-height:1.5">${body}<p style="color:#8a8f98;font-size:12px">Aviso automático do Fluxo — Finanças pessoais.</p></div>`
  return { subject, text, html }
}
