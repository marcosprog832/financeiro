import { useEffect, useState } from 'react'
import { Mail, Check, Send, AlertCircle } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { whenText } from '../lib/reminders'

export default function Notifications({ settings, onSave, onTest }) {
  const [form, setForm] = useState(settings || { name: '', email: '', enabled: false, daysBefore: 1 })
  const [testing, setTesting] = useState(false)
  useEffect(() => { if (settings) setForm(settings) }, [settings])
  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (settings === null) return <div className="space-y-6">
    <PageHeader eyebrow="Lembretes" title="Avisos por e-mail" />
    <div className="flex items-start gap-3 rounded-2xl bg-[#ffd8cd] p-5 text-sm font-bold text-[#7d2c1c]"><AlertCircle className="mt-0.5 shrink-0" size={18} />
      <span>A tabela de avisos ainda não existe no banco. Rode o supabase/schema.sql (ou o bloco "Avisos por e-mail") no SQL Editor do Supabase e recarregue.</span></div>
  </div>

  const submit = e => { e.preventDefault(); onSave({ ...form, daysBefore: Number(form.daysBefore) }) }
  const test = async () => { setTesting(true); try { await onSave({ ...form, daysBefore: Number(form.daysBefore) }); await onTest() } finally { setTesting(false) } }
  const when = whenText(Number(form.daysBefore))

  return <div className="space-y-6">
    <PageHeader eyebrow="Lembretes" title="Avisos por e-mail" subtitle="Receba um e-mail antes de uma conta ou parcela vencer." />
    <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
      <form onSubmit={submit} className="card space-y-4 rounded-[28px] p-6">
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-black/[.04] p-4 dark:bg-white/[.04]">
          <span><span className="block text-sm font-bold">Receber avisos</span><span className="subtle text-xs">Um e-mail por dia, só quando houver vencimento.</span></span>
          <input type="checkbox" className="h-5 w-5 accent-[#6d8c31]" checked={form.enabled} onChange={e => update('enabled', e.target.checked)} />
        </label>
        <label className="block"><span className="mb-2 block text-xs font-bold">Seu nome</span><input className="input" value={form.name} onChange={e => update('name', e.target.value)} placeholder="Como devo te chamar?" /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold">E-mail</span><input className="input" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="voce@email.com" /></label>
        <label className="block"><span className="mb-2 block text-xs font-bold">Avisar com quanta antecedência?</span>
          <select className="input" value={form.daysBefore} onChange={e => update('daysBefore', e.target.value)}>
            <option value={0}>No dia do vencimento</option><option value={1}>1 dia antes</option><option value={2}>2 dias antes</option><option value={3}>3 dias antes</option><option value={5}>5 dias antes</option><option value={7}>7 dias antes</option>
          </select></label>
        <div className="flex flex-wrap gap-3 pt-2">
          <button className="btn-primary" type="submit"><Check size={18} /> Salvar</button>
          <button className="btn-ghost" type="button" disabled={testing || !form.email} onClick={test}><Send size={17} /> {testing ? 'Enviando…' : 'Enviar e-mail de teste'}</button>
        </div>
      </form>
      <aside className="card rounded-[28px] p-6">
        <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-[#111d2f] text-[#b9e65f] dark:bg-[#b9e65f] dark:text-[#111d2f]"><Mail size={20} /></span>
        <h2 className="display text-lg font-bold">Como o e-mail vai chegar</h2>
        <p className="mt-4 rounded-2xl bg-black/[.04] p-4 text-sm leading-relaxed dark:bg-white/[.04]">Olá {form.name.trim() || 'fulano'}, sua conta "Aluguel" do dia 10/00/0000 no valor de R$ 1.650,00 vence <strong>{when}</strong>. Se programe para efetuar o pagamento.</p>
        <ul className="subtle mt-4 list-disc space-y-2 pl-5 text-xs leading-relaxed">
          <li>Avisa as <strong>contas mensais</strong> que ainda não foram marcadas como pagas no mês.</li>
          <li>Avisa as <strong>parcelas de dívidas</strong> ativas, no dia de vencimento cadastrado.</li>
          <li>Se várias vencerem no mesmo dia, vão juntas em um único e-mail.</li>
          <li>O envio roda todo dia às 8h (horário de Cuiabá) no site publicado.</li>
        </ul>
      </aside>
    </section>
  </div>
}
