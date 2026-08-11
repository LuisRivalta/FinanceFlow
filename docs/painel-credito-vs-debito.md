# Painel: crédito, débito e fatura

**Arquivos:** `src/app/page.jsx` (dashboard), `src/helpers.js`, `src/lib/cardMetrics.js`

## O problema

Uma compra no cartão aparecia em "Despesas Gerais" do mês da compra e na "Fatura" do mês do vencimento, sem nada ligando as duas. O caso concreto: `Lazarella`, R$ 292,90 em 07/08. O C6 fecha dia 4, então a compra entra na fatura que vence em 10/09.

A primeira tentativa de conserto foi separar em dois cards — "Gastos no Crédito" (R$ 2.082,38) e "Fatura do Mês" (R$ 4.775,35) — e piorou: dois totais roxos, ambos sobre cartão, discordando entre si. Nos dados reais a fatura de agosto era 93% compra de julho, e das compras de agosto só R$ 317,99 caíam nela.

**São duas linhas do tempo diferentes** — quando você comprou × quando o banco fechou o ciclo — e o painel não consegue exibir as duas sem confundir.

## A decisão: o painel fala do mês da compra

O painel usa **uma linha do tempo só**, a data da compra, que é a que o usuário controla. A fatura por ciclo é assunto da página **Cartões**, onde ela é paga.

| Card | O que soma | Filtro |
| --- | --- | --- |
| **Despesas no Débito** | saiu da conta na hora: pix, débito, dinheiro | `isSpending(t) && t.account !== 'credit'` |
| **Gastos no Crédito** | compras no cartão feitas no mês, com quanto já foi quitado | `isSpending(t) && t.account === 'credit'` |

`isSpending` (em `helpers.js`) exclui `invoice_payment`: o pagamento da fatura não é gasto novo, quita compras que já entraram em "Gastos no Crédito". Cada lançamento cai em exatamente um dos dois cards. O termômetro e a rosca de categorias mostram a soma, rotulados como tal.

O saldo em aberto das faturas não sumiu do painel: aparece como linha dentro do **Saldo Livre** (`Faturas em aberto: −R$ X`), que é onde importa — dinheiro comprometido.

## Pago x a pagar, sem falar em ciclo

`creditStatus` (em `page.jsx`) responde "essas compras já saíram do bolso?" sem exibir o ciclo como um segundo total. Cada compra pertence a uma fatura; a fração já quitada dessa fatura (`paidAmount / totalExpenses` de `getCardInvoiceBreakdown`) diz o quanto daquela compra foi pago:

```
GASTOS NO CRÉDITO — agosto
R$ 2.082,38   (15 compras)
R$ 317,99 pago • R$ 1.764,39 a pagar (vence 10/09)
```

Quitado tudo, vira `✓ Tudo já pago`.

## Dois pisos contra resíduo de float

Somar centavos em float deixa sobra (`3259.13 + 34.19 + … − 3577.12 = 4.5e-13`), e sem tolerância isso vira fatura eternamente pendente:

- `getCardInvoiceBreakdown` arredonda `remaining` em centavos — senão a fatura quitada nunca ficava `paid`.
- `creditStatus` só conta uma compra como pendente se faltar `>= 0.01` — senão uma fatura paga entrava na lista de vencimentos e o card anunciava o vencimento errado.
