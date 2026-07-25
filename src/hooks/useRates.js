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
//
// IMPORTANTE para quem consome: `degraded` começa cheio de propósito, então
// verifique `loading` ANTES de olhar `degraded` — senão o aviso de "não deu pra
// atualizar" pisca em toda carga de página.
export function useRates() {
    const [rates, setRates] = useState(FALLBACK_RATES)
    const [degraded, setDegraded] = useState(() => Object.keys(FALLBACK_RATES))
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                // Timeout no client também: sem ele, uma resposta que nunca chega
                // deixa `loading` em true pra sempre e a linha de status congela em
                // "buscando taxas…" em vez de admitir a falha.
                const res = await fetch('/api/rates', { signal: AbortSignal.timeout(8000) })
                if (!res.ok) throw new Error(`/api/rates respondeu ${res.status}`)

                const data = await res.json()

                // Sem esta guarda, um payload sem `rates` — um proxy devolvendo
                // envelope de erro com status 200, por exemplo — passaria adiante e
                // a página lançaria TypeError ao ler rates[índice] durante o render.
                // Lançar aqui cai no catch e preserva a degradação honesta.
                if (!data || typeof data.rates !== 'object' || data.rates === null) {
                    throw new Error('payload de /api/rates sem rates')
                }
                if (cancelled) return

                setRates(data.rates)
                setDegraded(Array.isArray(data.degraded) ? data.degraded : [])
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
