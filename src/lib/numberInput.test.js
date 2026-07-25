import { describe, it, expect } from 'vitest'
import { sanitizeNumericText, parseNumericText, clampNumber, formatNumericValue } from './numberInput'

describe('sanitizeNumericText', () => {
    it('remove letras e símbolos', () => {
        expect(sanitizeNumericText('12a3!')).toBe('123')
    })

    it('aceita vírgula como separador decimal', () => {
        expect(sanitizeNumericText('1,5')).toBe('1,5')
    })

    it('converte ponto em vírgula', () => {
        expect(sanitizeNumericText('1.5')).toBe('1,5')
    })

    it('mantém apenas o primeiro separador', () => {
        expect(sanitizeNumericText('1,5,7')).toBe('1,57')
    })

    it('limita as casas decimais', () => {
        expect(sanitizeNumericText('1,239')).toBe('1,23')
    })

    it('descarta a parte decimal quando decimals é 0', () => {
        expect(sanitizeNumericText('10,9', { decimals: 0 })).toBe('10')
    })

    it('preserva string vazia para o usuário poder apagar o campo', () => {
        expect(sanitizeNumericText('')).toBe('')
    })
})

describe('parseNumericText', () => {
    it('converte vírgula em número', () => {
        expect(parseNumericText('1,5')).toBe(1.5)
    })

    it('devolve null para texto vazio', () => {
        expect(parseNumericText('')).toBeNull()
    })

    it('devolve null para separador solto', () => {
        expect(parseNumericText(',')).toBeNull()
    })
})

describe('clampNumber', () => {
    it('aplica o mínimo', () => {
        expect(clampNumber(0, { min: 1, max: 50 })).toBe(1)
    })

    it('aplica o máximo', () => {
        expect(clampNumber(99, { min: 1, max: 50 })).toBe(50)
    })

    it('não mexe em valor dentro da faixa', () => {
        expect(clampNumber(10, { min: 1, max: 50 })).toBe(10)
    })
})

describe('formatNumericValue', () => {
    it('não engole os zeros de um inteiro redondo', () => {
        expect(formatNumericValue(1000, { decimals: 2 })).toBe('1000')
    })

    it('mantém as casas significativas', () => {
        expect(formatNumericValue(14.15, { decimals: 2 })).toBe('14,15')
    })

    it('corta zero decimal à direita', () => {
        expect(formatNumericValue(14.1, { decimals: 2 })).toBe('14,1')
    })

    it('formata inteiro com decimals 0', () => {
        expect(formatNumericValue(1000, { decimals: 0 })).toBe('1000')
    })

    it('devolve vazio para valor inválido', () => {
        expect(formatNumericValue(NaN, { decimals: 2 })).toBe('')
    })
})
