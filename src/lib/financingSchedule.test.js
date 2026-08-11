import { describe, it, expect } from 'vitest'
import { installmentIndex, hasInstallmentIn, isInstallmentPaid, pendingInstallmentsFor } from './financingSchedule'

// O financiamento real do usuário: começou em 27/07/2026, 24 parcelas de
// R$ 510, a primeira já paga.
const HB20 = {
    name: 'HB20 2014',
    monthlyPayment: 510,
    totalInstallments: 24,
    paidInstallments: 1,
    dueDay: 26,
    startDate: '2026-07-27T17:32:33.070Z'
}

describe('installmentIndex', () => {
    it('conta os meses desde o início', () => {
        expect(installmentIndex(HB20, 2026, 6)).toBe(0)  // julho
        expect(installmentIndex(HB20, 2026, 7)).toBe(1)  // agosto
        expect(installmentIndex(HB20, 2027, 6)).toBe(12)
    })

    it('devolve -1 sem data de início', () => {
        expect(installmentIndex({ monthlyPayment: 100 }, 2026, 7)).toBe(-1)
    })
})

describe('hasInstallmentIn', () => {
    it('cobre exatamente as parcelas contratadas', () => {
        expect(hasInstallmentIn(HB20, 2026, 5)).toBe(false) // antes de começar
        expect(hasInstallmentIn(HB20, 2026, 6)).toBe(true)  // 1/24
        expect(hasInstallmentIn(HB20, 2028, 5)).toBe(true)  // 24/24
        expect(hasInstallmentIn(HB20, 2028, 6)).toBe(false) // quitado
    })
})

describe('isInstallmentPaid', () => {
    it('as pagas são as primeiras da fila', () => {
        expect(isInstallmentPaid(HB20, 2026, 6)).toBe(true)  // 1/24, já paga
        expect(isInstallmentPaid(HB20, 2026, 7)).toBe(false) // 2/24, em aberto
    })
})

describe('pendingInstallmentsFor', () => {
    it('soma só o que falta pagar no mês', () => {
        expect(pendingInstallmentsFor([HB20], 2026, 6)).toBe(0)   // julho já pago
        expect(pendingInstallmentsFor([HB20], 2026, 7)).toBe(510) // agosto em aberto
    })

    it('ignora financiamento que ainda não começou ou já acabou', () => {
        expect(pendingInstallmentsFor([HB20], 2026, 5)).toBe(0)
        expect(pendingInstallmentsFor([HB20], 2028, 6)).toBe(0)
    })

    it('soma vários financiamentos do mesmo mês', () => {
        const emprestimo = { monthlyPayment: 300, totalInstallments: 6, paidInstallments: 0, startDate: '2026-08-01T00:00:00.000Z' }
        expect(pendingInstallmentsFor([HB20, emprestimo], 2026, 7)).toBe(810)
    })

    it('não quebra com lista vazia ou ausente', () => {
        expect(pendingInstallmentsFor([], 2026, 7)).toBe(0)
        expect(pendingInstallmentsFor(undefined, 2026, 7)).toBe(0)
    })
})
