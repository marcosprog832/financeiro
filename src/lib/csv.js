const SEP = ';'
const esc = v => { const s = String(v ?? ''); return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }

export const toCSV = (headers, rows) => '\uFEFF' + [headers, ...rows].map(r => r.map(esc).join(SEP)).join('\r\n')

export function parseCSV(text) {
  const src = String(text).replace(/^\uFEFF/, '')
  const first = src.split(/\r?\n/)[0] || ''
  const sep = (first.match(/;/g) || []).length >= (first.match(/,/g) || []).length ? ';' : ','
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(c => c.trim() !== '')) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell)
  if (row.some(c => c.trim() !== '')) rows.push(row)
  return rows
}

export const transactionsToCSV = list => toCSV(
  ['tipo', 'descricao', 'categoria', 'valor', 'data'],
  list.map(t => [t.type === 'income' ? 'receita' : 'despesa', t.description, t.category, String(t.amount).replace('.', ','), t.date]),
)

const norm = s => String(s).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function parseAmount(raw) {
  let s = String(raw).replace(/R\$|\s/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : NaN
}

export function parseDate(raw) {
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}

export function parseTransactionsCSV(text) {
  const rows = parseCSV(text)
  const valid = [], errors = []
  if (rows.length < 2) return { valid, errors: [{ line: 1, message: 'Arquivo vazio ou sem linhas de dados.' }] }
  const head = rows[0].map(norm)
  const idx = name => head.indexOf(name)
  const cols = { tipo: idx('tipo'), descricao: idx('descricao'), categoria: idx('categoria'), valor: idx('valor'), data: idx('data') }
  const missing = ['tipo', 'descricao', 'valor', 'data'].filter(k => cols[k] < 0)
  if (missing.length) return { valid, errors: [{ line: 1, message: `Colunas ausentes: ${missing.join(', ')}.` }] }
  rows.slice(1).forEach((r, i) => {
    const line = i + 2
    const t = norm(r[cols.tipo] || '')
    const type = ['receita', 'entrada', 'income'].includes(t) ? 'income' : ['despesa', 'saida', 'expense'].includes(t) ? 'expense' : ''
    const description = (r[cols.descricao] || '').trim()
    const amount = parseAmount(r[cols.valor] || '')
    const date = parseDate(r[cols.data] || '')
    if (!type) return errors.push({ line, message: 'Tipo deve ser receita ou despesa.' })
    if (!description) return errors.push({ line, message: 'Descrição vazia.' })
    if (!(amount > 0)) return errors.push({ line, message: 'Valor inválido.' })
    if (!date) return errors.push({ line, message: 'Data inválida (use AAAA-MM-DD ou DD/MM/AAAA).' })
    valid.push({ type, description, category: (cols.categoria >= 0 && (r[cols.categoria] || '').trim()) || 'Outros', amount, date })
  })
  return { valid, errors }
}
