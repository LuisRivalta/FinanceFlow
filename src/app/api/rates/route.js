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
