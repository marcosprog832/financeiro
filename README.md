# Fluxo — Finanças Pessoais

React + Vite + Tailwind, com banco de dados no **Supabase**.

## Rodar localmente
```bash
npm install
cp .env.example .env      # preencha com a URL e a chave anon do Supabase
npm run dev
npm test                  # testes automáticos (lógica, páginas e serviço de dados)
```

## Configurar o Supabase
1. Crie o projeto em supabase.com.
2. **SQL Editor** → cole `supabase/schema.sql` → **Run**.
   Serve para banco novo **e** para o banco que você já tem (não apaga dados). **Rode de novo nesta versão**: ela cria
   as funções de pagamento, orçamentos e lançamentos fixos.
3. **Project Settings > API**: copie a *Project URL* e a chave *anon public* para o `.env`.

## Publicar na Vercel
Settings > Environment Variables: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, depois **Redeploy**.

## O que o sistema faz
- **Visão geral** por mês, com gráfico de evolução (6 meses), gastos por categoria e alertas de orçamento.
- **Seletor de mês** em todas as telas (ver meses passados e futuros).
- **Transações**: criar, editar, excluir (com *Desfazer*), lixeira, exclusão definitiva, busca, filtro por mês/período e exportação CSV.
- **Dívidas**: pagar parcelas (uma ou várias). O pagamento agora **vira despesa** em Transações e tudo é gravado de forma atômica.
- **Contas mensais**: checklist por mês; marcar/desmarcar como paga cria/remove a despesa sem duplicar.
- **Orçamentos** por categoria com aviso a partir de 80%.
- **Lançamentos fixos** (ex.: salário): entram sozinhos no dia do mês.
- **Dados & backup**: backup JSON, exportar CSV e importar CSV (modelo incluso).
- Valores calculados em centavos (sem erro de arredondamento), atualização instantânea na tela, tempo real entre aparelhos, avisos em vez de faixa de erro, "hoje" que se atualiza sozinho.
- **App instalável** (PWA): no celular, "Adicionar à tela inicial".

## Avisos por e-mail (opcional)
Manda um e-mail antes de contas mensais e parcelas de dívidas vencerem (ex.: dia 09 para vencimento dia 10).
1. Rode o `supabase/schema.sql` de novo (cria as tabelas de avisos).
2. Crie conta grátis em resend.com **com o mesmo e-mail que vai receber os avisos** e gere uma API key.
3. Na Vercel (Settings > Environment Variables) crie: `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (Supabase > Project Settings > API > *service_role*, **segredo**) e `CRON_SECRET` (qualquer texto longo). Faça Redeploy.
4. No app, menu **Avisos por e-mail**: preencha nome, e-mail, antecedência, ative e clique em *Enviar e-mail de teste*.
O envio roda todo dia às 8h (Cuiabá) no site publicado. O botão de teste só funciona publicado na Vercel.

## Se aparecer "Não foi possível conectar ao banco de dados"
A mensagem traz o motivo: variáveis ausentes, projeto pausado, tabelas/funções não criadas (rode o schema.sql) ou RLS.

## Estrutura
```
src/
  pages/        telas (Dashboard, Transactions, Debts, MonthlyBills, Budgets, RecurringTx, Tools)
  components/   ui.jsx (modal, avisos, confirmação) e forms.jsx
  lib/          regras puras testáveis (finance, format, csv)
  dataService.js  acesso ao Supabase     supabase/schema.sql  banco
```

## Segurança
Ainda não há login. Com as políticas atuais, qualquer pessoa com o site pode ler e gravar. Não use dados reais em URL pública até adicionar Supabase Auth.
