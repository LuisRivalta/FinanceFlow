// Percentual do limite já comprometido pela fatura, para a barra de uso.
export function usagePercent(invoice, limit) {
    if (!Number.isFinite(invoice) || !Number.isFinite(limit)) return 0
    if (limit <= 0) return 0
    if (invoice <= 0) return 0

    const pct = (invoice / limit) * 100
    if (pct >= 100) return 100

    return Math.round(pct)
}

// Retorna a chave do mês da fatura (YYYY-MM) com base no dia de fechamento do cartão
export function getInvoiceKey(dateStr, closingDay = 25) {
    if (!dateStr) return ''
    const d = new Date(dateStr + 'T00:00:00')
    if (isNaN(d.getTime())) return ''

    let y = d.getFullYear()
    let m = d.getMonth()
    const day = d.getDate()
    const cDay = Number(closingDay) || 25

    if (day > cDay) {
        m += 1
        if (m > 11) {
            m = 0
            y += 1
        }
    }
    return `${y}-${String(m + 1).padStart(2, '0')}`
}

// Retorna a data de vencimento (YYYY-MM-DD) para uma chave de fatura YYYY-MM
export function getInvoiceDueDate(invoiceKey, closingDay = 25, dueDay = 10) {
    if (!invoiceKey || typeof invoiceKey !== 'string') return ''
    const parts = invoiceKey.split('-')
    if (parts.length < 2) return ''
    let y = parseInt(parts[0], 10)
    let m = parseInt(parts[1], 10) - 1

    const cDay = Number(closingDay) || 25
    const dDay = Number(dueDay) || 10

    let dueYear = y
    let dueMonth = m

    if (dDay <= cDay) {
        dueMonth += 1
        if (dueMonth > 11) {
            dueMonth = 0
            dueYear += 1
        }
    }

    const maxDays = new Date(dueYear, dueMonth + 1, 0).getDate()
    const finalDay = Math.min(dDay, maxDays)
    return `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}-${String(finalDay).padStart(2, '0')}`
}

// Calcula o desmembramento mensal das faturas de um cartão
export function getCardInvoiceBreakdown(transactions, card, refDate = new Date()) {
    if (!card) return []
    const cardId = String(card.id)
    const cardTxs = (transactions || []).filter(t => t && t.creditCardId && String(t.creditCardId) === cardId)

    const closingDay = Number(card.closing_day) || 25
    const dueDay = Number(card.due_day) || 10

    const invoiceMap = {}
    let totalPayments = 0

    cardTxs.forEach(t => {
        if (t.category === 'invoice_payment') {
            totalPayments += t.amount
        } else if (t.type === 'expense') {
            const key = getInvoiceKey(t.date, closingDay)
            if (key) {
                if (!invoiceMap[key]) {
                    invoiceMap[key] = {
                        key,
                        totalExpenses: 0,
                        paidAmount: 0,
                        remaining: 0,
                        dueDate: getInvoiceDueDate(key, closingDay, dueDay),
                        txs: []
                    }
                }
                invoiceMap[key].totalExpenses += t.amount
                invoiceMap[key].txs.push(t)
            }
        }
    })

    const sortedKeys = Object.keys(invoiceMap).sort()

    let remainingPayments = totalPayments
    sortedKeys.forEach(key => {
        const inv = invoiceMap[key]
        const paid = Math.min(inv.totalExpenses, remainingPayments)
        inv.paidAmount = paid
        inv.remaining = Math.max(0, inv.totalExpenses - paid)
        remainingPayments -= paid
    })

    const refDateObj = typeof refDate === 'string' ? new Date(refDate + 'T00:00:00') : refDate
    const refDateStr = refDateObj.toISOString().split('T')[0]

    return sortedKeys.map(key => {
        const inv = invoiceMap[key]
        let status = 'open'
        if (inv.remaining === 0) {
            status = 'paid'
        } else if (refDateStr > inv.dueDate) {
            status = 'overdue'
        } else {
            status = 'pending'
        }
        return {
            ...inv,
            status
        }
    })
}

// Mantém calcCardInvoice para compatibilidade retroativa
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
