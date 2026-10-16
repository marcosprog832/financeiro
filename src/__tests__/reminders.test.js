import { describe, it, expect, vi, beforeEach } from 'vitest'
import { dueReminders, buildEmail, addDaysISO, todayInZone } from '../lib/reminders'

const bills = [{ id: 1, name: 'Aluguel', amount: 1650, due_day: 10 }, { id: 2, name: 'Internet', amount: 120, due_day: 12 }]
const debts = [{ id: 7, name: 'Notebook', current_installment_value: 400, due_day: 10, installment_count: 12, paid_installments: 5 }, { id: 8, name: 'Quitada', current_installment_value: 1, due_day: 10, installment_count: 3, paid_installments: 3 }]

describe('regras de aviso', () => {
  it('fuso e datas', () => {
    expect(todayInZone('America/Cuiaba', new Date('2026-10-10T02:00:00Z'))).toBe('2026-10-09') // 22h do dia 9 em Cuiabá
    expect(addDaysISO('2026-10-31', 1)).toBe('2026-11-01')
  })
  it('avisa 1 dia antes: conta e parcela do dia 10', () => {
    const items = dueReminders({ today: '2026-10-09', daysBefore: 1, bills, debts })
    expect(items.map(i => i.key)).toEqual(['bill:1:2026-10:d1', 'debt:7:2026-10:d1'])
  })
  it('não avisa se já pagou, nem repete aviso enviado', () => {
    const paid = dueReminders({ today: '2026-10-09', daysBefore: 1, bills, debts, billPayments: [{ bill_id: 1, reference_month: '2026-10' }], debtPayments: [{ debt_id: 7, payment_date: '2026-10-03' }] })
    expect(paid).toEqual([])
    expect(dueReminders({ today: '2026-10-09', daysBefore: 1, bills, debts, sentKeys: ['bill:1:2026-10:d1'] }).map(i => i.key)).toEqual(['debt:7:2026-10:d1'])
  })
  it('vencimento 31 em mês curto cai no último dia; vira o mês certo', () => {
    const items = dueReminders({ today: '2026-02-27', daysBefore: 1, bills: [{ id: 3, name: 'X', amount: 1, due_day: 31 }] })
    expect(items[0].dueDate).toBe('2026-02-28')
    expect(dueReminders({ today: '2026-10-31', daysBefore: 1, bills: [{ id: 4, name: 'Y', amount: 1, due_day: 1 }] })[0].dueDate).toBe('2026-11-01')
  })
  it('mensagem no formato pedido', () => {
    const m = buildEmail({ name: 'Marcos', daysBefore: 1, items: [{ kind: 'bill', name: 'Aluguel', amount: 1650, dueDate: '2026-10-10' }] })
    expect(m.text).toBe('Olá Marcos, sua conta "Aluguel" do dia 10/10/2026 no valor de R$\u00a01.650,00 vence amanhã. Se programe para efetuar o pagamento.')
    expect(m.subject).toBe('Lembrete: Aluguel vence amanhã')
    const many = buildEmail({ name: '', daysBefore: 0, items: [{ kind: 'bill', name: '<b>', amount: 1, dueDate: '2026-10-10' }, { kind: 'debt', name: 'N', amount: 2, dueDate: '2026-10-10' }] })
    expect(many.subject).toContain('2 pagamentos vencem hoje'); expect(many.html).toContain('&lt;b&gt;')
  })
})

// --- handler com Supabase e Resend simulados ---
const tables = {}
const inserted = []
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: table => {
    const state = { table }
    const chain = new Proxy({}, { get(_, prop) {
      if (prop === 'then') return res => Promise.resolve({ data: tables[table] ?? [], error: null }).then(res)
      if (prop === 'maybeSingle') return () => Promise.resolve({ data: (tables[table] || [])[0] ?? null, error: null })
      if (prop === 'insert') return rows => { inserted.push(...rows); return Promise.resolve({ data: null, error: null }) }
      return () => chain
    } })
    return chain
  } }),
}))
const mockRes = () => { const r = { code: 0, body: null, status(c) { r.code = c; return r }, json(b) { r.body = b; return r } }; return r }

describe('api/reminders', () => {
  beforeEach(() => {
    Object.assign(process.env, { SUPABASE_URL: 'http://x', SUPABASE_SERVICE_ROLE_KEY: 'k', RESEND_API_KEY: 'r', CRON_SECRET: 's' })
    inserted.length = 0
    tables.notification_settings = [{ name: 'Marcos', email: 'm@x.com', enabled: true, days_before: 1 }]
    global.fetch = vi.fn(async () => ({ ok: true, text: async () => '' }))
  })
  it('recusa chamada sem segredo do agendador', async () => {
    const { default: handler } = await import('../../api/reminders.js'); const res = mockRes()
    await handler({ method: 'GET', headers: {} }, res); expect(res.code).toBe(401)
  })
  it('envia e registra o que venceu amanhã', async () => {
    const { default: handler } = await import('../../api/reminders.js')
    const tomorrow = addDaysISO(todayInZone(), 1)
    tables.recurring_bills = [{ id: 1, name: 'Aluguel', amount: 100, due_day: Number(tomorrow.slice(8)) }]
    const res = mockRes(); await handler({ method: 'GET', headers: { authorization: 'Bearer s' } }, res)
    expect(res.body).toEqual({ sent: 1 })
    const sent = JSON.parse(global.fetch.mock.calls[0][1].body)
    expect(sent.to).toEqual(['m@x.com']); expect(sent.subject).toContain('Aluguel')
    expect(inserted[0].reminder_key).toContain('bill:1:')
  })
  it('teste manual envia e-mail de exemplo', async () => {
    const { default: handler } = await import('../../api/reminders.js'); const res = mockRes()
    await handler({ method: 'POST', body: { test: true }, headers: {} }, res)
    expect(res.body).toEqual({ ok: true, to: 'm@x.com' }); expect(global.fetch).toHaveBeenCalledOnce()
  })
})
