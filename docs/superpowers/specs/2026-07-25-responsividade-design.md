# Responsividade — 100% incluindo mobile

**Data:** 2026-07-25
**Arquivos afetados:** 6 páginas, `src/components/Wallet.jsx`, `src/app/globals.css`

## Diagnóstico

O site já tem CSS responsivo e ainda assim não é responsivo. A causa é de especificidade: **estilo inline vence media query.**

A sidebar funciona — vira barra horizontal em 1024px e bottom nav em 768px — porque é classe CSS. O conteúdo não funciona porque os grids estão escritos como `style={{ gridTemplateColumns: '350px 1fr' }}` no JSX, e nenhuma regra de stylesheet alcança isso.

O próprio `globals.css` traz a prova de que alguém já bateu nessa parede:

```css
div[style*="display: flex"][style*="gap: 24"] {
    flex-wrap: wrap !important;
    gap: 16px !important;
}
```

Um seletor de atributo casando a string literal do estilo inline, com `!important`. Só existe porque a alternativa não funcionava.

## Inventário

| Categoria | Quantidade | Situação |
|---|---|---|
| Grid multi-coluna inline | 8 | 6 simétricos, 2 assimétricos |
| Fonte 32–48px inline | 9 | 8 em `div`/`span`, 1 em `<h2>` |
| Tabela sem scroll | 2 | admin e charts |
| Legenda de rosca à direita | 5 configs | comprime o gráfico em tela estreita |
| `.main-content` sem folga pra bottom nav | 1 | **bug ativo** |

Descartados do inventário após verificação:

- **Larguras fixas** (`width: 250` em `investments:298`, `width: 140` em `page:373`) são SVGs decorativos com `position: absolute` e `opacity: 0.05`. Não afetam layout.
- **`maxWidth: 1100`** em `charts:273` é teto, não piso. Não quebra em tela pequena.
- **Chart.js** já está `responsive: true, maintainAspectRatio: false` em todos os 9 gráficos.
- **Viewport meta** o Next já injeta: confirmado no build, `width=device-width, initial-scale=1`.
- **`investments:292`** é `<h2>`, e a query de 768px já força `h2, h3 { font-size: 20px !important }`. `!important` de stylesheet vence estilo inline normal, então esse já está coberto.

## Breakpoints

Mantém os dois que existem e acrescenta um. Não se inventa sistema novo: a sidebar já se comporta bem nesses cortes.

| Largura | O que muda |
|---|---|
| ≤ 1024px | sidebar vira barra horizontal *(já existe)* |
| ≤ 900px | `.sim-grid` empilha *(novo)* |
| ≤ 768px | sidebar vira bottom nav *(já existe)*; `.profile-grid` empilha; legenda de rosca vai pra baixo; folga do bottom nav |
| ≤ 480px | padding e gap reduzidos |

## 1. Folga do bottom nav

Correção de maior impacto e de uma linha. Dentro da query de 768px:

```css
.main-content {
    padding-bottom: 88px;
}
```

Hoje `.main-content` tem `padding: 24px 0` e a sidebar em 768px é `position: fixed; bottom: 0`. Sem essa folga, o último elemento de **toda** página fica atrás da navegação no celular.

O valor 88px cobre a altura da bottom nav (`padding: 8px 12px` + `.nav-item` com `padding: 6px` em coluna, ícone e label) com margem.

## 2. Seis grids simétricos → `auto-fit`

`repeat(auto-fit, minmax(Npx, 1fr))` é intrinsecamente responsivo: colapsa colunas sozinho quando o espaço aperta, sem media query, sem classe e sem briga de especificidade. Funciona a partir do estilo inline, que é onde os grids estão. Já é o padrão em dois lugares do projeto (`cards:182` e `Wallet:212`).

| Arquivo:linha | Hoje | Vira |
|---|---|---|
| `charts/page.jsx:296` | `repeat(4,1fr)` | `repeat(auto-fit, minmax(200px, 1fr))` |
| `charts/page.jsx:312` | `minmax(0, 1fr) minmax(0, 1fr)` | `repeat(auto-fit, minmax(340px, 1fr))` |
| `page.jsx:370` | `repeat(3, 1fr)` | `repeat(auto-fit, minmax(260px, 1fr))` |
| `page.jsx:462` | `1fr 1fr` | `repeat(auto-fit, minmax(320px, 1fr))` |
| `cards/page.jsx:143` | `1fr 1fr 1fr` | `repeat(auto-fit, minmax(200px, 1fr))` |
| `cards/page.jsx:213` | `1fr 1fr` | `repeat(auto-fit, minmax(320px, 1fr))` |

Os valores de `minmax` saem do conteúdo: 200px para cards de estatística curtos, 260px para os três cards da home, 320px para painéis com lista dentro, 340px para painel com gráfico.

`auto-fit` e não `auto-fill`: `auto-fit` colapsa as trilhas vazias, então em tela larga as colunas existentes esticam em vez de sobrar buraco à direita.

O `gridColumn: '1 / -1'` da linha de botões do formulário em `cards:176` continua funcionando com `auto-fit`.

## 3. Dois grids assimétricos → classe CSS

`auto-fit` produz colunas iguais, o que destruiria a proporção intencional destes dois no desktop. Precisam de breakpoint, logo precisam sair do inline.

```css
.sim-grid {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: 24px;
    align-items: stretch;
}

@media (max-width: 900px) {
    .sim-grid { grid-template-columns: 1fr; }
}

.profile-grid {
    display: grid;
    grid-template-columns: 1fr 2fr;
    gap: 24px;
}

@media (max-width: 768px) {
    .profile-grid { grid-template-columns: 1fr; }
}
```

`investments/page.jsx:330` passa de `style={{ display: 'grid', gridTemplateColumns: '350px 1fr', gap: 24, alignItems: 'stretch' }}` para `className="fade-up delay-2 sim-grid"`.

`profile/page.jsx:144` passa de `style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}` para `className="fade-up delay-1 profile-grid"`.

O corte do simulador é 900px e não 768px porque o painel de controles tem 350px fixos: abaixo de ~900px o gráfico ao lado fica estreito demais para ser legível antes mesmo de a sidebar mudar.

## 4. Oito fontes → `clamp()`

`clamp(min, preferido, max)` escala com a viewport e funciona em estilo inline, sem breakpoint.

| Arquivo:linha | Hoje | Vira |
|---|---|---|
| `investments/page.jsx:303` | `48` | `'clamp(28px, 7vw, 48px)'` |
| `profile/page.jsx:152` | `48` | `'clamp(28px, 7vw, 48px)'` |
| `cards/page.jsx:185` | `40` | `'clamp(28px, 6vw, 40px)'` |
| `Wallet.jsx:208` | `40` | `'clamp(26px, 6vw, 40px)'` |
| `charts/page.jsx:425` | `32` | `'clamp(22px, 5vw, 32px)'` |
| `page.jsx:679` | `32` | `'clamp(22px, 5vw, 32px)'` |
| `page.jsx:740` | `32` | `'clamp(22px, 5vw, 32px)'` |
| `Wallet.jsx:219` | `32` | `'clamp(22px, 5vw, 32px)'` |

A unidade `vw` é da viewport, não do container, então em telas largas o `max` é que segura o tamanho — é por isso que o terceiro argumento importa.

## 5. Duas tabelas → wrapper com scroll

`admin/page.jsx:96` e `charts/page.jsx:372` ganham:

```jsx
<div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
    <table …>
</div>
```

Tabela é a única coisa da lista que legitimamente não cabe em 360px. Rolar na horizontal dentro de um container é melhor que estourar a largura da página, que provoca scroll horizontal no documento inteiro.

## 6. Legenda dos gráficos de rosca

Quatro configs usam `legend: { position: 'right' }`. Em 360px isso deixa cerca de 150px para o gráfico.

Novo módulo `src/lib/responsive.js`:

```js
export function legendPosition(width, breakpoint = 768) {
    if (!Number.isFinite(width)) return 'right'
    return width <= breakpoint ? 'bottom' : 'right'
}
```

Recebe a largura como argumento em vez de ler `window` por dentro — assim é puro e testável. Quem chama passa `window.innerWidth`, dentro do `useEffect` que monta o gráfico, onde `window` existe.

As quatro ocorrências, verificadas uma a uma:

| Arquivo:linha | Gráfico |
|---|---|
| `charts/page.jsx:176` | rosca de despesas por categoria |
| `charts/page.jsx:234` | rosca com percentual |
| `page.jsx:294` | rosca do saldo |
| `page.jsx:317` | rosca de categorias |

As demais configs de legenda ficam como estão: `charts:156` já é `'top'`, `charts:215` já é `'bottom'`, `investments:246` já é `'top'`, e `charts:118` e `page:266` usam `display: false`.

Limitação assumida: a posição é decidida na montagem do gráfico, não em resize. Girar o aparelho não reposiciona a legenda até a próxima remontagem. Um listener de resize que destrói e recria quatro gráficos custa mais do que resolve.

## 7. Breakpoint de 480px

```css
@media (max-width: 480px) {
    .app-container { padding: 12px; }
    .card { padding: 16px; gap: 12px; }
    .main-content { gap: 14px; }
}
```

Só aperto de espaçamento. Nenhuma mudança estrutural — a essa altura os grids já colapsaram sozinhos pelo `auto-fit`.

## Verificação

Harness standalone no scratchpad da sessão, não no repositório: é ferramenta de verificação, não entregável. HTML com o CSS real do projeto e as declarações de grid reais, com seletor de largura (360, 414, 768, 1024, 1440). O harness mede `scrollWidth > clientWidth` em cada largura e reporta overflow por código, sem depender de login.

Limitação honesta: é aproximação, não o app rodando. Reproduz grid e escala de tipografia, que é o que está mudando. Coisas que dependem de dados reais ou de interação precisam de conferência humana no aparelho.

Também: `npm run build` e `npm test` (97 testes) precisam continuar passando, e o novo `legendPosition` entra com teste.

## Fora de escopo

- **A sidebar.** Já responsiva nos três estados. Não é tocada.
- **Os dois hacks de `!important` que já existem.** O `div[style*="gap: 24"]` está fazendo trabalho real em containers flex, e o `h2, h3 { font-size: 20px !important }` cobre os títulos. Remover exigiria auditar todo flex row do site — é outra tarefa. Ficam registrados aqui.
- Reestruturar páginas, trocar inline styles por CSS de forma ampla, ou adicionar framework de CSS.
- Resize dinâmico da legenda dos gráficos, conforme explicado na seção 6.
