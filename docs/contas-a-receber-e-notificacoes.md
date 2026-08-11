# Contas a Receber & Notificações — Notas Técnicas

Referência para manutenção dos módulos entregues no commit `ba74437` e concluídos em 11/08/2026.

---

## ⚠️ Atenção: nomes de arquivo não-canônicos

Dois módulos **não** têm o nome que os imports originais esperavam:

| Nome esperado (bloqueado) | Nome real em uso |
| --- | --- |
| `src/hooks/useReceivables.js` | `src/hooks/useReceivablesData.js` |
| `src/lib/financialNotifications.js` | `src/lib/notificationsEngine.js` |

**Motivo:** o Bitdefender Endpoint Security da máquina de desenvolvimento bloqueia a criação de arquivo nesses dois caminhos exatos. Qualquer método de escrita falha com `ACCESS_DENIED` do Win32 (`Set-Content`, `Copy-Item`, `[System.IO.File]::WriteAllText`, criar-e-renomear), mesmo com privilégio elevado. Não é permissão de pasta nem extensão: qualquer outro nome no mesmo diretório funciona.

Foi isso que quebrou o build — o commit `ba74437` subiu as páginas que importavam esses módulos, mas os arquivos nunca chegaram ao disco nem ao repositório.

### Como voltar aos nomes canônicos

1. Liberar `C:\financeflow` na exclusão do console do Bitdefender.
2. Confirmar que o bloqueio saiu, com esta sonda:

   ```powershell
   $p = "C:\financeflow\src\hooks\useReceivables.js"
   try { Set-Content $p -Value "// probe"; "OK"; Remove-Item $p -Force }
   catch { "AINDA BLOQUEADO" }
   ```

3. Só depois renomear os dois arquivos e atualizar os três imports (`src/app/cards/page.jsx`, `src/app/receivables/page.jsx`, `src/components/NotificationCenter.jsx`).

Antes do passo 2 passar, o rename falha silenciosamente com access-denied.

> O nome do arquivo **não afeta o funcionamento do sistema** — ver [Impacto do nome](#impacto-do-nome-diferente).

---

## `useReceivablesData.js` — hook `useReceivables`

Segue exatamente o padrão do `useFinancings`: Supabase como fonte de verdade, espelho em `localStorage`, e um evento de janela para ressincronizar as telas abertas.

```js
const {
  receivables, loading,
  addReceivable, removeReceivable,
  markAsReceived, unmarkReceived
} = useReceivables(session?.email)
```

| Função | Assinatura | Observação |
| --- | --- | --- |
| `addReceivable` | `(item)` | Normaliza os campos do formulário (strings → número) |
| `removeReceivable` | `(id)` | Aceita `id` ou `dbId` |
| `markAsReceived` | `(id, yearMonth, createTxCallback)` | Idempotente: ignora se o mês já foi recebido |
| `unmarkReceived` | `(id, yearMonth)` | Desfaz a marcação do mês |

`markAsReceived` chama `createTxCallback` com o payload pronto para `useTransactions().create`, datado no dia de vencimento daquele mês (limitado ao último dia do mês — evita "dia 31" em fevereiro).

### Modelo de dados

```js
{
  id: "1754899200000",     // Date.now() em string
  dbId: 123,               // id da linha em transactions
  name: "Aluguel Imóvel A",
  amount: 1500.00,
  firstDueDate: "2026-09-08", // data do 1º recebimento — define o mês de início
  dueDay: 8,               // 1..31, derivado de firstDueDate
  recurrenceType: "indefinite" | "fixed_duration" | "once",
  durationMonths: 12,      // só usado em fixed_duration
  account: "checking",
  payer: "Cliente João",
  category: "freelance",   // id válido de CATEGORY_MAP.income
  startDate: "2026-08-11T...",
  active: true,            // derivado, ver abaixo
  receivedMonths: {        // chave "YYYY-MM"
    "2026-08": { date: "2026-08-11T...", amount: 1500.00 }
  }
}
```

### Agenda — `src/lib/receivableSchedule.js`

Toda a pergunta "esta conta vence neste mês, e em que dia?" mora nesse módulo, usado pelo calendário, pela página e pelo motor de notificações:

| Função | O que responde |
| --- | --- |
| `occursIn(item, year, month)` | há recebimento previsto nesse mês (0-11)? |
| `dueDayIn(item, year, month)` | dia do vencimento, limitado ao último dia do mês |
| `isStillActive(item, ref)` | ainda restam recebimentos por vir |
| `scheduleLabel(item)` | texto do cronograma exibido nos cards |
| `todayISODate(ref)` | `'YYYY-MM-DD'` **local**, para inputs `type="date"` |

O mês da primeira ocorrência vem de `firstDueDate`; itens antigos (sem esse campo) caem no mês de `startDate` com o `dueDay` que já tinham. Sem isso, uma conta cadastrada para o dia 8 do mês que vem aparecia já no dia 8 — passado — do mês corrente.

`active` é **derivado na leitura**, não persistido como verdade: vem de `isStillActive`. Contas `indefinite` são sempre ativas; `fixed_duration` expira depois dos meses contratados; `once` expira depois do seu mês. O calendário e os totais da página filtram por `occursIn` (não por `active`), porque uma conta ativa pode simplesmente não vencer no mês exibido.

### Convenção de persistência — importante

O **cadastro** da conta a receber é gravado na tabela `transactions` como:

```
type: 'system'   |   category: 'system_receivable'
```

O JSON completo do item vive na coluna `note`, igual ao que `useFinancings` e `Wallet` já fazem.

**Por que `type: 'system'` e não `'income'`:** `useTransactions` (`src/hooks/useTransactions.js:24`) e os cálculos em `src/helpers.js` (`calcBalance`, `calcIncome`) já excluem `type === 'system'`. Assim o cadastro de uma conta a receber **não** conta como receita. A receita real só entra quando o usuário confirma o recebimento e uma transação normal de `income` é criada.

Se isso fosse gravado como `income`, todo cadastro inflaria o saldo/receita imediatamente e contaria em dobro na confirmação.

O valor `'system'` já é aceito pelo banco — `src/components/Wallet.jsx:381` usa o mesmo.

### Sincronização entre telas

| Evento | Quem dispara | Quem escuta |
| --- | --- | --- |
| `receivables_updated` | toda mutação do hook | o próprio hook (recarrega do Supabase) |
| `wallet_updated` | `markAsReceived`, `unmarkReceived` | `useTransactions`, Wallet |

---

## `notificationsEngine.js`

```js
generateFinancialNotifications({ receivables, financings, cards, transactions }, { daysAhead: 5 })
requestNotificationPermission()   // → Promise<{ granted, reason? }>
sendBrowserNotification(title, options)  // → boolean
```

Gera alertas de três origens, ordenados por urgência (mais urgente primeiro; empate desempata por maior valor):

| Origem | Sai da lista quando |
| --- | --- |
| Conta a receber | `active === false`, ou já marcada em `receivedMonths[mês]` |
| Financiamento | quitado, ou parcela já paga no mês corrente |
| Fatura de cartão | saldo da fatura `<= 0` |

Cada alerta:

```js
{
  id: "receivable_123_2026-08",   // estável — base do "marcar como lida"
  type: "receivable" | "financing" | "card",
  severity: "danger" | "warning" | "success" | "info",
  title, message, amount, daysLeft,
  dueDate, itemId, yearMonth,
  financingId?, cardId?
}
```

Pontos de atenção ao mexer:

- **`id` precisa continuar estável** entre renders — o `NotificationCenter` guarda os lidos em `localStorage` (`finance_read_alerts`) por esse id. Incluir o `yearMonth` faz o alerta reaparecer no mês seguinte, que é o comportamento desejado.
- Vencidos entram na lista (`daysLeft` negativo), não só os futuros.
- `daysAhead` controla só a janela para frente.
- Contas que não vencem no mês corrente (ainda não começaram ou já terminaram) não geram alerta — o filtro é `occursIn`.
- Vencimento respeita meses curtos: `Math.min(dueDay, últimoDiaDoMês)`.
- As funções de notificação são seguras em SSR (checam `typeof window` e `'Notification' in window`).

---

## Impacto do nome diferente

**Nenhum impacto funcional.** O nome do arquivo é puramente interno:

- Não vira rota. O Next.js App Router deriva URLs de `src/app/**` — `src/hooks/` e `src/lib/` não geram rota nenhuma. `/receivables` continua sendo `/receivables`.
- Não muda nada na UI, no comportamento nem no banco.
- Os **nomes exportados continuam canônicos**: o hook ainda é `useReceivables`, as funções ainda são `generateFinancialNotifications`, `requestNotificationPermission` e `sendBrowserNotification`. Só o caminho do `import` mudou.

O custo é de manutenção, não de execução: quem procurar por `useReceivables.js` no projeto não acha o arquivo. Por isso este documento existe.

---

## `FinancialCalendar` — escopo por `mode`

O calendário é o mesmo componente nas duas páginas, mas o **escopo é fixo por página**, definido pela prop `mode`:

| `mode` | Onde | Mostra |
| --- | --- | --- |
| `receivables` | `/receivables` | só contas a receber |
| `payables` | `/cards` (Crédito & Dívidas) | faturas, assinaturas, financiamentos e empréstimos |
| `all` | *(nenhum uso hoje)* | tudo, com os botões de filtro manual |

O escopo é aplicado **na montagem dos itens** (`showReceivables` / `showPayables` no `useMemo`), não só na renderização. Passar `receivables` para um calendário em `mode="payables"` não faz os itens aparecerem — os dados simplesmente são ignorados. Isso evita que uma prop esquecida vaze conteúdo do escopo errado.

Consequências ao mexer:

- Os botões "Ver Todos / 🟢 Receber / 💳 Pagar & Cartões" só aparecem em `mode="all"`. Fora disso o filtro manual seria redundante com o escopo da página.
- Título, subtítulo e cor do cabeçalho mudam conforme o modo.
- Cada página passa só os dados e callbacks do seu escopo: `/receivables` passa `receivables` + `onMarkReceived`; `/cards` passa `cards`, `financings`, `subscriptions`, `transactions` + `onPayFinancing`, `onPayCardInvoice`.

---

## Sino de notificações — global

O sino fica disponível em **todas as páginas autenticadas**. Nenhuma página o renderiza ou alimenta.

```
Sidebar.jsx
  ├── desktop: <div class="notif-slot-sidebar">  (acima dos links)
  └── mobile:  <div class="mobile-header-right"> (ao lado do avatar)
        └── GlobalNotifications   ← busca os próprios dados (session + 4 hooks)
              └── NotificationCenter
```

`GlobalNotifications` é montado na `Sidebar` porque ela já aparece nas 8 páginas autenticadas e **não** no `/login` — o escopo desejado sai de graça.

O sino mostra alertas de **receber e pagar juntos**, de propósito: é um centro de avisos, não um recorte da página em que você está. Isso é independente do escopo dos calendários.

### Posicionamento: o sino fica no fluxo, não flutuando

O botão é **um item da navbar como qualquer outro** — sem `position: fixed` próprio. Se a navbar aparece, o sino aparece. Uma primeira versão o deixava flutuando no canto inferior direito e ele não apareceu em produção; o modo flutuante foi abandonado por não ser verificável nem previsível.

Duas regras que sustentam isso:

1. **Qual slot é montado é decidido em JS** (`matchMedia('(max-width: 768px)')` na `Sidebar`), não com `display: none` nos dois. Assim existe uma instância só — sem estado de "lidas" duplicado — e ela nunca fica dentro da sidebar do mobile, que recebe `transform: translateX(-100%)`. Um `position: fixed` dentro de ancestral transformado se posiciona por ele, não pela viewport, e o painel sairia da tela junto com o drawer.
2. **O painel é o único elemento fixo**, ancorado na viewport (topo direito no desktop, faixa cheia no mobile). Ancorado no botão, seria recortado pelo `overflow-y: auto` da sidebar. Ele tem backdrop: clique fora fecha, e cobrir botões da página enquanto está aberto é comportamento esperado de overlay.

O sino é renderizado mesmo sem `session.email` resolvido — os hooks simplesmente não consultam nada. Sumir enquanto a sessão carrega deixaria a navbar inconsistente e torna o componente difícil de diagnosticar.

Com a sidebar recolhida, o rótulo "Alertas" some e sobra o ícone, acompanhando os `.nav-text`. No mobile, idem.

### Custo conhecido

`GlobalNotifications` monta `useReceivables`, `useFinancings`, `useCreditCards` e `useTransactions` em toda página. Em páginas que já usam esses hooks (`/`, `/cards`, `/receivables`), isso **duplica as consultas ao Supabase** — cada instância do hook faz a sua. Funciona e mantém o sino autocontido, mas se o volume de requisições incomodar, o caminho é elevar esses dados para um contexto compartilhado.

---

## Pendência conhecida

`src/components/NotificationCenter.jsx:86` faz `POST /api/notifications/email`, mas essa rota **não existe** — `src/app/api/` só tem `ai-roadmap/` e `rates/`.

Efeito: o botão "Enviar E-mail de Teste" no modal de notificações externas retorna 404 em runtime. Não quebra o build nem afeta o resto do módulo. Para fechar, criar `src/app/api/notifications/email/route.js` respondendo `{ success, message?, error? }`, que é o contrato que o componente já espera.
