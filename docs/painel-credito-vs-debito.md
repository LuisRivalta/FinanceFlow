# Painel: crédito, débito e fatura

**Arquivos:** `src/app/page.jsx` (dashboard), `src/helpers.js`, `src/lib/cardMetrics.js`

## O problema

Uma compra no cartão aparecia em "Despesas Gerais" do mês da compra e na "Fatura" do mês do vencimento, sem nada ligando as duas. O caso concreto: `Lazarella`, R$ 292,90 em 07/08. O C6 fecha dia 4, então a compra entra na fatura que vence em 10/09.

A primeira tentativa de conserto foi separar em dois cards — "Gastos no Crédito" (R$ 2.082,38) e "Fatura do Mês" (R$ 4.775,35) — e piorou: dois totais roxos, ambos sobre cartão, discordando entre si. Nos dados reais a fatura de agosto era 93% compra de julho, e das compras de agosto só R$ 317,99 caíam nela.

**São duas linhas do tempo diferentes** — quando você comprou × quando o banco fechou o ciclo — e o painel não consegue exibir as duas sem confundir.

## A decisão: cada frente no seu próprio calendário

Contar o cartão por mês de calendário mantinha a divergência: em agosto o painel dizia R$ 2.082,38 enquanto a fatura a pagar era R$ 1.764,39, porque as compras de 01 a 03/08 já tinham entrado na fatura fechada em 04/08.

O cartão passa a ser lido pelo **ciclo de fechamento**, que é como o usuário enxerga: num cartão que fecha dia 4, "agosto" vai de 05/08 a 04/09. Assim o card bate com a fatura, sem número intermediário.

| Card | Recorte | Filtro |
| --- | --- | --- |
| **Despesas no Débito** | mês de calendário — sai da conta na hora | `isSpending(t) && t.account !== 'credit'` |
| **Gastos no Crédito** | ciclo aberto no mês (`creditCycle`) | `getInvoiceKey(t.date, closing_day) === cycleKey` |

`cycleKey` é o **mês seguinte** ao exibido: o ciclo aberto em agosto vira a fatura que fecha em setembro. Cada cartão tem seu fechamento, então a filtragem é por cartão. Quando todos os cartões com compra no ciclo têm o mesmo fechamento, o card mostra o intervalo exato (`05/08 a 04/09`); com fechamentos diferentes, mostra só o mês (`ciclos que fecham em setembro`) — um intervalo único mentiria sobre pelo menos um cartão.

`isSpending` (em `helpers.js`) exclui `invoice_payment`: o pagamento da fatura não é gasto novo, quita compras que já entraram em "Gastos no Crédito". Cada lançamento cai em exatamente um dos dois cards. O termômetro e a rosca de categorias mostram a soma, rotulados como tal.

O saldo em aberto das faturas não sumiu do painel: aparece como linha dentro do **Saldo Livre**, que é onde importa — dinheiro comprometido.

### Fatura do mês x atraso

A linha do Saldo Livre mostra a **fatura que vence no mês exibido** (`Fatura de out: −R$ 338,50`), não a soma de tudo que está em aberto. Faturas anteriores ainda pendentes aparecem numa segunda linha (`Anteriores em aberto`) e **só quando o mês exibido é o corrente ou passado**: num mês futuro isso é previsão, e a previsão razoável é que as anteriores sejam pagas em dia.

Sem essa regra, avançar o seletor empilhava faturas — outubro somava setembro + outubro (R$ 2.102,89) e novembro somava três (R$ 2.441,39), como se o usuário fosse ficar inadimplente até lá.

## Pago x a pagar

`creditStatus` (em `page.jsx`) responde "essa fatura já saiu do bolso?" pela fração quitada da fatura do ciclo em cada cartão (`paidAmount / totalExpenses` de `getCardInvoiceBreakdown`):

```
GASTOS NO CRÉDITO — agosto
R$ 1.764,39   (11 compras · ciclos que fecham em setembro)
R$ 1.764,39 a pagar (vence 10/09)
```

Quitado tudo, vira `✓ Tudo já pago`.

## Dois pisos contra resíduo de float

Somar centavos em float deixa sobra (`3259.13 + 34.19 + … − 3577.12 = 4.5e-13`), e sem tolerância isso vira fatura eternamente pendente:

- `getCardInvoiceBreakdown` arredonda `remaining` em centavos — senão a fatura quitada nunca ficava `paid`.
- `creditStatus` só conta uma compra como pendente se faltar `>= 0.01` — senão uma fatura paga entrava na lista de vencimentos e o card anunciava o vencimento errado.
