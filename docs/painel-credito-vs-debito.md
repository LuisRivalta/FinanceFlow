# Painel: crédito, débito e fatura

**Arquivos:** `src/app/page.jsx` (dashboard), `src/helpers.js`, `src/lib/cardMetrics.js`

## O problema

Uma compra no cartão aparecia em dois cards ao mesmo tempo — em "Despesas Gerais" do mês da compra e na "Fatura" do mês do vencimento — sem nada explicando a relação. O caso concreto: `Lazarella`, R$ 292,90 em 07/08. O C6 fecha dia 4, então a compra entra na fatura que vence em 10/09. Os dois números estavam certos, mas contavam a mesma coisa em lugares diferentes.

## As três leituras, que não se sobrepõem

| Card | O que soma | Filtro |
| --- | --- | --- |
| **Despesas no Débito** | saiu da conta na hora: pix, débito, dinheiro | `isSpending(t) && t.account !== 'credit'` |
| **Gastos no Crédito** | compras no cartão feitas no mês (competência) | `isSpending(t) && t.account === 'credit'` |
| **Fatura do Mês** | o ciclo fechado no mês, com quanto já foi pago | `getCardInvoiceBreakdown` por `inv.key` |

`isSpending` (em `helpers.js`) exclui `invoice_payment`: o pagamento da fatura não é gasto novo, ele quita compras que já entraram em "Gastos no Crédito". É por isso que o pagamento não aparece em nenhum dos dois cards de gasto — ele aparece como quitação no card de fatura e reduz o Saldo Livre.

Cada lançamento cai em exatamente um dos três. O termômetro mostra a soma (débito + crédito) e a rosca de categorias também, ambos rotulados como tal.

## Competência x fatura

"Gastos no Crédito" é por **data da compra** — responde "quanto torrei no cartão em agosto". A fatura é por **ciclo de fechamento** — responde "quanto vou pagar". São perguntas diferentes sobre as mesmas compras, e o card de crédito diz em qual fatura elas caem ("Fecha nas faturas de Agosto e Setembro"), calculado com `getInvoiceKey(t.date, card.closing_day)`.

## Fatura paga continua visível

O card mostra o **total do ciclo** (`selectedInvoiceTotal`), não o saldo em aberto. Quitada, ela fica verde com "Paga" em vez de virar R$ 0,00 — dá para navegar pelos meses e ver quanto o cartão custou em cada um.

O `remaining` de `getCardInvoiceBreakdown` é arredondado em centavos: somar valores em float deixa resíduo (`3259.13 + 34.19 + … − 3577.12 = 4.5e-13`) e a fatura quitada ficava marcada como pendente para sempre.
