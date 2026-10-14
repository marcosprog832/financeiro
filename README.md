# Fluxo — Finanças Pessoais

Aplicação React para controlar receitas, despesas, dívidas e pagamentos de parcelas. A versão publicada usa Neon PostgreSQL por meio de uma função serverless da Vercel.

## Recursos

- Dashboard financeiro e compromissos mensais
- Cadastro, exclusão e restauração de transações
- Edição completa de dívidas
- Pagamento de uma ou várias parcelas de uma vez
- Edição do valor pago e do valor da próxima parcela
- Histórico de pagamentos
- Persistência no Neon PostgreSQL
- Tema claro e escuro

## Abrir no VS Code

```bash
npm install
npm run dev
```

No desenvolvimento com Vite, o sistema usa um armazenamento local de prévia. A versão publicada na Vercel usa o banco.

## Publicar na Vercel com Neon

1. Crie um banco PostgreSQL no Neon.
2. Copie a connection string do banco.
3. Envie o projeto a um repositório do GitHub.
4. Importe o repositório na Vercel.
5. Nas variáveis de ambiente da Vercel, crie `DATABASE_URL` com a connection string do Neon.
6. Faça o deploy. As tabelas serão criadas automaticamente no primeiro acesso.

## Segurança

Esta etapa ainda não possui autenticação, conforme decidido durante o desenvolvimento. Não use dados financeiros reais em uma URL pública até que login e controle de acesso sejam adicionados. O banco já contém o campo `user_id`, facilitando essa próxima etapa.
