# Simulador de Juros Compostos — Input Manual e Taxas Automáticas

**Data:** 2026-07-25
**Arquivo afetado:** `src/app/investments/page.jsx` (simulador nas linhas 216–292)

## Problema

Duas queixas distintas sobre o simulador de juros compostos:

1. **Os campos numéricos têm setinhas de incremento e mudam de valor com a roda do mouse.** O usuário quer digitar, e só. O scroll acidental sobre um campo focado altera a simulação sem que ninguém perceba.

2. **A taxa de rendimento é um número solto que o usuário precisa saber de cabeça.** Hoje o campo vem com `10.4` fixo e uma dica escrita `"Ex: 10.4 para CDI/Selic atual"` — que está errada: o CDI está em 14,15% a.a. O usuário quer escolher o tipo de investimento e receber a taxa vigente automaticamente, mantendo a opção de digitar a própria taxa.

## Decisões

| Decisão | Escolha | Alternativa rejeitada |
|---|---|---|
| Profundidade do catálogo | Produtos reais com multiplicador editável | Só índices puros (usuário traduziria "110% do CDI" na mão) |
| Campo de taxa | Sempre editável; digitar troca o produto para "Personalizado" | Travar o campo em read-only e exigir "Personalizado" para liberar |
| Imposto de Renda | Fora de escopo — só valor bruto, com selo informativo de isenção | Tabela regressiva de IR com linha "Valor Final Líquido" |
| Origem das taxas | Route handler agregando a API SGS do Banco Central, cache de 1h | Fetch direto do browser; valores fixos no código |
| Taxas do Tesouro por vencimento | Fora de escopo | CSV do Tesouro Transparente (14 MB, 174 mil linhas) |
| Verificação | vitest nos módulos puros | Só `npm run build` + conferência manual |

### Por que route handler e não fetch direto do browser

A API SGS do Banco Central manda `access-control-allow-origin: *`, então o fetch direto do client funcionaria sem backend nenhum. O motivo de não fazer isso é confiabilidade: durante a investigação, a série do CDI (4389) **retornou um array vazio** numa chamada e só funcionou no retry. No browser, cada usuário engole essa falha sozinho e fica com a taxa errada sem aviso. No servidor, ela é tratada uma vez, com retry e fallback, e o resultado é cacheado para todos.

O cache de 1h é folgado de propósito: as taxas só mudam a cada reunião do Copom (~45 dias). O browser passa a fazer 1 request em vez de 4.

Route handlers são viáveis aqui porque o projeto não tem `next.config.js` com `output: 'export'` — o build padrão do Next serve rotas de servidor.

### Por que o CSV do Tesouro ficou fora

O Tesouro Transparente publica diariamente as taxas reais por vencimento (Prefixado 2027 a 13,82%, IPCA+ 2029 a IPCA+8,33%, etc.), e como o simulador já tem um campo de prazo, daria para casar o vencimento com o período escolhido. Mas o dado só existe como CSV de 14 MB com a série histórica inteira desde 2002 — o endpoint JSON antigo do Tesouro Direto responde `410 Gone` e o CKAN não expõe `datastore_search` para filtrar. O custo de baixar e parsear isso não se paga para o ganho. O Tesouro Prefixado fica ancorado na Selic como proxy, com dica explícita pedindo ajuste conforme o título.

## Arquitetura

`page.jsx` já tem 309 linhas e as duas features encostam em quase tudo dele. Os pedaços saem para módulos com um propósito cada:

| Arquivo | Responsabilidade | Faz rede? |
|---|---|---|
| `src/lib/rates.js` *(novo)* | Mapa de séries SGS, parse, anualização, constantes de fallback | não |
| `src/app/api/rates/route.js` *(novo)* | Agrega as séries, cache, degradação | sim |
| `src/hooks/useRates.js` *(novo)* | Expõe `{ rates, loading, degraded, fetchedAt }` | sim |
| `src/lib/investmentProducts.js` *(novo)* | Catálogo e derivação pura de taxa | não |
| `src/components/NumberField.jsx` *(novo)* | Input numérico só-digitação, reusável | não |
| `src/app/investments/page.jsx` *(alterado)* | Liga as peças | não |

A pasta `src/app/api/` ainda não existe e será criada.

### `src/lib/rates.js`

Séries do SGS usadas, todas validadas ao vivo em 2026-07-25:

| Chave | Série | O que é | Unidade | Valor observado |
|---|---|---|---|---|
| `cdi` | 4389 | CDI anualizado base 252 | % a.a. | 14,15 |
| `selic` | 432 | Meta Selic definida pelo Copom | % a.a. | 14,25 |
| `ipca12` | 13522 | IPCA acumulado em 12 meses | % a.a. | 4,64 |
| `poupanca` | 195 | Rendimento da poupança | **% a.m.** | 0,6723 |

A poupança vem mensal e precisa ser anualizada geometricamente: `((1 + m/100) ** 12 - 1) * 100`, que dá 8,37% a.a. para 0,6723%. As outras três já vêm anualizadas e passam direto.

A TR (série 226) foi cortada. A intenção era calcular a poupança pela regra (`0,5% a.m. + TR`), mas a série 195 já entrega o rendimento final.

**Busca:** janela de datas dos últimos 45 dias (`dataInicial`/`dataFinal`) pegando o item mais recente, em vez de `ultimos/1` — foi `ultimos/1` que retornou vazio na investigação.

**Parse:** o campo `valor` vem como string com ponto decimal (`"14.15"`). Exige `parseFloat` e guarda de `NaN`.

**Fallback:** constantes com os valores acima e a data em que foram observados, servindo tanto para falha de rede quanto para estado inicial antes do fetch resolver.

### `src/lib/investmentProducts.js`

Cada produto é `{ id, label, index, multiplierKind, defaultMultiplier, taxExempt, hint }`. O `multiplierKind` decide a conta:

- `percent_of` → `índice × multiplicador / 100`
- `spread` → `índice + multiplicador`
- `none` → `índice` puro, sem campo de multiplicador

`deriveRate(product, rates, multiplier)` retorna `null` quando o produto não tem índice — o caso do "Personalizado". Isso substitui um `multiplierKind: 'fixed'` que seria código morto: como o effect não escreve nada para o Personalizado, esse branch nunca executaria.

| Produto | Base | Multiplicador | `multiplierKind` | Taxa em 25/07 |
|---|---|---|---|---|
| Poupança | `poupanca` | — | `none` | 8,37% |
| CDB / RDB | `cdi` | 100% | `percent_of` | 14,15% |
| LCI / LCA | `cdi` | 95% | `percent_of` | 13,44% |
| Tesouro Selic | `selic` | +0 | `spread` | 14,25% |
| Tesouro IPCA+ | `ipca12` | +6,0 | `spread` | 10,64% |
| Tesouro Prefixado | `selic` | +0 | `spread` | 14,25% |
| Fundo DI | `cdi` | 98% | `percent_of` | 13,87% |
| Personalizado | — (`index: null`) | — | `none` | digitada |

`taxExempt: true` em Poupança e LCI/LCA — usado apenas para exibir um selo informativo, sem efeito no cálculo.

Os multiplicadores default são convenções comuns de mercado, não recomendação. Consequências assumidas: Tesouro Selic e Prefixado mostram a mesma taxa até o usuário editar, e Ações/FIIs não entram no catálogo porque não têm taxa contratada — inventar "12% histórico" daria a um número chutado a aparência de dado oficial. Quem quiser simula em "Personalizado".

Ações e FIIs ficarem fora tem um segundo motivo: o simulador é uma ferramenta de projeção, não de recomendação. A UI leva uma linha deixando claro que é simulação com taxa constante, não previsão de rendimento.

### `src/components/NumberField.jsx`

Resolve o requisito 1. A raiz dos dois problemas é a mesma: `type="number"`. A troca para `type="text"` + `inputMode="decimal"`:

- elimina as setinhas em todos os navegadores de uma vez — com `type="number"` seriam necessários `-webkit-appearance: none` **e** `-moz-appearance: textfield`, e a roda do mouse continuaria funcionando mesmo assim;
- elimina o scroll-para-alterar, que só existe em `type="number"`;
- faz ArrowUp/ArrowDown pararem de alterar o valor, sem handler de teclado;
- preserva o teclado numérico no celular via `inputMode`.

**Estado local em string, não número.** Guardando só `Number`, o usuário não consegue digitar `1,` nem limpar o campo para redigitar: o React reescreve o valor no meio da digitação e o cursor pula. O componente guarda o texto, propaga o número para o pai quando o texto é válido, e normaliza o display no `blur`.

**Clamp só no `blur`.** Clampando por tecla, um campo com `min={1}` impede apagar para digitar `10`.

Aceita vírgula e ponto como separador decimal (pt-BR digita vírgula) e normaliza para ponto internamente. Campo vazio propaga `0` para o pai mas mantém o display vazio.

Props: `value`, `onChange`, `min`, `max`, `decimals`, `icon`, `suffix`.

Substitui os quatro campos atuais do simulador (Valor Inicial, Aporte Mensal, Taxa, Período) além do multiplicador novo — o requisito 1 é resolvido em todos, não só no que incomodou.

## UI

Ordem do painel de controles:

1. **Tipo de Investimento** — `<select>`, reusando `.tx-field select` que já existe em `src/app/globals.css:857`
2. **Multiplicador** — condicional, oculto quando `multiplierKind` é `none` (Poupança e Personalizado). Label adapta: "% do CDI" para `percent_of`, "IPCA + (%)" para `spread`
3. **Valor Inicial** — `NumberField`
4. **Aporte Mensal** — `NumberField`
5. **Taxa Anual (%)** — `NumberField`, exibindo a taxa derivada
6. **Período (Anos)** — `NumberField`

Abaixo da Taxa, uma linha de status substitui a dica hardcoded `"Ex: 10.4 para CDI/Selic atual"`:

| Estado | Texto |
|---|---|
| Carregando | "buscando taxas no Banco Central…" |
| Sucesso | "CDI 14,15% a.a. · Banco Central, 23/07/2026" |
| Degradado | "⚠ não deu pra atualizar; usando último valor conhecido" |
| Personalizado | "taxa definida por você" |

Mais o selo "isento de IR" quando `taxExempt`.

## Fluxo de estado

Estado novo em `page.jsx`: `productId` e `multiplier`. O `simRate` existente continua sendo a única entrada do cálculo.

```
rates + productId + multiplier  ──►  derivedRate  ──►  simRate  ──►  simData (inalterado)
```

Um `useEffect` escreve `derivedRate` em `simRate` quando produto, multiplicador ou taxas mudam. **O effect só escreve quando `deriveRate` retorna não-`null`** — sem isso, digitar uma taxa troca o produto para "Personalizado", o effect reescreve o valor, e os dois brigam. Como o Personalizado não tem índice, a derivação devolve `null` e o effect não toca em nada: uma regra só, sem comparar strings de id.

Editar o campo de taxa chama `setProductId('custom')` junto com `setSimRate`.

O estado inicial usa as constantes de fallback, então o gráfico já renderiza com números reais antes do fetch resolver — nunca vazio, nunca `NaN`.

A matemática do `simData` (`src/app/investments/page.jsx:50-78`) **não muda**. A conversão anual→mensal geométrica já está correta.

## Tratamento de erro

- **Route handler:** `Promise.allSettled` por série. Série que rejeita **ou retorna array vazio** cai na sua constante de fallback. A resposta carrega `degraded: ['cdi']` listando quais falharam, para a UI poder ser honesta.
- **Nunca retorna 500.** Falha total responde 200 com todas as constantes e `degraded` completo. Uma taxa indisponível não pode derrubar o simulador.
- **Client:** falha no fetch de `/api/rates` usa as constantes e exibe a linha de degradado.
- **Parse:** `parseFloat` com guarda de `NaN`; valor inválido conta como série falhada.

## Testes

vitest como devDependency, cobrindo os três módulos puros — sem rede, sem DOM pesado:

**`rates.js`**
- anualização: `0,6723% a.m.` → `8,37% a.a.`
- parse de `[{"data":"23/07/2026","valor":"14.15"}]` → `14.15` como número
- array vazio → usa fallback e marca a série como degradada
- `valor` não numérico → tratado como falha, não `NaN`

**`investmentProducts.js`**
- `percent_of`: CDI 14,15 a 95% → 13,44
- `spread`: IPCA 4,64 +6 → 10,64
- `none`: retorna o índice intacto
- produto sem índice (Personalizado): retorna `null`, para o effect não sobrescrever a taxa digitada

**`NumberField.jsx`** (sanitização pura, extraída para função testável)
- `"1,5"` → `1.5`
- `""` → `0` sem quebrar
- letras e símbolos rejeitados
- clamp aplicado no blur, não por tecla

Verificação adicional: `npm run build` passando, e conferência manual dos estados no navegador — digitação sem setinha e sem reagir ao scroll, troca de produto puxando taxa, multiplicador condicional aparecendo e sumindo, taxa manual virando "Personalizado", e a linha de degradado.

## Fora de escopo

- Cálculo de IR e valor líquido
- Taxas do Tesouro por vencimento
- Ações, FIIs e qualquer ativo sem taxa contratada
- Persistir a simulação no Supabase
- Mudanças no gráfico ou no painel de resultados
