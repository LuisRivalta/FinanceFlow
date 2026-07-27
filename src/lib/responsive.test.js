import { describe, it, expect } from 'vitest'
import { legendPosition, currentLegendPosition } from './responsive'

describe('legendPosition', () => {
    it('joga a legenda pra baixo em celular', () => {
        expect(legendPosition(360)).toBe('bottom')
        expect(legendPosition(414)).toBe('bottom')
    })

    it('mantém à direita em tela larga', () => {
        expect(legendPosition(1024)).toBe('right')
        expect(legendPosition(1440)).toBe('right')
    })

    it('inclui o próprio breakpoint no lado estreito', () => {
        expect(legendPosition(768)).toBe('bottom')
        expect(legendPosition(769)).toBe('right')
    })

    it('aceita breakpoint customizado', () => {
        expect(legendPosition(900, 1024)).toBe('bottom')
        expect(legendPosition(900, 768)).toBe('right')
    })

    // Se window.innerWidth vier undefined por algum motivo, o padrão de desktop é
    // o menos destrutivo: não muda o layout que já existe hoje.
    it('cai em right para largura inválida', () => {
        expect(legendPosition(undefined)).toBe('right')
        expect(legendPosition(NaN)).toBe('right')
        expect(legendPosition(null)).toBe('right')
    })
})

// Este teste existe por causa de um erro concreto: os call sites são useMemo, e
// useMemo executa no render do servidor. Ler window.innerWidth direto ali quebrou
// o build com "ReferenceError: window is not defined" no prerender de /.
//
// O ambiente do vitest é node, sem window, então ele reproduz exatamente o SSR.
describe('currentLegendPosition', () => {
    it('não lança quando window não existe (SSR)', () => {
        expect(typeof window).toBe('undefined')
        expect(() => currentLegendPosition()).not.toThrow()
    })

    it('devolve right no servidor, que é o layout menos destrutivo', () => {
        expect(currentLegendPosition()).toBe('right')
    })

    it('respeita o breakpoint customizado sem quebrar no servidor', () => {
        expect(currentLegendPosition(1024)).toBe('right')
    })
})
