# Simulador de Juros Compostos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer os campos numéricos do simulador aceitarem apenas digitação (sem setinhas, sem scroll) e adicionar um seletor de tipo de investimento que puxa a taxa vigente da API SGS do Banco Central, mantendo a opção de taxa manual.

**Architecture:** A lógica sai de `page.jsx` para módulos com uma responsabilidade cada: matemática/parse das séries do BCB, catálogo de produtos, sanitização de input. Um route handler agrega as 4 séries do BCB no servidor com cache, porque a série do CDI já foi observada retornando array vazio e essa falha precisa de retry + fallback num lugar só, não no browser de cada usuário.

**Tech Stack:** Next.js 16.1.6 (App Router), React 19.2.4, vitest (novo), API SGS do Banco Central.

**Spec:** `docs/superpowers/specs/2026-07-25-simulador-juros-compostos-design.md`

---

## Correções aplicadas durante a execução

**Task 1 — separador de milhar pt-BR (commit `c20d0fa`).** O código de `sanitizeNumericText` como escrito neste plano tratava `.` sempre como separador decimal. Mas o `formatCurrency` do próprio app (`src/helpers.js:47`) usa `Intl.NumberFormat('pt-BR', { style: 'currency' })`, que emite `R$ 1.500,75` — ponto como separador de **milhar**. Resultado: qualquer valor exibido pelo app, colado de volta num campo, virava 1/1000 dele mesmo. Erro de 1000x num app de finanças.

A correção adiciona detecção de milhar antes da regra de "primeiro separador vence", em três regras: ponto **e** vírgula presentes → todos os pontos são milhar; 2+ pontos sem vírgula → todos são milhar; exatamente um ponto seguido de exatamente 3 dígitos e nada mais → milhar. Um ponto antes de 1–2 dígitos continua decimal, porque `1.5` é genuinamente ambíguo com `1,5`.

O `include` do vitest também virou `['src/**/*.test.{js,jsx}']`: o glob original não pegava `.test.jsx`, e teste que silenciosamente não roda é pior que teste que falha.

**Tasks 2 e 6 — `max` nos campos monetários.** Valor Inicial e Aporte Mensal ganharam `max={1000000000}`. Sem teto, `formatNumericValue` podia emitir notação exponencial (`1e+22`), e o sanitizador então destruía isso em `'122'`. Um bilhão cobre qualquer valor real de finanças pessoais com folga e mantém o display fora da faixa exponencial.

## Desvio deliberado do spec

O spec especificava a série **432** (Meta Selic definida pelo Copom) para o índice Selic. Este plano usa a série **1178** (Selic efetiva anualizada base 252) por dois motivos:

1. A série 432 retorna a data de *vigência futura* da meta — na investigação devolveu `05/08/2026`, e a linha de status exibiria "Banco Central, 05/08/2026", uma data que ainda não aconteceu.
2. A Selic efetiva é a que de fato rende no Tesouro Selic. A meta é o alvo, não o rendimento.

Valores observados em 25/07/2026: série 432 = 14,25% (data 05/08/2026); série 1178 = 14,15% (data 24/07/2026).

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `vitest.config.js` *(criar)* | Config de teste, ambiente node, sem JSX | 1 |
| `package.json` *(modificar)* | devDependency `vitest` + script `test` | 1 |
| `src/lib/numberInput.js` *(criar)* | Sanitizar, parsear, clampar e formatar texto numérico. Puro. | 1 |
| `src/lib/numberInput.test.js` *(criar)* | Testes do acima | 1 |
| `src/components/NumberField.jsx` *(criar)* | Input só-digitação, reusável | 2 |
| `src/app/investments/page.jsx` *(modificar)* | Trocar os 4 inputs por `NumberField` | 2 |
| `src/lib/rates.js` *(criar)* | Séries SGS, URL, parse, anualização, fallback, agregação. Puro (fetch injetado). | 3 |
| `src/lib/rates.test.js` *(criar)* | Testes do acima | 3 |
| `src/app/api/rates/route.js` *(criar)* | Expõe as taxas agregadas com cache | 4 |
| `src/hooks/useRates.js` *(criar)* | Consome `/api/rates` no client | 4 |
| `src/lib/investmentProducts.js` *(criar)* | Catálogo e derivação pura de taxa | 5 |
| `src/lib/investmentProducts.test.js` *(criar)* | Testes do acima | 5 |
| `src/helpers.js` *(modificar)* | `formatPercent` | 5 |
| `src/helpers.test.js` *(criar)* | Testes do `formatPercent` | 5 |
| `src/app/investments/page.jsx` *(modificar)* | Seletor, multiplicador, linha de status | 6 |

A pasta `src/app/api/` ainda não existe e será criada na Task 4.

`page.jsx` é tocado em duas tasks distintas de propósito: a Task 2 entrega o requisito 1 completo e funcionando por si só, antes de qualquer coisa de rede entrar em cena.

---

### Task 1: Setup do vitest e o módulo `numberInput`

**Files:**
- Modify: `package.json`
- Create: `vitest.config.js`
- Create: `src/lib/numberInput.js`
- Test: `src/lib/numberInput.test.js`

Os testes cobrem só código puro sem JSX, então não precisa de `jsdom` nem de `@vitejs/plugin-react` — a config fica mínima de propósito.

- [ ] **Step 1: Instalar o vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Criar a config do vitest**

Criar `vitest.config.js`:

```js
import { defineConfig } from 'vitest/config'

// Os testes cobrem apenas módulos puros (sem JSX, sem DOM), então o ambiente
// node basta e a config não precisa de plugin de React.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.js'],
    },
})
```

- [ ] **Step 3: Adicionar o script de teste**

Em `package.json`, dentro de `"scripts"`, adicionar as duas linhas abaixo depois de `"lint": "next lint"`:

```json
        "lint": "next lint",
        "test": "vitest run",
        "test:watch": "vitest"
```

- [ ] **Step 4: Escrever os testes que falham**

Criar `src/lib/numberInput.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { sanitizeNumericText, parseNumericText, clampNumber, formatNumericValue } from './numberInput'

describe('sanitizeNumericText', () => {
    it('remove letras e símbolos', () => {
        expect(sanitizeNumericText('12a3!')).toBe('123')
    })

    it('aceita vírgula como separador decimal', () => {
        expect(sanitizeNumericText('1,5')).toBe('1,5')
    })

    it('converte ponto em vírgula', () => {
        expect(sanitizeNumericText('1.5')).toBe('1,5')
    })

    it('mantém apenas o primeiro separador', () => {
        expect(sanitizeNumericText('1,5,7')).toBe('1,57')
    })

    it('limita as casas decimais', () => {
        expect(sanitizeNumericText('1,239')).toBe('1,23')
    })

    it('descarta a parte decimal quando decimals é 0', () => {
        expect(sanitizeNumericText('10,9', { decimals: 0 })).toBe('10')
    })

    it('preserva string vazia para o usuário poder apagar o campo', () => {
        expect(sanitizeNumericText('')).toBe('')
    })
})

describe('parseNumericText', () => {
    it('converte vírgula em número', () => {
        expect(parseNumericText('1,5')).toBe(1.5)
    })

    it('devolve null para texto vazio', () => {
        expect(parseNumericText('')).toBeNull()
    })

    it('devolve null para separador solto', () => {
        expect(parseNumericText(',')).toBeNull()
    })
})

describe('clampNumber', () => {
    it('aplica o mínimo', () => {
        expect(clampNumber(0, { min: 1, max: 50 })).toBe(1)
    })

    it('aplica o máximo', () => {
        expect(clampNumber(99, { min: 1, max: 50 })).toBe(50)
    })

    it('não mexe em valor dentro da faixa', () => {
        expect(clampNumber(10, { min: 1, max: 50 })).toBe(10)
    })
})

describe('formatNumericValue', () => {
    it('não engole os zeros de um inteiro redondo', () => {
        expect(formatNumericValue(1000, { decimals: 2 })).toBe('1000')
    })

    it('mantém as casas significativas', () => {
        expect(formatNumericValue(14.15, { decimals: 2 })).toBe('14,15')
    })

    it('corta zero decimal à direita', () => {
        expect(formatNumericValue(14.1, { decimals: 2 })).toBe('14,1')
    })

    it('formata inteiro com decimals 0', () => {
        expect(formatNumericValue(1000, { decimals: 0 })).toBe('1000')
    })

    it('devolve vazio para valor inválido', () => {
        expect(formatNumericValue(NaN, { decimals: 2 })).toBe('')
    })
})
```

- [ ] **Step 5: Rodar os testes e confirmar que falham**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./numberInput"`

- [ ] **Step 6: Implementar o módulo**

Criar `src/lib/numberInput.js`:

```js
// Helpers puros do NumberField. Ficam fora do componente para poderem ser
// testados sem DOM nem transform de JSX.

// Aceita apenas dígitos e um único separador decimal. Vírgula e ponto são
// equivalentes na entrada (pt-BR digita vírgula) e a saída normaliza pra vírgula.
export function sanitizeNumericText(raw, { decimals = 2 } = {}) {
    if (raw == null) return ''

    let text = String(raw).replace(/[^\d.,]/g, '')

    // Mantém apenas o primeiro separador; os seguintes são descartados.
    const firstSep = text.search(/[.,]/)
    if (firstSep !== -1) {
        const head = text.slice(0, firstSep)
        const tail = text.slice(firstSep + 1).replace(/[.,]/g, '')
        text = `${head},${tail}`
    }

    if (decimals === 0) return text.split(',')[0]

    const [int, frac] = text.split(',')
    if (frac === undefined) return int
    return `${int},${frac.slice(0, decimals)}`
}

// Devolve null (não 0) para entrada incompleta, para o componente distinguir
// "campo vazio" de "o usuário digitou zero".
export function parseNumericText(text) {
    if (text == null) return null
    const normalized = String(text).replace(',', '.')
    if (normalized === '' || normalized === '.') return null
    const n = parseFloat(normalized)
    return Number.isFinite(n) ? n : null
}

export function clampNumber(value, { min, max } = {}) {
    if (!Number.isFinite(value)) return value
    if (Number.isFinite(min) && value < min) return min
    if (Number.isFinite(max) && value > max) return max
    return value
}

export function formatNumericValue(value, { decimals = 2 } = {}) {
    if (!Number.isFinite(value)) return ''

    let fixed = value.toFixed(decimals)
    // Só corta zeros à direita se existir parte decimal — senão 1000 viraria 1.
    if (fixed.includes('.')) {
        fixed = fixed.replace(/0+$/, '').replace(/\.$/, '')
    }
    return fixed.replace('.', ',')
}
```

- [ ] **Step 7: Rodar os testes e confirmar que passam**

Run: `npm test`
Expected: PASS — 18 testes passando

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.js src/lib/numberInput.js src/lib/numberInput.test.js
git commit -m "feat: add pure numeric input helpers with vitest setup"
```

---

### Task 2: `NumberField` e substituição dos inputs do simulador

Entrega o requisito 1 completo. `type="text"` + `inputMode="decimal"` elimina as setinhas em todos os navegadores de uma vez, elimina o scroll-para-alterar (que só existe em `type="number"`) e faz ArrowUp/ArrowDown pararem de mexer no valor — tudo sem CSS de vendor prefix e sem handler de teclado.

**Files:**
- Create: `src/components/NumberField.jsx`
- Modify: `src/app/investments/page.jsx` — os 4 campos do painel do simulador (hoje em `:220-276`) e o bloco de imports

- [ ] **Step 1: Criar o componente**

Criar `src/components/NumberField.jsx`:

```jsx
"use client";

import { useEffect, useState } from 'react'
import { sanitizeNumericText, parseNumericText, clampNumber, formatNumericValue } from '../lib/numberInput'

// Input numérico que aceita apenas digitação.
//
// type="text" + inputMode="decimal" em vez de type="number" porque type="number"
// traz as setinhas de incremento e altera o valor com a roda do mouse. Esconder
// as setinhas exigiria -webkit-appearance: none E -moz-appearance: textfield, e
// mesmo assim o scroll continuaria funcionando. inputMode mantém o teclado
// numérico no celular.
//
// O estado local guarda o TEXTO, não o número: guardando só Number, o usuário
// não consegue digitar "1," nem limpar o campo para redigitar, porque o React
// reescreve o valor no meio da digitação e o cursor pula.
export default function NumberField({
    value,
    onChange,
    min,
    max,
    decimals = 2,
    icon,
    suffix,
    ariaLabel,
}) {
    const [text, setText] = useState(() => formatNumericValue(value, { decimals }))
    const [editing, setEditing] = useState(false)

    // Reflete mudanças externas (ex: a taxa puxada do BCB) sem atropelar quem
    // está digitando naquele instante.
    useEffect(() => {
        if (editing) return
        setText(formatNumericValue(value, { decimals }))
    }, [value, decimals, editing])

    const handleChange = e => {
        const next = sanitizeNumericText(e.target.value, { decimals })
        setText(next)
        const parsed = parseNumericText(next)
        // Campo vazio propaga 0 para o cálculo, mas o display continua vazio.
        onChange(parsed === null ? 0 : parsed)
    }

    // Clamp só no blur. Clampando por tecla, um campo com min={1} impediria
    // apagar o conteúdo para digitar "10".
    const handleBlur = () => {
        setEditing(false)
        const fallback = Number.isFinite(min) ? min : 0
        const parsed = parseNumericText(text)
        const settled = parsed === null ? fallback : clampNumber(parsed, { min, max })

        onChange(settled)
        setText(formatNumericValue(settled, { decimals }))
    }

    return (
        <div className="tx-field" style={{ position: 'relative', margin: 0 }}>
            {icon && (
                <span
                    className="icon"
                    style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
                >
                    {icon}
                </span>
            )}
            <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                aria-label={ariaLabel}
                style={{ paddingLeft: icon ? 40 : 14, paddingRight: suffix ? 36 : 14 }}
                value={text}
                onChange={handleChange}
                onFocus={() => setEditing(true)}
                onBlur={handleBlur}
            />
            {suffix && (
                <span
                    style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}
                >
                    {suffix}
                </span>
            )}
        </div>
    )
}
```

- [ ] **Step 2: Importar o componente na página**

Em `src/app/investments/page.jsx`, depois da linha 6 (`import Wallet from '../../components/Wallet'`), adicionar:

```jsx
import NumberField from '../../components/NumberField'
```

- [ ] **Step 3: Substituir os quatro campos**

Em `src/app/investments/page.jsx`, dentro do painel de controles do simulador (o `<div className="card glass-panel">` que vem depois do `<h3>` "Simulador de Juros Compostos"), substituir os quatro `<div>` de campo — do que tem o label "Valor Inicial" até o que tem "Período (Anos)", parando **antes** do `<div style={{ marginTop: 'auto', ... }}>` que contém o resumo — por:

> Ancoragem por conteúdo em vez de número de linha: o Step 2 acima inseriu um import e deslocou todas as linhas do arquivo.

```jsx
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Valor Inicial</label>
                            <NumberField
                                value={simInitial}
                                onChange={setSimInitial}
                                min={0}
                                max={1000000000}
                                decimals={2}
                                icon="💰"
                                ariaLabel="Valor inicial"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Aporte Mensal</label>
                            <NumberField
                                value={simMonthly}
                                onChange={setSimMonthly}
                                min={0}
                                max={1000000000}
                                decimals={2}
                                icon="📅"
                                ariaLabel="Aporte mensal"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Taxa de Rendimento Anual (%)</label>
                            <NumberField
                                value={simRate}
                                onChange={setSimRate}
                                min={0}
                                max={100}
                                decimals={2}
                                icon="📈"
                                suffix="%"
                                ariaLabel="Taxa de rendimento anual"
                            />
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>Ex: 10.4 para CDI/Selic atual</div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Período (Anos)</label>
                            <NumberField
                                value={simYears}
                                onChange={setSimYears}
                                min={1}
                                max={50}
                                decimals={0}
                                icon="⏳"
                                ariaLabel="Período em anos"
                            />
                        </div>
```

A dica `Ex: 10.4 para CDI/Selic atual` fica de propósito nesta task — ela é substituída pela linha de status na Task 6, e apagar agora deixaria o campo sem nenhuma legenda no meio do caminho.

- [ ] **Step 4: Verificar o build**

Run: `npm run build`
Expected: build concluído sem erro, incluindo a rota `/investments`

- [ ] **Step 5: Conferir no navegador**

Run: `npm run dev` e abrir `http://localhost:3000/investments`

Confirmar nos quatro campos do simulador:
- não existe seta de incremento em nenhum campo
- rolar a roda do mouse com o campo focado **não** altera o valor (a página rola normal)
- ArrowUp e ArrowDown não alteram o valor
- digitar `1500,75` no Valor Inicial funciona, e o gráfico reage
- apagar o campo todo deixa ele vazio (não pula pra `0` durante a digitação) e ao sair do campo assume o mínimo
- digitar `99` no Período e sair do campo aplica o clamp para `50`
- letras e símbolos são ignorados

- [ ] **Step 6: Commit**

```bash
git add src/components/NumberField.jsx src/app/investments/page.jsx
git commit -m "feat: replace number inputs with typing-only NumberField

type=number brings increment arrows and changes value on mouse wheel.
Switching to type=text with inputMode=decimal removes both across every
browser without vendor-prefixed CSS, and also stops ArrowUp/ArrowDown
from stepping the value."
```

---

### Task 3: `rates.js` — séries do Banco Central

**Files:**
- Create: `src/lib/rates.js`
- Test: `src/lib/rates.test.js`

Todas as séries e valores abaixo foram validados ao vivo em 25/07/2026.

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/rates.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
    SGS_SERIES,
    FALLBACK_RATES,
    monthlyToAnnual,
    parseSeriesResponse,
    buildSeriesUrl,
    fetchAllRates,
} from './rates'

describe('monthlyToAnnual', () => {
    it('anualiza o rendimento da poupança geometricamente', () => {
        expect(monthlyToAnnual(0.6723)).toBe(8.37)
    })

    it('anualiza 1% ao mês', () => {
        expect(monthlyToAnnual(1)).toBe(12.68)
    })
})

describe('parseSeriesResponse', () => {
    it('lê o valor string de uma série anual', () => {
        expect(parseSeriesResponse([{ data: '23/07/2026', valor: '14.15' }], 'annual'))
            .toEqual({ value: 14.15, date: '23/07/2026' })
    })

    it('pega o item mais recente da janela', () => {
        const payload = [
            { data: '17/06/2026', valor: '14.40' },
            { data: '23/07/2026', valor: '14.15' },
        ]
        expect(parseSeriesResponse(payload, 'annual').value).toBe(14.15)
    })

    it('anualiza série mensal', () => {
        expect(parseSeriesResponse([{ data: '23/07/2026', valor: '0.6723' }], 'monthly').value).toBe(8.37)
    })

    it('devolve null para array vazio', () => {
        expect(parseSeriesResponse([], 'annual')).toBeNull()
    })

    it('devolve null para valor não numérico', () => {
        expect(parseSeriesResponse([{ data: '23/07/2026', valor: 'n/d' }], 'annual')).toBeNull()
    })

    it('devolve null para payload que não é array', () => {
        expect(parseSeriesResponse({ erro: 'indisponível' }, 'annual')).toBeNull()
    })
})

describe('buildSeriesUrl', () => {
    it('monta a janela de 45 dias com barras literais na data', () => {
        const url = buildSeriesUrl(4389, new Date(2026, 6, 25), 45)
        expect(url).toContain('bcdata.sgs.4389/dados?formato=json')
        expect(url).toContain('dataFinal=25/07/2026')
        expect(url).toContain('dataInicial=10/06/2026')
    })
})

describe('SGS_SERIES', () => {
    it('usa a Selic efetiva (1178), não a meta (432)', () => {
        expect(SGS_SERIES.selic.code).toBe(1178)
    })

    it('marca a poupança como série mensal', () => {
        expect(SGS_SERIES.poupanca.unit).toBe('monthly')
    })
})

describe('fetchAllRates', () => {
    const ok = payload => ({ ok: true, json: async () => payload })

    const byCode = {
        4389: [{ data: '23/07/2026', valor: '14.15' }],
        1178: [{ data: '24/07/2026', valor: '14.15' }],
        13522: [{ data: '01/06/2026', valor: '4.64' }],
        195: [{ data: '23/07/2026', valor: '0.6723' }],
    }

    it('agrega as quatro séries sem degradar nenhuma', async () => {
        const fetchImpl = async url => ok(byCode[url.match(/sgs\.(\d+)/)[1]])

        const { rates, degraded } = await fetchAllRates({ fetchImpl })

        expect(degraded).toEqual([])
        expect(rates.cdi.value).toBe(14.15)
        expect(rates.cdi.date).toBe('23/07/2026')
        expect(rates.ipca12.value).toBe(4.64)
        expect(rates.poupanca.value).toBe(8.37)
    })

    it('cai no fallback quando a série volta array vazio', async () => {
        // Falha real observada: a série 4389 respondeu [] numa chamada.
        const fetchImpl = async url =>
            url.includes('sgs.4389') ? ok([]) : ok(byCode[url.match(/sgs\.(\d+)/)[1]])

        const { rates, degraded } = await fetchAllRates({ fetchImpl })

        expect(degraded).toEqual(['cdi'])
        expect(rates.cdi.value).toBe(FALLBACK_RATES.cdi.value)
        expect(rates.cdi.stale).toBe(true)
        expect(rates.selic.stale).toBeUndefined()
    })

    it('cai no fallback quando o fetch rejeita', async () => {
        const fetchImpl = async () => { throw new Error('rede fora') }

        const { rates, degraded } = await fetchAllRates({ fetchImpl })

        expect(degraded).toEqual(['cdi', 'selic', 'ipca12', 'poupanca'])
        expect(rates.selic.value).toBe(FALLBACK_RATES.selic.value)
    })

    it('cai no fallback quando o BCB responde erro HTTP', async () => {
        const fetchImpl = async () => ({ ok: false, status: 503, json: async () => ({}) })

        const { degraded } = await fetchAllRates({ fetchImpl })

        expect(degraded).toHaveLength(4)
    })

    it('repassa fetchOptions para o fetch', async () => {
        const seen = []
        const fetchImpl = async (url, init) => {
            seen.push(init)
            return ok(byCode[url.match(/sgs\.(\d+)/)[1]])
        }

        await fetchAllRates({ fetchImpl, fetchOptions: { next: { revalidate: 3600 } } })

        expect(seen).toHaveLength(4)
        expect(seen[0].next).toEqual({ revalidate: 3600 })
    })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./rates"`

- [ ] **Step 3: Implementar o módulo**

Criar `src/lib/rates.js`:

```js
// Séries do SGS (Sistema Gerenciador de Séries Temporais) do Banco Central.
// API pública, sem chave. Todas validadas em 25/07/2026.
//
// Nota sobre a Selic: usamos a série 1178 (efetiva anualizada base 252) e não a
// 432 (meta do Copom). A 432 retorna a data de vigência FUTURA da meta — em
// 25/07/2026 devolveu 05/08/2026 — e é a efetiva que de fato rende.
export const SGS_SERIES = {
    cdi: { code: 4389, unit: 'annual', label: 'CDI' },
    selic: { code: 1178, unit: 'annual', label: 'Selic' },
    ipca12: { code: 13522, unit: 'annual', label: 'IPCA' },
    poupanca: { code: 195, unit: 'monthly', label: 'Poupança' },
}

// Último valor conhecido de cada série, já anualizado, observado em 25/07/2026.
// Serve para dois propósitos: estado inicial antes do fetch resolver (o gráfico
// nunca renderiza vazio nem com NaN) e fallback se o BCB falhar.
export const FALLBACK_RATES = {
    cdi: { value: 14.15, date: '23/07/2026' },
    selic: { value: 14.15, date: '24/07/2026' },
    ipca12: { value: 4.64, date: '01/06/2026' },
    poupanca: { value: 8.37, date: '23/07/2026' },
}

const SGS_BASE = 'https://api.bcb.gov.br/dados/serie'

function round2(n) {
    return Math.round(n * 100) / 100
}

export function monthlyToAnnual(monthlyPercent) {
    return round2((Math.pow(1 + monthlyPercent / 100, 12) - 1) * 100)
}

function formatSgsDate(date) {
    const dd = String(date.getDate()).padStart(2, '0')
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}/${date.getFullYear()}`
}

// Usa janela de datas em vez de /ultimos/1: foi justamente o /ultimos/1 que
// respondeu array vazio na investigação. A janela cobre feriados e atrasos de
// publicação, e o item mais recente é o último do array.
export function buildSeriesUrl(code, today = new Date(), windowDays = 45) {
    const start = new Date(today)
    start.setDate(start.getDate() - windowDays)

    // Query montada à mão para manter as barras literais nas datas, que é o
    // formato que a API aceita.
    return `${SGS_BASE}/bcdata.sgs.${code}/dados?formato=json&dataInicial=${formatSgsDate(start)}&dataFinal=${formatSgsDate(today)}`
}

// O campo `valor` vem como string com ponto decimal ("14.15").
export function parseSeriesResponse(payload, unit) {
    if (!Array.isArray(payload) || payload.length === 0) return null

    const latest = payload[payload.length - 1]
    const value = parseFloat(latest?.valor)
    if (!Number.isFinite(value)) return null

    return {
        value: unit === 'monthly' ? monthlyToAnnual(value) : round2(value),
        date: latest.data,
    }
}

// Nunca lança: cada série que falha cai no seu fallback e entra em `degraded`,
// para a UI poder avisar que está exibindo o último valor conhecido.
export async function fetchAllRates({ fetchImpl = fetch, now = new Date(), fetchOptions = {} } = {}) {
    const keys = Object.keys(SGS_SERIES)

    const settled = await Promise.allSettled(
        keys.map(async key => {
            const { code, unit } = SGS_SERIES[key]
            const res = await fetchImpl(buildSeriesUrl(code, now), {
                headers: { Accept: 'application/json' },
                ...fetchOptions,
            })
            if (!res.ok) throw new Error(`SGS ${code} respondeu ${res.status}`)
            return parseSeriesResponse(await res.json(), unit)
        })
    )

    const rates = {}
    const degraded = []

    keys.forEach((key, i) => {
        const result = settled[i]
        const parsed = result.status === 'fulfilled' ? result.value : null

        if (parsed) {
            rates[key] = parsed
        } else {
            rates[key] = { ...FALLBACK_RATES[key], stale: true }
            degraded.push(key)
        }
    })

    return { rates, degraded }
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npm test`
Expected: PASS — todos os testes de `numberInput` e `rates`

- [ ] **Step 5: Confirmar contra a API real**

Run:

```bash
curl -s "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados?formato=json&dataInicial=10/06/2026&dataFinal=25/07/2026" | tail -c 120
```

Expected: JSON com objetos `{"data":"...","valor":"14.15"}`, confirmando o formato que `parseSeriesResponse` espera. Se o valor tiver mudado desde 25/07/2026, atualizar `FALLBACK_RATES` com o valor e a data novos.

- [ ] **Step 6: Commit**

```bash
git add src/lib/rates.js src/lib/rates.test.js
git commit -m "feat: add Banco Central SGS rate fetching with per-series fallback"
```

---

### Task 4: Route handler e hook `useRates`

**Files:**
- Create: `src/app/api/rates/route.js`
- Create: `src/hooks/useRates.js`

A partir do Next 15, route handlers `GET` não são cacheados por padrão, então `export const revalidate` sozinho não garante cache. O cache que importa aqui é aplicado nos 4 fetches para o BCB via `next: { revalidate }` (Data Cache), que é compartilhado entre requisições e estável entre versões do Next. O header `Cache-Control` cobre a camada de CDN e browser.

- [ ] **Step 1: Criar o route handler**

Criar `src/app/api/rates/route.js`:

```js
import { fetchAllRates, FALLBACK_RATES } from '../../../lib/rates'

const ONE_HOUR = 3600

export async function GET() {
    let payload

    try {
        // O cache vai no fetch do BCB (Data Cache do Next), não no route handler:
        // a partir do Next 15 o GET handler não é cacheado por padrão. As taxas só
        // mudam a cada reunião do Copom (~45 dias), então 1h é folgado.
        const { rates, degraded } = await fetchAllRates({
            fetchOptions: { next: { revalidate: ONE_HOUR } },
        })
        payload = { rates, degraded }
    } catch {
        // fetchAllRates já não lança, mas uma taxa indisponível não pode virar
        // 500 e derrubar o simulador. Rede de segurança.
        payload = {
            rates: Object.fromEntries(
                Object.entries(FALLBACK_RATES).map(([k, v]) => [k, { ...v, stale: true }])
            ),
            degraded: Object.keys(FALLBACK_RATES),
        }
    }

    return Response.json(
        { ...payload, fetchedAt: new Date().toISOString() },
        {
            headers: {
                'Cache-Control': `public, s-maxage=${ONE_HOUR}, stale-while-revalidate=86400`,
            },
        }
    )
}
```

- [ ] **Step 2: Criar o hook**

Criar `src/hooks/useRates.js`:

```js
"use client";

import { useEffect, useState } from 'react'
import { FALLBACK_RATES } from '../lib/rates'

// Diferente de useTransactions, este hook busca sozinho na montagem: não depende
// de parâmetro do usuário e não tem mutação, então não faz sentido exigir um
// load() manual de quem consome.
//
// O estado inicial já vem com FALLBACK_RATES e degraded cheio: antes da resposta
// chegar o simulador exibe números reais em vez de NaN, e `loading` distingue
// "ainda buscando" de "buscou e falhou".
export function useRates() {
    const [rates, setRates] = useState(FALLBACK_RATES)
    const [degraded, setDegraded] = useState(() => Object.keys(FALLBACK_RATES))
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                const res = await fetch('/api/rates')
                if (!res.ok) throw new Error(`/api/rates respondeu ${res.status}`)

                const data = await res.json()
                if (cancelled) return

                setRates(data.rates)
                setDegraded(data.degraded || [])
            } catch {
                // Mantém FALLBACK_RATES e o degraded inicial: a UI avisa que está
                // usando o último valor conhecido.
            } finally {
                if (!cancelled) setLoading(false)
            }
        }

        load()
        return () => { cancelled = true }
    }, [])

    return { rates, degraded, loading }
}
```

- [ ] **Step 3: Verificar o build**

Run: `npm run build`
Expected: build concluído, com a rota `/api/rates` listada na saída

- [ ] **Step 4: Confirmar o endpoint no ar**

Run: `npm run dev` e, em outro terminal:

```bash
curl -s http://localhost:3000/api/rates
```

Expected: JSON com as 4 chaves em `rates` (`cdi`, `selic`, `ipca12`, `poupanca`), cada uma com `value` e `date`, e `degraded` como array vazio. Se alguma série aparecer em `degraded` com `stale: true`, o fallback funcionou — verificar se é indisponibilidade real do BCB e não erro de parse.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/rates/route.js src/hooks/useRates.js
git commit -m "feat: serve aggregated BCB rates from cached route handler

Caching goes on the upstream BCB fetches rather than the route handler
because GET handlers stopped being cached by default in Next 15."
```

---

### Task 5: Catálogo de produtos e `formatPercent`

**Files:**
- Create: `src/lib/investmentProducts.js`
- Test: `src/lib/investmentProducts.test.js`
- Modify: `src/helpers.js` (adicionar `formatPercent` no fim do arquivo)
- Test: `src/helpers.test.js`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/lib/investmentProducts.test.js`:

```js
import { describe, it, expect } from 'vitest'
import {
    INVESTMENT_PRODUCTS,
    DEFAULT_PRODUCT_ID,
    getProduct,
    deriveRate,
    multiplierLabel,
} from './investmentProducts'

const RATES = {
    cdi: { value: 14.15, date: '23/07/2026' },
    selic: { value: 14.15, date: '24/07/2026' },
    ipca12: { value: 4.64, date: '01/06/2026' },
    poupanca: { value: 8.37, date: '23/07/2026' },
}

describe('deriveRate', () => {
    it('percent_of aplica o multiplicador sobre o índice', () => {
        expect(deriveRate(getProduct('lci_lca'), RATES, 95)).toBe(13.44)
    })

    it('percent_of com 100% devolve o próprio índice', () => {
        expect(deriveRate(getProduct('cdb'), RATES, 100)).toBe(14.15)
    })

    it('percent_of acima de 100% rende mais que o índice', () => {
        expect(deriveRate(getProduct('cdb'), RATES, 120)).toBe(16.98)
    })

    it('spread soma ao índice', () => {
        expect(deriveRate(getProduct('tesouro_ipca'), RATES, 6)).toBe(10.64)
    })

    it('none ignora o multiplicador', () => {
        expect(deriveRate(getProduct('poupanca'), RATES, 999)).toBe(8.37)
    })

    it('devolve null para produto sem índice, para não sobrescrever taxa digitada', () => {
        expect(deriveRate(getProduct('custom'), RATES, 20)).toBeNull()
    })

    it('devolve null quando o índice não está nas taxas', () => {
        expect(deriveRate(getProduct('cdb'), {}, 100)).toBeNull()
    })

    it('devolve null para multiplicador inválido', () => {
        expect(deriveRate(getProduct('cdb'), RATES, NaN)).toBeNull()
    })

    it('devolve null para produto inexistente', () => {
        expect(deriveRate(getProduct('nao_existe'), RATES, 100)).toBeNull()
    })
})

describe('multiplierLabel', () => {
    it('rotula percent_of com o nome do índice', () => {
        expect(multiplierLabel(getProduct('cdb'))).toBe('% do CDI')
    })

    it('rotula spread com o nome do índice', () => {
        expect(multiplierLabel(getProduct('tesouro_ipca'))).toBe('IPCA + (%)')
    })

    it('devolve null quando o produto não tem multiplicador', () => {
        expect(multiplierLabel(getProduct('poupanca'))).toBeNull()
    })

    it('devolve null para o personalizado', () => {
        expect(multiplierLabel(getProduct('custom'))).toBeNull()
    })
})

describe('catálogo', () => {
    it('o produto default existe', () => {
        expect(getProduct(DEFAULT_PRODUCT_ID)).not.toBeNull()
    })

    it('não tem ids duplicados', () => {
        const ids = INVESTMENT_PRODUCTS.map(p => p.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('multiplierKind none não tem multiplicador default', () => {
        INVESTMENT_PRODUCTS
            .filter(p => p.multiplierKind === 'none')
            .forEach(p => expect(p.defaultMultiplier).toBeNull())
    })

    it('todo produto com multiplicador tem default numérico e indexLabel', () => {
        INVESTMENT_PRODUCTS
            .filter(p => p.multiplierKind !== 'none')
            .forEach(p => {
                expect(typeof p.defaultMultiplier).toBe('number')
                expect(typeof p.indexLabel).toBe('string')
            })
    })

    it('marca poupança e LCI/LCA como isentos de IR', () => {
        expect(getProduct('poupanca').taxExempt).toBe(true)
        expect(getProduct('lci_lca').taxExempt).toBe(true)
        expect(getProduct('cdb').taxExempt).toBe(false)
    })
})
```

Criar `src/helpers.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { formatPercent } from './helpers'

describe('formatPercent', () => {
    it('formata com vírgula decimal', () => {
        expect(formatPercent(14.15)).toBe('14,15%')
    })

    it('completa as casas decimais', () => {
        expect(formatPercent(8.4)).toBe('8,40%')
    })

    it('devolve travessão para valor inválido', () => {
        expect(formatPercent(undefined)).toBe('—')
    })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./investmentProducts"` e `formatPercent is not a function`

- [ ] **Step 3: Implementar o catálogo**

Criar `src/lib/investmentProducts.js`:

```js
// Catálogo dos produtos de renda fixa que o simulador oferece.
//
// `multiplierKind` decide como a taxa sai do índice:
//   percent_of → índice × multiplicador / 100   (CDB 100% do CDI)
//   spread     → índice + multiplicador         (Tesouro IPCA+ 6%)
//   none       → o índice puro, sem campo de multiplicador
//
// Os multiplicadores default são convenções comuns de mercado, não recomendação.
// `taxExempt` só controla um selo informativo — o simulador trabalha com valor
// bruto e não calcula IR.
export const INVESTMENT_PRODUCTS = [
    {
        id: 'poupanca',
        label: 'Poupança',
        icon: '🐷',
        index: 'poupanca',
        indexLabel: 'Poupança',
        multiplierKind: 'none',
        defaultMultiplier: null,
        taxExempt: true,
        hint: null,
    },
    {
        id: 'cdb',
        label: 'CDB / RDB',
        icon: '🏦',
        index: 'cdi',
        indexLabel: 'CDI',
        multiplierKind: 'percent_of',
        defaultMultiplier: 100,
        taxExempt: false,
        hint: null,
    },
    {
        id: 'lci_lca',
        label: 'LCI / LCA',
        icon: '🏗️',
        index: 'cdi',
        indexLabel: 'CDI',
        multiplierKind: 'percent_of',
        defaultMultiplier: 95,
        taxExempt: true,
        hint: null,
    },
    {
        id: 'tesouro_selic',
        label: 'Tesouro Selic',
        icon: '🏛️',
        index: 'selic',
        indexLabel: 'Selic',
        multiplierKind: 'spread',
        defaultMultiplier: 0,
        taxExempt: false,
        hint: null,
    },
    {
        id: 'tesouro_ipca',
        label: 'Tesouro IPCA+',
        icon: '📊',
        index: 'ipca12',
        indexLabel: 'IPCA',
        multiplierKind: 'spread',
        defaultMultiplier: 6,
        taxExempt: false,
        hint: null,
    },
    {
        id: 'tesouro_pre',
        label: 'Tesouro Prefixado',
        icon: '📌',
        index: 'selic',
        indexLabel: 'Selic',
        multiplierKind: 'spread',
        defaultMultiplier: 0,
        taxExempt: false,
        hint: 'A taxa do prefixado é definida por leilão e não tem fonte pública ao vivo. Usamos a Selic como referência — ajuste conforme o seu título.',
    },
    {
        id: 'fundo_di',
        label: 'Fundo DI',
        icon: '📦',
        index: 'cdi',
        indexLabel: 'CDI',
        multiplierKind: 'percent_of',
        defaultMultiplier: 98,
        taxExempt: false,
        hint: null,
    },
    {
        id: 'custom',
        label: 'Personalizado',
        icon: '✏️',
        index: null,
        indexLabel: null,
        multiplierKind: 'none',
        defaultMultiplier: null,
        taxExempt: false,
        hint: null,
    },
]

export const DEFAULT_PRODUCT_ID = 'cdb'

export function getProduct(id) {
    return INVESTMENT_PRODUCTS.find(p => p.id === id) || null
}

// Devolve null quando não há taxa derivável — produto sem índice (Personalizado),
// índice ausente nas taxas, ou multiplicador inválido. Quem consome usa esse null
// para NÃO sobrescrever a taxa que o usuário digitou à mão.
export function deriveRate(product, rates, multiplier) {
    if (!product || !product.index) return null

    const base = rates?.[product.index]?.value
    if (!Number.isFinite(base)) return null

    let rate
    if (product.multiplierKind === 'percent_of') {
        if (!Number.isFinite(multiplier)) return null
        rate = base * (multiplier / 100)
    } else if (product.multiplierKind === 'spread') {
        if (!Number.isFinite(multiplier)) return null
        rate = base + multiplier
    } else {
        rate = base
    }

    return Math.round(rate * 100) / 100
}

export function multiplierLabel(product) {
    if (!product || product.multiplierKind === 'none') return null
    if (product.multiplierKind === 'percent_of') return `% do ${product.indexLabel}`
    return `${product.indexLabel} + (%)`
}
```

- [ ] **Step 4: Adicionar `formatPercent`**

No fim de `src/helpers.js`, depois da função `mapFromDB`, adicionar:

```js
export function formatPercent(value, decimals = 2) {
    if (!Number.isFinite(value)) return '—'
    return `${value.toFixed(decimals).replace('.', ',')}%`
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

Run: `npm test`
Expected: PASS — todos os arquivos de teste passando

- [ ] **Step 6: Commit**

```bash
git add src/lib/investmentProducts.js src/lib/investmentProducts.test.js src/helpers.js src/helpers.test.js
git commit -m "feat: add investment product catalog with rate derivation"
```

---

### Task 6: Ligar o seletor na página

Entrega o requisito 2. `page.jsx` ganha dois estados novos (`productId`, `multiplier`), e o `simRate` existente continua sendo a única entrada do cálculo — a matemática de `simData` nas linhas 50–78 **não muda**.

**Files:**
- Modify: `src/app/investments/page.jsx` — imports, estado, effect de derivação, e o painel de controles

- [ ] **Step 1: Adicionar os imports**

Em `src/app/investments/page.jsx`, o bloco de imports do topo fica assim. Comparado ao estado que a Task 2 deixou, entram duas linhas novas (`useRates` e `investmentProducts`) e a linha dos helpers ganha `formatPercent`:

```jsx
import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import Wallet from '../../components/Wallet'
import NumberField from '../../components/NumberField'
import { useSession } from '../../hooks/useSession'
import { useTransactions } from '../../hooks/useTransactions'
import { useRates } from '../../hooks/useRates'
import { INVESTMENT_PRODUCTS, DEFAULT_PRODUCT_ID, getProduct, deriveRate, multiplierLabel } from '../../lib/investmentProducts'
import { formatCurrency, formatPercent, calcInvestment, CATEGORY_MAP } from '../../helpers'
import { Chart, ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler } from 'chart.js'
```

- [ ] **Step 2: Adicionar o estado do produto**

Substituir o bloco de estado do simulador — do comentário `// Simulator State` até a linha `const [simRate, setSimRate] = useState(10.4)` inclusive, parando **antes** das linhas de `chartRef`/`chartInstance` — por:

```jsx
    // Simulator State
    const { rates, degraded, loading: ratesLoading } = useRates()

    const [productId, setProductId] = useState(DEFAULT_PRODUCT_ID)
    const [multiplier, setMultiplier] = useState(() => getProduct(DEFAULT_PRODUCT_ID).defaultMultiplier)

    const product = getProduct(productId) || getProduct(DEFAULT_PRODUCT_ID)
    const multiplierFieldLabel = multiplierLabel(product)

    const [simInitial, setSimInitial] = useState(1000)
    const [simMonthly, setSimMonthly] = useState(200)
    const [simYears, setSimYears] = useState(5)
    // No primeiro render `rates` já é FALLBACK_RATES, então a taxa inicial sai da
    // mesma derivação que o effect usa depois — sem número mágico duplicado.
    const [simRate, setSimRate] = useState(() => deriveRate(product, rates, multiplier))
```

`product` e `multiplierFieldLabel` são consts comuns, não hooks, então declará-los no meio dos `useState` não afeta a ordem das chamadas de hook. Eles precisam vir antes do `useState` de `simRate`, que os consome no initializer.

- [ ] **Step 3: Adicionar o effect de derivação, os handlers e a linha de status**

Logo depois do `useEffect` de redirect de sessão (o que termina em `}, [session, router])`), adicionar:

```jsx
    // Escreve a taxa derivada em simRate quando produto, multiplicador ou taxas
    // mudam. deriveRate devolve null para o Personalizado, e é isso que impede o
    // effect de atropelar a taxa digitada à mão — sem comparar id nenhum.
    useEffect(() => {
        const derived = deriveRate(product, rates, multiplier)
        if (derived === null) return
        setSimRate(derived)
    }, [product, rates, multiplier])

    const handleProductChange = e => {
        const next = getProduct(e.target.value)
        if (!next) return
        setProductId(next.id)
        if (next.defaultMultiplier !== null) setMultiplier(next.defaultMultiplier)
    }

    // Digitar uma taxa própria muda o produto para Personalizado, o que faz
    // deriveRate devolver null e o effect acima parar de sobrescrever.
    const handleRateChange = rate => {
        setSimRate(rate)
        setProductId('custom')
    }

    // Linha embaixo do campo de taxa, substituindo a dica hardcoded
    // "Ex: 10.4 para CDI/Selic atual", que estava desatualizada.
    const rateStatus = useMemo(() => {
        const muted = 'rgba(255,255,255,0.3)'

        if (!product.index) {
            return { text: 'taxa definida por você', tone: muted }
        }
        if (ratesLoading) {
            return { text: 'buscando taxas no Banco Central…', tone: muted }
        }
        if (degraded.includes(product.index)) {
            return { text: '⚠ não deu pra atualizar; usando último valor conhecido', tone: '#f59e0b' }
        }

        const indexRate = rates[product.index]
        return {
            text: `${product.indexLabel} ${formatPercent(indexRate.value)} a.a. · Banco Central, ${indexRate.date}`,
            tone: muted,
        }
    }, [product, rates, degraded, ratesLoading])
```

- [ ] **Step 4: Substituir o painel de controles**

Substituir o bloco dos quatro `<div>` de campo (que a Task 2 deixou entre a abertura do painel e o `<div style={{ marginTop: 'auto', ... }}>` do resumo) por:

```jsx
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Tipo de Investimento</label>
                            <div className="tx-field" style={{ margin: 0 }}>
                                <select value={productId} onChange={handleProductChange} aria-label="Tipo de investimento">
                                    {INVESTMENT_PRODUCTS.map(p => (
                                        <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                                    ))}
                                </select>
                            </div>
                            {product.hint && (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8, lineHeight: 1.5 }}>
                                    {product.hint}
                                </div>
                            )}
                        </div>

                        {multiplierFieldLabel && (
                            <div>
                                <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>{multiplierFieldLabel}</label>
                                <NumberField
                                    value={multiplier}
                                    onChange={setMultiplier}
                                    min={0}
                                    max={product.multiplierKind === 'percent_of' ? 300 : 50}
                                    decimals={2}
                                    icon={product.multiplierKind === 'percent_of' ? '✖️' : '➕'}
                                    ariaLabel={multiplierFieldLabel}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Valor Inicial</label>
                            <NumberField
                                value={simInitial}
                                onChange={setSimInitial}
                                min={0}
                                max={1000000000}
                                decimals={2}
                                icon="💰"
                                ariaLabel="Valor inicial"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Aporte Mensal</label>
                            <NumberField
                                value={simMonthly}
                                onChange={setSimMonthly}
                                min={0}
                                max={1000000000}
                                decimals={2}
                                icon="📅"
                                ariaLabel="Aporte mensal"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Taxa de Rendimento Anual (%)</label>
                            <NumberField
                                value={simRate}
                                onChange={handleRateChange}
                                min={0}
                                max={100}
                                decimals={2}
                                icon="📈"
                                suffix="%"
                                ariaLabel="Taxa de rendimento anual"
                            />
                            <div style={{ fontSize: 12, marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: rateStatus.tone }}>{rateStatus.text}</span>
                                {product.taxExempt && (
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '2px 6px' }}>
                                        isento de IR
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Período (Anos)</label>
                            <NumberField
                                value={simYears}
                                onChange={setSimYears}
                                min={1}
                                max={50}
                                decimals={0}
                                icon="⏳"
                                ariaLabel="Período em anos"
                            />
                        </div>
```

- [ ] **Step 5: Adicionar o aviso de simulação**

No bloco de resumo do painel (o `<div style={{ marginTop: 'auto', ... }}>`), depois da linha do "Valor Final Bruto", adicionar antes do fechamento da `</div>`:

```jsx
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 16, lineHeight: 1.5 }}>
                                Simulação com taxa constante, em valor bruto — sem descontar impostos ou taxas. Rentabilidade passada não garante retorno futuro.
                            </div>
```

- [ ] **Step 6: Rodar os testes e o build**

Run: `npm test && npm run build`
Expected: todos os testes passando e build concluído sem erro

- [ ] **Step 7: Conferir no navegador**

Run: `npm run dev` e abrir `http://localhost:3000/investments`

Confirmar:
- na carga, o produto é "CDB / RDB", o multiplicador é `100` e a taxa aparece em `14,15` com a linha "CDI 14,15% a.a. · Banco Central, ..."
- trocar para "Poupança" some com o campo de multiplicador, muda a taxa para `8,37` e mostra o selo "isento de IR"
- trocar para "Tesouro IPCA+" mostra o multiplicador com label "IPCA + (%)" em `6`, e a taxa vira `10,64`
- trocar para "LCI / LCA" mostra "% do CDI" em `95`, taxa `13,44`, com selo de isenção
- mudar o multiplicador do CDB de `100` para `120` leva a taxa a `16,98`
- "Tesouro Prefixado" exibe a nota sobre leilão embaixo do seletor
- digitar `30` na Taxa muda o seletor para "Personalizado", faz o campo de multiplicador desaparecer, mostra "taxa definida por você", e a taxa **não** volta sozinha para `14,15`
- voltar o seletor para "CDB / RDB" recupera a taxa `14,15`
- o gráfico e o resumo (Total Investido / Juros Ganhos / Valor Final Bruto) reagem a cada mudança

- [ ] **Step 8: Commit**

```bash
git add src/app/investments/page.jsx
git commit -m "feat: add investment type selector with live BCB rates

Picking a product derives the rate from the current index; typing a rate
by hand switches to Personalizado, which makes deriveRate return null and
stops the effect from overwriting the typed value."
```

---

### Task 7: Verificação final

**Files:** nenhum — só verificação

- [ ] **Step 1: Suíte completa**

Run: `npm test`
Expected: PASS em `numberInput.test.js`, `rates.test.js`, `investmentProducts.test.js`, `helpers.test.js`

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build concluído, com `/api/rates` e `/investments` na lista de rotas

- [ ] **Step 3: Confirmar o comportamento degradado**

Simular a falha do BCB para ver o aviso amarelo. Editar `src/lib/rates.js` temporariamente, trocando `SGS_BASE` por um host inválido:

```js
const SGS_BASE = 'https://api.bcb.gov.br.invalido/dados/serie'
```

Run: `npm run dev` e abrir `http://localhost:3000/investments`
Expected: o simulador carrega normalmente com `14,15` e exibe "⚠ não deu pra atualizar; usando último valor conhecido" em amarelo. Nada de tela branca nem erro 500.

Reverter a mudança:

```bash
git checkout src/lib/rates.js
```

- [ ] **Step 4: Confirmar que nada quebrou no resto da página**

Abrir `http://localhost:3000/investments` e verificar que o card "Total Investido", a seção Wallet e o gráfico continuam renderizando como antes.

- [ ] **Step 5: Commit final se houver ajuste**

Se as etapas acima exigiram alguma correção:

```bash
git add -A
git commit -m "fix: address issues found during final verification"
```

---

## Cobertura do spec

| Requisito do spec | Task |
|---|---|
| Input só-digitação, sem setinha e sem scroll | 2 |
| Estado local em string, clamp no blur, vírgula e ponto | 1, 2 |
| Aplicado nos 4 campos do simulador | 2 |
| 4 séries SGS com anualização da poupança | 3 |
| Janela de 45 dias em vez de `ultimos/1` | 3 |
| `parseFloat` com guarda de `NaN` | 3 |
| Constantes de fallback como estado inicial e rede de segurança | 3, 4 |
| Route handler com cache e sem 500 | 4 |
| `degraded` por série | 3, 4 |
| Catálogo de 8 produtos com multiplicador editável | 5 |
| `deriveRate` devolvendo null para produto sem índice | 5 |
| Selo "isento de IR" sem efeito no cálculo | 5, 6 |
| Seletor, multiplicador condicional, linha de status | 6 |
| Taxa manual virando "Personalizado" | 6 |
| Aviso de simulação | 6 |
| Matemática de `simData` intacta | 6 |
| vitest nos módulos puros | 1, 3, 5 |
