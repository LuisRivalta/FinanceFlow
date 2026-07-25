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

    it('remove separador de milhar quando há ponto e vírgula', () => {
        expect(sanitizeNumericText('1.500,75')).toBe('1500,75')
    })

    it('remove símbolo de moeda e separador de milhar', () => {
        expect(sanitizeNumericText('R$ 1.500,75')).toBe('1500,75')
    })

    it('remove múltiplos separadores de milhar quando há vírgula decimal', () => {
        expect(sanitizeNumericText('12.345.678,90')).toBe('12345678,90')
    })

    it('trata ponto seguido de exatamente 3 dígitos como milhar', () => {
        expect(sanitizeNumericText('1.000')).toBe('1000')
    })

    it('remove múltiplos separadores de milhar mesmo sem vírgula decimal', () => {
        expect(sanitizeNumericText('1.234.567')).toBe('1234567')
    })

    it('mantém ponto com 2 dígitos como decimal (caso taxa CDI)', () => {
        expect(sanitizeNumericText('14.15')).toBe('14,15')
    })

    it('preserva vírgula solta enquanto o usuário digita a parte decimal', () => {
        expect(sanitizeNumericText('1,')).toBe('1,')
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

    it('trata vírgula solta no fim como parte inteira já digitada', () => {
        expect(parseNumericText('1,')).toBe(1)
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

    it('aplica só o máximo quando não há mínimo', () => {
        expect(clampNumber(5, { max: 3 })).toBe(3)
    })

    it('aplica só o mínimo quando não há máximo', () => {
        expect(clampNumber(5, { min: 10 })).toBe(10)
    })

    it('devolve o valor sem alteração quando nenhuma opção é passada', () => {
        expect(clampNumber(7)).toBe(7)
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

    it('devolve vazio para valor undefined', () => {
        expect(formatNumericValue(undefined, { decimals: 2 })).toBe('')
    })
})

describe('truncamento na entrada vs arredondamento na exibição', () => {
    // Comportamento intencionalmente assimétrico: sanitizeNumericText trunca
    // porque está limitando o que o usuário pode digitar (não faz sentido
    // "arredondar" enquanto a pessoa ainda está escrevendo), enquanto
    // formatNumericValue arredonda porque está exibindo o valor final.
    it('entrada trunca as casas, exibição arredonda', () => {
        expect(sanitizeNumericText('1,239')).toBe('1,23')
        expect(formatNumericValue(1.239, { decimals: 2 })).toBe('1,24')
    })
})
