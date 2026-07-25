import { describe, it, expect } from 'vitest'
import { usagePercent } from './cardMetrics'

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
