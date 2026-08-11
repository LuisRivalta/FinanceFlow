import { describe, it, expect } from 'vitest'
import { formatPercent, isUserTransaction, isSpending, calcExpense } from './helpers'

describe('formatPercent', () => {
    it('formata com vírgula decimal', () => {
        expect(formatPercent(14.15)).toBe('14,15%')
    })

    it('completa as casas decimais', () => {
        expect(formatPercent(8.4)).toBe('8,40%')
    })

    it('devolve travessão para valor inválido', () => {
        expect(formatPercent(undefined)).toBe('—')
    })
})

describe('isUserTransaction', () => {
    it('aceita lançamentos normais do usuário', () => {
        expect(isUserTransaction({ type: 'expense', category: 'food' })).toBe(true)
        expect(isUserTransaction({ type: 'income', category: 'salary' })).toBe(true)
    })

    // O cadastro de um financiamento é gravado com type 'expense'
    // (useFinancings.js:98) e chegou a inflar as "Despesas Totais" dos gráficos.
    it('descarta o cadastro de financiamento, que não é um gasto', () => {
        expect(isUserTransaction({ type: 'expense', category: 'system_financing', amount: 510 })).toBe(false)
    })

    it('descarta ativos da carteira e contas a receber', () => {
        expect(isUserTransaction({ type: 'income', category: 'system_asset' })).toBe(false)
        expect(isUserTransaction({ type: 'system', category: 'system_asset' })).toBe(false)
        expect(isUserTransaction({ type: 'system', category: 'system_receivable' })).toBe(false)
    })

    it('não quebra com entrada vazia', () => {
        expect(isUserTransaction(null)).toBe(false)
    })
})

describe('isSpending', () => {
    it('conta a compra no cartão', () => {
        expect(isSpending({ type: 'expense', category: 'food', account: 'credit' })).toBe(true)
    })

    // A fatura só quita compras que já entraram como despesa na categoria delas
    it('não conta o pagamento de fatura, para não duplicar', () => {
        expect(isSpending({ type: 'expense', category: 'invoice_payment' })).toBe(false)
    })

    it('ignora receita e investimento', () => {
        expect(isSpending({ type: 'income', category: 'salary' })).toBe(false)
        expect(isSpending({ type: 'investment', category: 'stocks' })).toBe(false)
    })
})

describe('calcExpense', () => {
    it('soma só os gastos, sem o pagamento da fatura', () => {
        const txs = [
            { type: 'expense', category: 'food', amount: 100 },
            { type: 'expense', category: 'transport', amount: 40 },
            { type: 'expense', category: 'invoice_payment', amount: 140 },
            { type: 'income', category: 'salary', amount: 3000 }
        ]
        expect(calcExpense(txs)).toBe(140)
    })

    it('devolve 0 para lista vazia ou ausente', () => {
        expect(calcExpense([])).toBe(0)
        expect(calcExpense(undefined)).toBe(0)
    })
})
