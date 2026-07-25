import { describe, it, expect } from 'vitest'
import {
    INVESTMENT_PRODUCTS,
    DEFAULT_PRODUCT_ID,
    getProduct,
    deriveRate,
    multiplierLabel,
} from './investmentProducts'

const RATES = {
    cdi: { value: 14.15, date: '23/07/2026' },
    selic: { value: 14.15, date: '24/07/2026' },
    ipca12: { value: 4.64, date: '01/06/2026' },
    poupanca: { value: 8.37, date: '23/07/2026' },
}

describe('deriveRate', () => {
    it('percent_of aplica o multiplicador sobre o índice', () => {
        expect(deriveRate(getProduct('lci_lca'), RATES, 95)).toBe(13.44)
    })

    it('percent_of com 100% devolve o próprio índice', () => {
        expect(deriveRate(getProduct('cdb'), RATES, 100)).toBe(14.15)
    })

    it('percent_of acima de 100% rende mais que o índice', () => {
        expect(deriveRate(getProduct('cdb'), RATES, 120)).toBe(16.98)
    })

    it('spread soma ao índice', () => {
        expect(deriveRate(getProduct('tesouro_ipca'), RATES, 6)).toBe(10.64)
    })

    it('none ignora o multiplicador', () => {
        expect(deriveRate(getProduct('poupanca'), RATES, 999)).toBe(8.37)
    })

    it('devolve null para produto sem índice, para não sobrescrever taxa digitada', () => {
        expect(deriveRate(getProduct('custom'), RATES, 20)).toBeNull()
    })

    it('devolve null quando o índice não está nas taxas', () => {
        expect(deriveRate(getProduct('cdb'), {}, 100)).toBeNull()
    })

    it('devolve null para multiplicador inválido', () => {
        expect(deriveRate(getProduct('cdb'), RATES, NaN)).toBeNull()
    })

    it('devolve null para produto inexistente', () => {
        expect(deriveRate(getProduct('nao_existe'), RATES, 100)).toBeNull()
    })
})

describe('multiplierLabel', () => {
    it('rotula percent_of com o nome do índice', () => {
        expect(multiplierLabel(getProduct('cdb'))).toBe('% do CDI')
    })

    it('rotula spread com o nome do índice', () => {
        expect(multiplierLabel(getProduct('tesouro_ipca'))).toBe('IPCA + (%)')
    })

    it('devolve null quando o produto não tem multiplicador', () => {
        expect(multiplierLabel(getProduct('poupanca'))).toBeNull()
    })

    it('devolve null para o personalizado', () => {
        expect(multiplierLabel(getProduct('custom'))).toBeNull()
    })
})

describe('catálogo', () => {
    it('o produto default existe', () => {
        expect(getProduct(DEFAULT_PRODUCT_ID)).not.toBeNull()
    })

    it('não tem ids duplicados', () => {
        const ids = INVESTMENT_PRODUCTS.map(p => p.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('multiplierKind none não tem multiplicador default', () => {
        INVESTMENT_PRODUCTS
            .filter(p => p.multiplierKind === 'none')
            .forEach(p => expect(p.defaultMultiplier).toBeNull())
    })

    it('todo produto com multiplicador tem default numérico e indexLabel', () => {
        INVESTMENT_PRODUCTS
            .filter(p => p.multiplierKind !== 'none')
            .forEach(p => {
                expect(typeof p.defaultMultiplier).toBe('number')
                expect(typeof p.indexLabel).toBe('string')
            })
    })

    it('marca poupança e LCI/LCA como isentos de IR', () => {
        expect(getProduct('poupanca').taxExempt).toBe(true)
        expect(getProduct('lci_lca').taxExempt).toBe(true)
        expect(getProduct('cdb').taxExempt).toBe(false)
    })
})
