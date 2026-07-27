import { describe, it, expect } from 'vitest'
import { keplerSpeed, discPoint, discPositions, orbitPoint, bodyPhase } from './orbit'

// RNG determinístico: sem isso não há como testar distribuição.
function seeded(seed) {
    let s = seed
    return () => {
        s = (s * 1664525 + 1013904223) % 4294967296
        return s / 4294967296
    }
}

describe('keplerSpeed', () => {
    it('faz a órbita interna correr mais que a externa', () => {
        expect(keplerSpeed(2.6)).toBeGreaterThan(keplerSpeed(5.3))
    })

    it('segue a proporção r^-3/2', () => {
        // Dobrar o raio deve reduzir a velocidade por 2^1.5 ≈ 2.83.
        const ratio = keplerSpeed(2) / keplerSpeed(4)
        expect(ratio).toBeCloseTo(Math.pow(2, 1.5), 5)
    })

    it('aplica o multiplicador base', () => {
        expect(keplerSpeed(4, 2)).toBeCloseTo(keplerSpeed(4) * 2, 10)
    })

    it('devolve 0 para raio inválido em vez de Infinity', () => {
        expect(keplerSpeed(0)).toBe(0)
        expect(keplerSpeed(-3)).toBe(0)
        expect(keplerSpeed(NaN)).toBe(0)
    })

    it('devolve 0 para base inválida', () => {
        expect(keplerSpeed(4, NaN)).toBe(0)
    })
})

describe('discPoint', () => {
    // Esta é a garantia que impede o defeito original de voltar: nenhum ponto pode
    // se aproximar da câmera, que fica em z=8.
    it('mantém a profundidade limitada a ±thickness', () => {
        const rng = seeded(7)
        for (let i = 0; i < 3000; i++) {
            const [, , z] = discPoint(1.8, 6.4, 0.35, rng)
            expect(Math.abs(z)).toBeLessThanOrEqual(0.35)
        }
    })

    it('mantém o raio dentro da faixa pedida', () => {
        const rng = seeded(11)
        for (let i = 0; i < 3000; i++) {
            const [x, y] = discPoint(1.8, 6.4, 0.35, rng)
            const r = Math.hypot(x, y)
            expect(r).toBeGreaterThanOrEqual(1.8 - 1e-9)
            expect(r).toBeLessThanOrEqual(6.4 + 1e-9)
        }
    })

    it('distribui por área, não acumulando no centro', () => {
        const rng = seeded(23)
        const rInner = 0
        const rOuter = 10
        let inner = 0
        let outer = 0

        // Metade do raio contém 1/4 da área, então ~25% dos pontos.
        for (let i = 0; i < 20000; i++) {
            const [x, y] = discPoint(rInner, rOuter, 0.1, rng)
            if (Math.hypot(x, y) < 5) inner++
            else outer++
        }

        const innerShare = inner / (inner + outer)
        expect(innerShare).toBeGreaterThan(0.2)
        expect(innerShare).toBeLessThan(0.3)
    })

    it('é determinístico com o mesmo seed', () => {
        expect(discPoint(1, 5, 0.3, seeded(99))).toEqual(discPoint(1, 5, 0.3, seeded(99)))
    })
})

describe('discPositions', () => {
    it('devolve um Float32Array com 3 componentes por ponto', () => {
        const arr = discPositions(120, 1.8, 6.4, 0.35, seeded(3))
        expect(arr).toBeInstanceOf(Float32Array)
        expect(arr.length).toBe(360)
    })

    it('não produz NaN em nenhuma coordenada', () => {
        const arr = discPositions(500, 1.8, 6.4, 0.35, seeded(5))
        expect(Array.from(arr).every(Number.isFinite)).toBe(true)
    })
})

describe('orbitPoint', () => {
    it('coloca o corpo sobre o círculo de raio pedido', () => {
        for (const angle of [0, 0.7, Math.PI, 4.2]) {
            const [x, y, z] = orbitPoint(3.9, angle)
            expect(Math.hypot(x, y)).toBeCloseTo(3.9, 10)
            expect(z).toBe(0)
        }
    })

    it('começa no eixo x positivo no ângulo zero', () => {
        expect(orbitPoint(2.6, 0)).toEqual([2.6, 0, 0])
    })

    it('devolve a origem para entrada inválida', () => {
        expect(orbitPoint(NaN, 1)).toEqual([0, 0, 0])
        expect(orbitPoint(3, NaN)).toEqual([0, 0, 0])
    })
})

describe('bodyPhase', () => {
    it('espaça as fases igualmente na volta', () => {
        expect(bodyPhase(0, 4)).toBeCloseTo(0, 10)
        expect(bodyPhase(1, 4)).toBeCloseTo(Math.PI / 2, 10)
        expect(bodyPhase(2, 4)).toBeCloseTo(Math.PI, 10)
    })

    it('devolve 0 para total inválido em vez de dividir por zero', () => {
        expect(bodyPhase(1, 0)).toBe(0)
        expect(bodyPhase(1, NaN)).toBe(0)
    })
})
