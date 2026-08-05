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

export function calcCardInvoice(transactions, cardId, targetDate = new Date()) {
    if (!Array.isArray(transactions) || !cardId) return 0
    const dObj = typeof targetDate === 'string' ? new Date(targetDate) : targetDate
    const endOfPeriod = new Date(dObj.getFullYear(), dObj.getMonth() + 1, 0, 23, 59, 59)
    const raw = transactions
        .filter(t => {
            if (!t || !t.creditCardId || String(t.creditCardId) !== String(cardId)) return false
            const d = new Date(t.date + 'T00:00:00')
            return d <= endOfPeriod
        })
        .reduce((acc, t) => {
            if (t.category === 'invoice_payment') return acc - t.amount
            if (t.type === 'expense') return acc + t.amount
            return acc
        }, 0)
    return Math.max(0, raw)
}
