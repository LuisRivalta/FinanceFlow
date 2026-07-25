import { describe, it, expect } from 'vitest'
import { formatPercent } from './helpers'

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
