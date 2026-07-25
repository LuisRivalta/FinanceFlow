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

    it('devolve null para payload null, sem lançar', () => {
        expect(parseSeriesResponse(null, 'annual')).toBeNull()
    })

    it('devolve null para item null dentro do array, sem lançar', () => {
        expect(parseSeriesResponse([null], 'annual')).toBeNull()
    })

    // parseFloat('0,6723') devolve 0 e passaria pelo Number.isFinite: a poupança
    // apareceria como 0% a.a. com cara de dado real. Tem que degradar.
    it('devolve null para valor com vírgula decimal em vez de exibir número errado', () => {
        expect(parseSeriesResponse([{ data: '23/07/2026', valor: '0,6723' }], 'monthly')).toBeNull()
        expect(parseSeriesResponse([{ data: '23/07/2026', valor: '14,15' }], 'annual')).toBeNull()
    })

    it('arredonda a série anual para 2 casas', () => {
        expect(parseSeriesResponse([{ data: '23/07/2026', valor: '14.153' }], 'annual').value).toBe(14.15)
    })

    it('devolve null quando a anualização estoura para Infinity', () => {
        expect(parseSeriesResponse([{ data: '23/07/2026', valor: '1e300' }], 'monthly')).toBeNull()
    })
})

describe('buildSeriesUrl', () => {
    it('monta a janela de 45 dias com barras literais na data', () => {
        const url = buildSeriesUrl(4389, new Date(2026, 6, 25), 45)
        expect(url).toContain('bcdata.sgs.4389/dados?formato=json')
        expect(url).toContain('dataFinal=25/07/2026')
        expect(url).toContain('dataInicial=10/06/2026')
    })

    // A produção chama buildSeriesUrl(code, now) sem o terceiro argumento, então o
    // default é o que roda de verdade — e era o único não coberto. Com janela de 5
    // dias a série do IPCA responde 404 e o CDI responde 404 em fim de semana.
    it('usa 45 dias por padrão, sem o terceiro argumento', () => {
        expect(buildSeriesUrl(4389, new Date(2026, 6, 25))).toContain('dataInicial=10/06/2026')
    })
})

describe('SGS_SERIES', () => {
    it('usa a Selic efetiva (1178), não a meta (432)', () => {
        expect(SGS_SERIES.selic.code).toBe(1178)
    })

    it('marca a poupança como série mensal', () => {
        expect(SGS_SERIES.poupanca.unit).toBe('monthly')
    })

    // Se uma série entrar em SGS_SERIES sem entrar em FALLBACK_RATES, a degradação
    // devolve { stale: true } sem value nem date — taxa sem número.
    it('tem exatamente as mesmas chaves de FALLBACK_RATES', () => {
        expect(Object.keys(SGS_SERIES).sort()).toEqual(Object.keys(FALLBACK_RATES).sort())
    })
})

// As assertions de fallback nos testes de fetchAllRates comparam FALLBACK_RATES
// consigo mesmo, então são tautológicas: trocar 14.15 por 9.99 passava verde.
// Estas fixam os literais, para uma edição das constantes ter que ser deliberada.
describe('FALLBACK_RATES', () => {
    it('fixa os últimos valores conhecidos, observados em 25/07/2026', () => {
        expect(FALLBACK_RATES.cdi).toEqual({ value: 14.15, date: '23/07/2026' })
        expect(FALLBACK_RATES.selic).toEqual({ value: 14.15, date: '24/07/2026' })
        expect(FALLBACK_RATES.ipca12).toEqual({ value: 4.64, date: '01/06/2026' })
        expect(FALLBACK_RATES.poupanca).toEqual({ value: 8.37, date: '23/07/2026' })
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

    // O corpo tem que ser VÁLIDO, senão quem barra é o !Array.isArray e o teste
    // passa mesmo sem a checagem de status. Com corpo válido, remover o `!res.ok`
    // faria 99.99% ser exibido como se fosse o CDI.
    it('cai no fallback quando o BCB responde erro HTTP com corpo válido', async () => {
        const fetchImpl = async () => ({
            ok: false,
            status: 503,
            json: async () => [{ data: '23/07/2026', valor: '99.99' }],
        })

        const { rates, degraded } = await fetchAllRates({ fetchImpl })

        expect(degraded).toHaveLength(4)
        expect(rates.cdi.value).toBe(14.15)
        expect(rates.cdi.stale).toBe(true)
    })

    it('cai no fallback quando o fetch é abortado por timeout', async () => {
        const fetchImpl = async () => { throw new DOMException('aborted', 'TimeoutError') }

        const { rates, degraded } = await fetchAllRates({ fetchImpl, timeoutMs: 50 })

        expect(degraded).toHaveLength(4)
        expect(rates.poupanca.stale).toBe(true)
    })

    it('passa um AbortSignal para o fetch por padrão', async () => {
        const seen = []
        const fetchImpl = async (url, init) => {
            seen.push(init)
            return { ok: true, json: async () => [{ data: '23/07/2026', valor: '1.00' }] }
        }

        await fetchAllRates({ fetchImpl })

        expect(seen[0].signal).toBeInstanceOf(AbortSignal)
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
