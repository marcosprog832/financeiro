import { createClient } from '@supabase/supabase-js'
import { todayInZone, addDaysISO, dueReminders, buildEmail } from '../src/lib/reminders.js'

const send = (res, status, body) => res.status(status).json(body)

function admin() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY nas variáveis da Vercel.')
  return createClient(url, key, { auth: { persistSession: false } })
}

async function sendEmail({ to, subject, text, html }) {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Configure RESEND_API_KEY nas variáveis da Vercel.')
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Fluxo <onboarding@resend.dev>', to: [to], subject, text, html }),
  })
  if (!r.ok) throw new Error(`O serviço de e-mail recusou o envio (${r.status}): ${(await r.text()).slice(0, 300)}`)
}

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data }

export default async function handler(req, res) {
  try {
    const sb = admin()
    const settings = must(await sb.from('notification_settings').select('*').eq('user_id', 'owner').maybeSingle())

    // Botão "Enviar e-mail de teste" do app
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
      if (!body.test) return send(res, 400, { error: 'Requisição inválida.' })
      if (!settings?.email) return send(res, 422, { error: 'Salve um e-mail antes de enviar o teste.' })
      if (settings.last_test_at && Date.now() - new Date(settings.last_test_at).getTime() < 60000) return send(res, 429, { error: 'Aguarde 1 minuto para testar de novo.' })
      const dueDate = addDaysISO(todayInZone(), settings.days_before)
      await sendEmail({ to: settings.email, ...buildEmail({ name: settings.name, daysBefore: settings.days_before, items: [{ kind: 'bill', name: 'Conta de exemplo', amount: 123.45, dueDate }] }) })
      must(await sb.from('notification_settings').update({ last_test_at: new Date().toISOString() }).eq('user_id', 'owner'))
      return send(res, 200, { ok: true, to: settings.email })
    }

    // Execução diária (agendador da Vercel)
    if (req.method !== 'GET') return send(res, 405, { error: 'Método não permitido.' })
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) return send(res, 401, { error: 'Não autorizado.' })
    if (!settings?.enabled || !settings.email) return send(res, 200, { sent: 0, reason: 'avisos desativados' })

    const today = todayInZone()
    const ym = addDaysISO(today, settings.days_before).slice(0, 7)
    const [bills, billPayments, debts, debtPayments, log] = await Promise.all([
      sb.from('recurring_bills').select('*').then(must),
      sb.from('recurring_bill_payments').select('bill_id, reference_month').eq('reference_month', ym).then(must),
      sb.from('debts').select('*').then(must),
      sb.from('debt_payments').select('debt_id, payment_date').gte('payment_date', `${ym}-01`).then(must),
      sb.from('reminder_log').select('reminder_key').like('reminder_key', `%:${ym}:%`).then(must),
    ])
    const items = dueReminders({ today, daysBefore: settings.days_before, bills, billPayments, debts, debtPayments, sentKeys: log.map(l => l.reminder_key) })
    if (!items.length) return send(res, 200, { sent: 0, reason: 'nada vence na data' })

    await sendEmail({ to: settings.email, ...buildEmail({ name: settings.name, daysBefore: settings.days_before, items }) })
    must(await sb.from('reminder_log').insert(items.map(i => ({ reminder_key: i.key, email: settings.email }))))
    return send(res, 200, { sent: items.length })
  } catch (e) {
    console.error('reminders:', e.message)
    return send(res, 500, { error: e.message })
  }
}
