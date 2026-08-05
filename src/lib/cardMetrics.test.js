import { describe, it, expect } from 'vitest'
import { usagePercent, calcCardInvoice } from './cardMetrics'

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

describe('calcCardInvoice', () => {
    it('calcula o valor da fatura somando despesas do cartão e subtraindo pagamentos', () => {
        const txs = [
            { creditCardId: 'c1', type: 'expense', amount: 500, date: '2026-07-10' },
            { creditCardId: 'c1', type: 'expense', amount: 200, date: '2026-08-02' },
            { creditCardId: 'c1', type: 'expense', category: 'invoice_payment', amount: 500, date: '2026-08-05' }
        ]
        // Em Julho/2026: apenas a despesa de 500 (em aberto)
        expect(calcCardInvoice(txs, 'c1', new Date('2026-07-15'))).toBe(500)

        // Em Agosto/2026: 500 + 200 - 500 = 200
        expect(calcCardInvoice(txs, 'c1', new Date('2026-08-10'))).toBe(200)
    })

    it('mantém o saldo em aberto do mês anterior se não houver pagamento ao passar o mês', () => {
        const txs = [
            { creditCardId: 'card_123', type: 'expense', amount: 350, date: '2026-07-20' }
        ]
        // Ao mudar para o mês seguinte (Agosto), a fatura de Julho não paga continua devida (R$ 350)
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
