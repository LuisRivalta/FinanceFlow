import { describe, it, expect } from 'vitest'
import { usagePercent, calcCardInvoice, getInvoiceKey, getInvoiceDueDate, getCardInvoiceBreakdown } from './cardMetrics'

describe('usagePercent', () => {
    it('calcula o percentual do limite usado', () => {
        expect(usagePercent(1240, 16100)) .toBe(8)
        expect(usagePercent(8050, 16100)).toBe(50)
    })

    it('arredonda para inteiro', () => {
        expect(usagePercent(1, 3)).toBe(33)
    })

    // O retorno vai direto num width: N%, então uma divisão por zero vazaria
    // NaN para o CSS e a barra quebraria sem erro nenhum no console.
    it('devolve 0 quando o limite é zero, sem NaN nem Infinity', () => {
        expect(usagePercent(500, 0)).toBe(0)
    })

    it('devolve 0 quando o limite é negativo', () => {
        expect(usagePercent(500, -100)).toBe(0)
    })

    it('trava em 100 quando a fatura passa do limite', () => {
        expect(usagePercent(20000, 16100)).toBe(100)
    })

    it('devolve 0 para fatura negativa, quando o pagamento passou do valor', () => {
        expect(usagePercent(-300, 16100)).toBe(0)
    })

    it('devolve 0 para fatura zerada', () => {
        expect(usagePercent(0, 16100)).toBe(0)
    })

    it('devolve 0 para entrada não finita', () => {
        expect(usagePercent(NaN, 16100)).toBe(0)
        expect(usagePercent(1240, undefined)).toBe(0)
        expect(usagePercent(1240, null)).toBe(0)
    })
})

describe('getInvoiceKey & getInvoiceDueDate', () => {
    it('calcula a chave do mês com base no dia de fechamento', () => {
        // Fechamento dia 25
        expect(getInvoiceKey('2026-07-20', 25)).toBe('2026-07')
        expect(getInvoiceKey('2026-07-28', 25)).toBe('2026-08')
    })

    it('calcula o vencimento da fatura corretamente', () => {
        // Fechamento dia 25, Vencimento dia 10 (mês seguinte)
        expect(getInvoiceDueDate('2026-07', 25, 10)).toBe('2026-08-10')
    })
})

describe('getCardInvoiceBreakdown', () => {
    it('separa as faturas de meses diferentes em objetos distintos', () => {
        const card = { id: 'c1', closing_day: 25, due_day: 10 }
        const txs = [
            { creditCardId: 'c1', type: 'expense', amount: 500, date: '2026-07-15' }, // Fatura 2026-07 (vence 10/08)
            { creditCardId: 'c1', type: 'expense', amount: 300, date: '2026-08-02' }  // Fatura 2026-08 (vence 10/09)
        ]

        const breakdown = getCardInvoiceBreakdown(txs, card, new Date('2026-08-05'))

        expect(breakdown).toHaveLength(2)

        // Fatura de Julho (2026-07)
        expect(breakdown[0].key).toBe('2026-07')
        expect(breakdown[0].totalExpenses).toBe(500)
        expect(breakdown[0].remaining).toBe(500)
        expect(breakdown[0].status).toBe('pending') // a vencer dia 10/08

        // Fatura de Agosto (2026-08)
        expect(breakdown[1].key).toBe('2026-08')
        expect(breakdown[1].totalExpenses).toBe(300)
        expect(breakdown[1].remaining).toBe(300)
        expect(breakdown[1].status).toBe('pending') // a vencer dia 10/09
    })

    it('aloca pagamentos prioritariamente para a fatura mais antiga', () => {
        const card = { id: 'c1', closing_day: 25, due_day: 10 }
        const txs = [
            { creditCardId: 'c1', type: 'expense', amount: 500, date: '2026-07-15' },
            { creditCardId: 'c1', type: 'expense', amount: 300, date: '2026-08-02' },
            { creditCardId: 'c1', type: 'expense', category: 'invoice_payment', amount: 500, date: '2026-08-06' }
        ]

        const breakdown = getCardInvoiceBreakdown(txs, card, new Date('2026-08-07'))

        // Julho 2026 totalmente quitada (500 - 500 = 0)
        expect(breakdown[0].key).toBe('2026-07')
        expect(breakdown[0].remaining).toBe(0)
        expect(breakdown[0].status).toBe('paid')

        // Agosto 2026 continua em aberto (300)
        expect(breakdown[1].key).toBe('2026-08')
        expect(breakdown[1].remaining).toBe(300)
    })

    // Somar centavos em float deixa resíduo (3259.13 + 34.19 + ... - 3577.12 = 4.5e-13),
    // e a fatura quitada ficava marcada como pendente para sempre no painel.
    it('trata como paga a fatura quitada com centavos, sem resíduo de float', () => {
        const card = { id: 'c1', closing_day: 4, due_day: 10 }
        const txs = [
            { creditCardId: 'c1', type: 'expense', amount: 3259.13, date: '2026-07-27' },
            { creditCardId: 'c1', type: 'expense', amount: 34.19, date: '2026-08-01' },
            { creditCardId: 'c1', type: 'expense', amount: 169, date: '2026-08-01' },
            { creditCardId: 'c1', type: 'expense', amount: 74.80, date: '2026-08-02' },
            { creditCardId: 'c1', type: 'expense', amount: 40, date: '2026-08-03' },
            { creditCardId: 'c1', type: 'expense', category: 'invoice_payment', amount: 3577.12, date: '2026-08-05' }
        ]

        const breakdown = getCardInvoiceBreakdown(txs, card, new Date('2026-08-11'))
        const agosto = breakdown.find(inv => inv.key === '2026-08')

        expect(agosto.remaining).toBe(0)
        expect(agosto.status).toBe('paid')
    })
})

describe('calcCardInvoice', () => {
    it('calcula o valor da fatura somando despesas do cartão e subtraindo pagamentos', () => {
        const txs = [
            { creditCardId: 'c1', type: 'expense', amount: 500, date: '2026-07-10' },
            { creditCardId: 'c1', type: 'expense', amount: 200, date: '2026-08-02' },
            { creditCardId: 'c1', type: 'expense', category: 'invoice_payment', amount: 500, date: '2026-08-05' }
        ]
        expect(calcCardInvoice(txs, 'c1', new Date('2026-07-15'))).toBe(500)
        expect(calcCardInvoice(txs, 'c1', new Date('2026-08-10'))).toBe(200)
    })

    it('mantém o saldo em aberto do mês anterior se não houver pagamento ao passar o mês', () => {
        const txs = [
            { creditCardId: 'card_123', type: 'expense', amount: 350, date: '2026-07-20' }
        ]
        expect(calcCardInvoice(txs, 'card_123', new Date('2026-08-05'))).toBe(350)
    })

    it('não considera lançamentos de outros cartões', () => {
        const txs = [
            { creditCardId: 'c1', type: 'expense', amount: 400, date: '2026-08-01' },
            { creditCardId: 'c2', type: 'expense', amount: 800, date: '2026-08-01' }
        ]
        expect(calcCardInvoice(txs, 'c1', new Date('2026-08-05'))).toBe(400)
    })

    it('retorna 0 se a fatura foi totalmente quitada', () => {
        const txs = [
            { creditCardId: 'c1', type: 'expense', amount: 600, date: '2026-08-01' },
            { creditCardId: 'c1', type: 'expense', category: 'invoice_payment', amount: 600, date: '2026-08-03' }
        ]
        expect(calcCardInvoice(txs, 'c1', new Date('2026-08-05'))).toBe(0)
    })
})
