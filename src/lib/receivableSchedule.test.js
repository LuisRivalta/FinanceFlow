import { describe, it, expect } from 'vitest'
import { firstDueParts, monthOffset, occursIn, dueDayIn, isStillActive, scheduleLabel, todayISODate } from './receivableSchedule'

// Agosto/2026 = { year: 2026, month: 7 }
const AGO_2026 = { year: 2026, month: 7 }
const SET_2026 = { year: 2026, month: 8 }

function recurring(firstDueDate) {
    return { firstDueDate, dueDay: Number(firstDueDate.slice(8, 10)), recurrenceType: 'indefinite' }
}

describe('firstDueParts', () => {
    it('lê a data escolhida no cadastro como data local', () => {
        expect(firstDueParts({ firstDueDate: '2026-09-08' })).toEqual({ year: 2026, month: 8, day: 8 })
    })

    it('cai no mês de criação quando o item é antigo e só tem dueDay', () => {
        const legacy = { dueDay: 8, startDate: '2026-03-20T14:00:00.000Z' }
        expect(firstDueParts(legacy)).toEqual({ year: 2026, month: 2, day: 8 })
    })
})

describe('occursIn', () => {
    // O bug original: uma conta cadastrada para o dia 8 do mês que vem aparecia
    // já no dia 8 do mês corrente, que muitas vezes é uma data passada.
    it('não mostra a conta em meses anteriores ao primeiro recebimento', () => {
        const item = recurring('2026-09-08')
        expect(occursIn(item, AGO_2026.year, AGO_2026.month)).toBe(false)
        expect(occursIn(item, SET_2026.year, SET_2026.month)).toBe(true)
    })

    it('repete indefinidamente a partir do primeiro mês', () => {
        const item = recurring('2026-09-08')
        expect(occursIn(item, 2027, 0)).toBe(true)
        expect(occursIn(item, 2030, 11)).toBe(true)
    })

    it('recebimento único ocorre só no mês escolhido', () => {
        const item = { firstDueDate: '2026-09-08', dueDay: 8, recurrenceType: 'once' }
        expect(occursIn(item, 2026, 8)).toBe(true)
        expect(occursIn(item, 2026, 9)).toBe(false)
        expect(occursIn(item, 2026, 7)).toBe(false)
    })

    it('duração determinada cobre exatamente os meses contratados', () => {
        const item = { firstDueDate: '2026-09-08', dueDay: 8, recurrenceType: 'fixed_duration', durationMonths: 3 }
        expect(occursIn(item, 2026, 8)).toBe(true)  // 1/3
        expect(occursIn(item, 2026, 10)).toBe(true) // 3/3
        expect(occursIn(item, 2026, 11)).toBe(false)
    })

    it('sem item não ocorre nada', () => {
        expect(occursIn(null, 2026, 8)).toBe(false)
    })
})

describe('monthOffset', () => {
    it('conta meses atravessando a virada do ano', () => {
        const item = recurring('2026-11-05')
        expect(monthOffset(item, 2027, 1)).toBe(3)
        expect(monthOffset(item, 2026, 9)).toBe(-1)
    })
})

describe('dueDayIn', () => {
    it('mantém o dia escolhido quando o mês comporta', () => {
        expect(dueDayIn(recurring('2026-09-08'), 2026, 8)).toBe(8)
    })

    it('encurta o dia 31 em meses menores', () => {
        expect(dueDayIn(recurring('2026-01-31'), 2026, 1)).toBe(28)
        expect(dueDayIn(recurring('2026-01-31'), 2026, 3)).toBe(30)
    })
})

describe('isStillActive', () => {
    it('conta que ainda vai começar continua ativa', () => {
        expect(isStillActive(recurring('2026-09-08'), new Date(2026, 7, 11))).toBe(true)
    })

    it('duração determinada expira depois do último mês', () => {
        const item = { firstDueDate: '2026-01-10', dueDay: 10, recurrenceType: 'fixed_duration', durationMonths: 3 }
        expect(isStillActive(item, new Date(2026, 2, 15))).toBe(true)
        expect(isStillActive(item, new Date(2026, 3, 15))).toBe(false)
    })
})

describe('scheduleLabel', () => {
    it('descreve recorrência sem prazo', () => {
        expect(scheduleLabel(recurring('2026-09-08'))).toBe('Dia 8 de cada mês, a partir de 09/2026')
    })

    it('descreve recebimento único', () => {
        expect(scheduleLabel({ firstDueDate: '2026-09-08', dueDay: 8, recurrenceType: 'once' })).toBe('Uma vez em 08/09/2026')
    })

    it('descreve o intervalo de uma duração determinada, virando o ano', () => {
        const item = { firstDueDate: '2026-11-05', dueDay: 5, recurrenceType: 'fixed_duration', durationMonths: 4 }
        expect(scheduleLabel(item)).toBe('Dia 5 — de 11/2026 a 02/2027')
    })
})

describe('todayISODate', () => {
    it('formata no fuso local, sem o deslocamento do toISOString', () => {
        expect(todayISODate(new Date(2026, 7, 11, 22, 30))).toBe('2026-08-11')
    })
})
