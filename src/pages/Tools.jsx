import { useRef, useState } from 'react'
import { Download, Upload, FileJson, FileSpreadsheet, Check, AlertCircle } from 'lucide-react'
import { PageHeader, useConfirm, useToast } from '../components/ui'
import { download } from '../lib/download'
import { toCSV, transactionsToCSV, parseTransactionsCSV } from '../lib/csv'
import { isoDate } from '../lib/format'

export default function Tools({ data, onImport }) {
  const confirm = useConfirm()
  const { push } = useToast()
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const stamp = isoDate(new Date())

  const backup = () => { download(`fluxo-backup-${stamp}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2), 'application/json'); push('Backup baixado.') }
  const exportAll = () => download(`fluxo-transacoes-${stamp}.csv`, transactionsToCSV(data.transactions.filter(t => !t.deletedAt)), 'text/csv;charset=utf-8')
  const template = () => download('modelo-importacao.csv', toCSV(['tipo', 'descricao', 'categoria', 'valor', 'data'], [['despesa', 'Supermercado', 'Alimentação', '150,90', '2026-10-05'], ['receita', 'Salário', 'Trabalho', '5800,00', '05/10/2026']]), 'text/csv;charset=utf-8')

  const pick = async e => {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setPreview({ name: file.name, ...parseTransactionsCSV(await file.text()) })
  }
  const confirmImport = async () => {
    if (!preview?.valid.length) return
    if (await confirm({ title: 'Importar transações?', text: `${preview.valid.length} transação(ões) serão adicionadas. Linhas já existentes não são detectadas — importe o mesmo arquivo uma vez só.`, confirmLabel: 'Importar', danger: false })) {
      const ok = await onImport(preview.valid); if (ok) setPreview(null)
    }
  }

  const Card = ({ icon: Icon, title, text, children }) => <article className="card rounded-[28px] p-6">
    <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-[#111d2f] text-[#b9e65f] dark:bg-[#b9e65f] dark:text-[#111d2f]"><Icon size={20} /></span>
    <h2 className="display text-lg font-bold">{title}</h2><p className="subtle mb-4 mt-1 text-sm">{text}</p>{children}
  </article>

  return <div className="space-y-6">
    <PageHeader eyebrow="Seus dados" title="Dados & backup" subtitle="Leve seus dados com você ou traga de outro lugar." />
    <section className="grid gap-4 xl:grid-cols-3">
      <Card icon={FileJson} title="Backup completo" text="Baixa tudo (transações, dívidas, contas, orçamentos e lançamentos fixos) em um arquivo JSON."><button className="btn-primary w-full" onClick={backup}><Download size={18} /> Baixar backup</button></Card>
      <Card icon={FileSpreadsheet} title="Exportar para planilha" text="Todas as transações em CSV, que abre direto no Excel ou Google Planilhas."><button className="btn-ghost w-full" onClick={exportAll}><Download size={18} /> Exportar transações</button></Card>
      <Card icon={Upload} title="Importar transações" text="Traga um extrato em CSV com as colunas: tipo, descricao, categoria, valor, data.">
        <div className="flex gap-2"><button className="btn-primary flex-1" onClick={() => fileRef.current?.click()}><Upload size={18} /> Escolher arquivo</button><button className="btn-ghost" onClick={template}>Modelo</button></div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={pick} />
      </Card>
    </section>
    {preview && <section className="card rounded-[28px] p-6">
      <h2 className="display text-lg font-bold">Prévia de {preview.name}</h2>
      <p className="mt-1 flex items-center gap-2 text-sm"><Check size={16} className="text-[#638124]" /> {preview.valid.length} linha(s) válida(s)
        {preview.errors.length > 0 && <span className="ml-3 flex items-center gap-2 text-[#a1412c]"><AlertCircle size={16} /> {preview.errors.length} com problema</span>}</p>
      {preview.errors.length > 0 && <ul className="subtle mt-3 max-h-40 list-disc overflow-y-auto pl-5 text-xs">{preview.errors.slice(0, 20).map((er, i) => <li key={i}>Linha {er.line}: {er.message}</li>)}</ul>}
      <div className="mt-5 flex gap-3"><button className="btn-primary" disabled={!preview.valid.length} onClick={confirmImport}><Check size={18} /> Importar {preview.valid.length}</button><button className="btn-ghost" onClick={() => setPreview(null)}>Cancelar</button></div>
    </section>}
  </div>
}
