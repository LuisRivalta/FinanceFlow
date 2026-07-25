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
    const raw = latest?.valor

    // Exige decimal com ponto. parseFloat('0,6723') devolve 0 sem reclamar, e o
    // Number.isFinite abaixo aprovaria: a poupança apareceria como 0,00% a.a. com
    // cara de dado real do BCB, sem stale nem degraded. Degradar é melhor que
    // exibir número errado. Number é aceito caso a API mude o tipo algum dia.
    let value
    if (typeof raw === 'number') value = raw
    else if (typeof raw === 'string' && /^-?\d+(\.\d+)?$/.test(raw)) value = parseFloat(raw)
    else return null

    if (!Number.isFinite(value)) return null

    const annual = unit === 'monthly' ? monthlyToAnnual(value) : round2(value)
    // Guarda na SAÍDA, não só na entrada: monthlyToAnnual eleva a 12, então um
    // valor absurdo estoura para Infinity, que o JSON.stringify serializa como
    // null e chegaria assim no browser.
    if (!Number.isFinite(annual)) return null

    return { value: annual, date: latest.data }
}

// Nunca lança: cada série que falha cai no seu fallback e entra em `degraded`,
// para a UI poder avisar que está exibindo o último valor conhecido.
//
// `timeoutMs` limita o tempo TOTAL das quatro séries com um sinal único. Sem ele,
// uma conexão pendurada do BCB nunca settla: o Promise.allSettled espera todas as
// quatro, então uma trava a resposta inteira mesmo com as outras três prontas —
// e o route handler fica pendurado junto. O abort virou rejeição, que o
// allSettled já converte em degradação por série. O caller pode passar o próprio
// `signal` via fetchOptions para sobrescrever.
export async function fetchAllRates({ fetchImpl = fetch, now = new Date(), fetchOptions = {}, timeoutMs = 5000 } = {}) {
    const keys = Object.keys(SGS_SERIES)
    const signal = Number.isFinite(timeoutMs) && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined

    const settled = await Promise.allSettled(
        keys.map(async key => {
            const { code, unit } = SGS_SERIES[key]
            const res = await fetchImpl(buildSeriesUrl(code, now), {
                headers: { Accept: 'application/json' },
                signal,
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
