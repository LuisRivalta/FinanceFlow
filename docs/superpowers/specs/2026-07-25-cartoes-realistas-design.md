# Cards de Cartão com Cara de Cartão de Crédito

**Data:** 2026-07-25
**Arquivo afetado:** `src/app/cards/page.jsx` (grid de cartões nas linhas 185–239)

## Problema

Os cards da página de cartões não passam a impressão de um cartão de crédito, e os elementos internos se atropelam. No print do usuário, o "Vence dia" do terceiro card aparece encavalado no botão, e `NUBANK ULTRAVIOLETA` quebra em duas linhas empurrando tudo para baixo.

A proporção não é o problema — já é `aspectRatio: 1.586 / 1`, a medida real de um cartão (85,60 × 53,98 mm). A causa é densidade: **cinco blocos empilhados em ~190px de altura** (nome+bandeira, ações, label da fatura, valor, linha vence/limite, botão full-width).

Há também um artefato visual. O `Card3D` renderiza uma `boxGeometry` de `[10, 10, 0.1]` com a câmera em `z=3` e FOV 45°: um quadrado que transborda tanto o viewport que o resultado é um plano metálico chapado. A faixa clara torta na base dos cartões 1 e 2 do print é a `directionalLight` batendo nessa caixa. São três contextos WebGL para produzir o que um gradiente CSS faz melhor.

## Decisões

| Decisão | Escolha | Alternativa rejeitada |
|---|---|---|
| Layout | Face limpa; barra de limite e botão saem para fora do cartão | Tudo na face reorganizado; cartão que vira no clique |
| Número do cartão | Bolinhas decorativas, sem dígitos reais | Coluna `last_digits` no Supabase; nenhuma linha de número |
| Interação | Parallax leve — face inclina e camadas internas deslocam em ritmos diferentes | Apenas o `translateY` de hover que já existe |
| Fundo metálico | Gradiente CSS sobre a cor do cartão | Corrigir a geometria do `Card3D` e manter WebGL |
| Chip | Metálico cinza-prata | Amarelo/dourado — o usuário removeu um chip amarelo em `3a07c97` |

Nada de migração de banco: as bolinhas são decorativas, então nenhum campo novo é necessário.

## Anatomia da face

Mantém `aspect-ratio: 1.586 / 1`. Três blocos com `justify-content: space-between`:

| Zona | Conteúdo |
|---|---|
| Topo esquerda | Chip metálico (CSS puro) |
| Topo direita | Bandeira; as ações de editar/excluir aparecem sobre ela no hover |
| Centro | `FATURA ATUAL` + valor grande, ocupando a posição onde ficaria o número |
| Base esquerda | Nome do cartão + `vence dia N` |
| Base direita | Bolinhas decorativas (`•••• ••••`) |

Fora da face, abaixo: barra de limite (percentual usado + total) e o botão de pagar fatura.

Isso troca cinco blocos internos por três, e é o que resolve a sobreposição. O nome do cartão trunca com ellipsis em vez de quebrar linha.

## Parallax

O ponteiro sobre a face alimenta quatro custom properties via `style.setProperty` — sem estado React, portanto sem re-render por movimento do mouse:

- `--cc-rx` / `--cc-ry`: rotação, limitada a ±5deg (o pedido foi "leve")
- `--cc-px` / `--cc-py`: deslocamento normalizado −1..1 das camadas internas
- `--cc-mx` / `--cc-my`: posição do brilho radial que segue o cursor

A face aplica `perspective(900px) rotateX() rotateY()`. As camadas internas deslocam em amplitudes distintas — chip 8px, bloco central 4px, base 2px — e é essa diferença de ritmo que produz profundidade real em vez de só inclinação.

`onMouseLeave` zera tudo e uma transição mais longa devolve o cartão à posição de repouso.

`@media (prefers-reduced-motion: reduce)` anula todos os transforms.

A face **não** usa as classes `card glass-panel`. O `.glass-panel.card:hover` já aplica `transform: translateY(-4px)` (`globals.css:110`), que sobrescreveria o transform do parallax.

## Arquivos

| Arquivo | Responsabilidade |
|---|---|
| `src/components/CreditCardItem.jsx` *(criar)* | Face, barra de limite, botão e o parallax |
| `src/lib/cardMetrics.js` *(criar)* | `usagePercent` — puro |
| `src/lib/cardMetrics.test.js` *(criar)* | Testes do acima |
| `src/app/globals.css` *(modificar)* | Classes `.cc-*`: face, chip, brilho, bolinhas, camadas |
| `src/app/cards/page.jsx` *(modificar)* | Passa a usar o componente; remove o `Card3D` do fundo |

`cards/page.jsx` tem 303 linhas e o markup do cartão é um bloco aninhado de estilos inline. Extraí-lo deixa um arquivo com um trabalho só.

Chip e brilho precisam de pseudo-elementos, então as classes visuais vão para o CSS em vez de estilos inline. Os valores que dependem de dados — a cor do cartão — entram como custom property inline.

## `usagePercent`

`usagePercent(invoice, limit)` devolve 0–100. Casos que valem teste porque o resultado é dividido:

- `limit` igual a 0 ou ausente → `0`, não `NaN` nem `Infinity`
- `invoice` acima do `limit` → `100`, sem estourar a barra
- `invoice` negativo (fatura paga além do valor) → `0`
- entrada não finita → `0`

## Card3D

Sai do fundo dos cartões, mas o arquivo `src/components/3d/Card3D.jsx` **permanece no repositório**, intacto. Apenas o uso muda.

A linha 300 de `cards/page.jsx` tem `{selectedCard3D && <Card3D card={selectedCard3D} onClose={...} />}`, mas `setSelectedCard3D` nunca é chamado em nenhum lugar do arquivo — esse modal nunca abre. É código morto e sai junto, já que o arquivo está sendo mexido.

## Fora de escopo

- Coluna `last_digits` e dígitos reais no cartão
- Corrigir a geometria do `Card3D` para virar um cartão 3D de verdade
- O fetch duplicado de cartões: `useCreditCards` já chama `load()` num `useEffect` interno (`useCards.js:28-30`) e a página chama `loadCards()` de novo. Pré-existente, fica registrado
- Assinaturas e compras parceladas, mais abaixo na mesma página
