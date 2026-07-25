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
