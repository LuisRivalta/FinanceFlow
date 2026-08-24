// Parcelas de financiamento/empréstimo que vencem num mês.
//
// O financiamento é um cadastro (não uma transação): guarda valor da parcela,
// total de parcelas, quantas já foram pagas e o dia de vencimento. Sem isso, o
// painel não enxergava nenhum compromisso de financiamento — só via a despesa
// quando o usuário pagava a parcela pelo botão da página Cartões.

// Retorna a data de início (1ª parcela) de um financiamento
export function getFinancingStartDate(item) {
    if (item?.startDate) {
        const d = new Date(item.startDate)
        if (!isNaN(d.getTime())) return d
    }
    if (item?.startMonth) {
        const [y, m] = item.startMonth.split('-')
        const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, Number(item?.dueDay) || 10, 12, 0, 0)
        if (!isNaN(d.getTime())) return d
    }
    return null
}

// Índice da parcela que cai no mês consultado (0 = primeira). Negativo antes
// de começar, >= total depois de acabar.
export function installmentIndex(item, year, month) {
    const start = getFinancingStartDate(item)
    if (!start) return -1
    return (year - start.getFullYear()) * 12 + (month - start.getMonth())
}

// O financiamento tem parcela vencendo neste mês? (month é 0-11)
export function hasInstallmentIn(item, year, month) {
    const total = parseInt(item?.totalInstallments) || 0
    const index = installmentIndex(item, year, month)
    if (index < 0) return false
    return total ? index < total : true
}

// As parcelas pagas são sempre as primeiras: paidInstallments = 3 significa
// que as parcelas 1, 2 e 3 foram quitadas.
export function isInstallmentPaid(item, year, month) {
    const index = installmentIndex(item, year, month)
    if (index < 0) return false
    return index < (parseInt(item?.paidInstallments) || 0)
}

// Total que ainda falta pagar de financiamentos no mês — compromisso financeiro
// do orçamento / margem do mês.
export function pendingInstallmentsFor(financings, year, month) {
    return (financings || []).reduce((sum, item) => {
        if (!hasInstallmentIn(item, year, month)) return sum
        if (isInstallmentPaid(item, year, month)) return sum
        return sum + (Number(item?.monthlyPayment) || 0)
    }, 0)
}
