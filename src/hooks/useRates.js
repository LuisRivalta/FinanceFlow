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
