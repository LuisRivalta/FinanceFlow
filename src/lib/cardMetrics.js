// Percentual do limite já comprometido pela fatura, para a barra de uso.
//
// Devolve sempre 0–100. A barra recebe esse número direto num `width: N%`, então
// NaN ou Infinity vazariam para o CSS e quebrariam o layout em silêncio — daí as
// guardas em vez de dividir e confiar.
export function usagePercent(invoice, limit) {
    if (!Number.isFinite(invoice) || !Number.isFinite(limit)) return 0
    if (limit <= 0) return 0
    if (invoice <= 0) return 0

    const pct = (invoice / limit) * 100
    if (pct >= 100) return 100

    return Math.round(pct)
}
