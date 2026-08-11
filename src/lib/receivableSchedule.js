// Agenda de uma conta a receber: em quais meses ela ocorre e em que dia.
//
// O cadastro guarda `firstDueDate` ('YYYY-MM-DD'), a data escolhida no
// formulário — é ela que define o mês da primeira ocorrência, então dá para
// lançar algo para o mês que vem sem que apareça no mês corrente.
// Itens antigos só têm `dueDay` + `startDate` (ISO da criação): nesses a
// primeira ocorrência é o mês em que foram cadastrados.

// 'YYYY-MM-DD' parseado como data local — new Date('2026-09-08') seria UTC e
// voltaria um dia em fusos negativos.
function partsFromISODate(value) {
    if (typeof value !== 'string') return null;
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (!match) return null;
    const [, y, m, d] = match;
    return { year: Number(y), month: Number(m) - 1, day: Number(d) };
}

// Mês/dia da primeira ocorrência do item
export function firstDueParts(item) {
    const fromField = partsFromISODate(item?.firstDueDate);
    if (fromField) return fromField;

    const legacyStart = item?.startDate ? new Date(item.startDate) : null;
    const base = legacyStart && !isNaN(legacyStart) ? legacyStart : new Date();
    return {
        year: base.getFullYear(),
        month: base.getMonth(),
        day: parseInt(item?.dueDay) || 10
    };
}

// Quantos meses o mês consultado está à frente da primeira ocorrência
export function monthOffset(item, year, month) {
    const first = firstDueParts(item);
    return (year - first.year) * 12 + (month - first.month);
}

// O item tem recebimento previsto neste mês? (month é 0-11)
export function occursIn(item, year, month) {
    if (!item) return false;

    const offset = monthOffset(item, year, month);
    if (offset < 0) return false; // ainda não começou

    if (item.recurrenceType === 'once') return offset === 0;

    if (item.recurrenceType === 'fixed_duration') {
        const total = parseInt(item.durationMonths) || 0;
        return total ? offset < total : true;
    }

    return true; // indefinite
}

// Dia do recebimento no mês consultado, respeitando meses curtos (dia 31 em fevereiro)
export function dueDayIn(item, year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const day = parseInt(item?.dueDay) || firstDueParts(item).day || 10;
    return Math.min(Math.max(day, 1), daysInMonth);
}

export function dueDateIn(item, year, month) {
    return new Date(year, month, dueDayIn(item, year, month));
}

// Ainda há recebimentos a acontecer (ou acontecendo neste mês)?
export function isStillActive(item, reference = new Date()) {
    const year = reference.getFullYear();
    const month = reference.getMonth();
    if (monthOffset(item, year, month) < 0) return true; // começa no futuro
    return occursIn(item, year, month);
}

function monthYearLabel(year, month) {
    return `${String(month + 1).padStart(2, '0')}/${year}`;
}

// Texto curto do cronograma, usado nos cards da lista de cadastros
export function scheduleLabel(item) {
    const first = firstDueParts(item);
    const day = dueDayIn(item, first.year, first.month);

    if (item?.recurrenceType === 'once') {
        return `Uma vez em ${String(day).padStart(2, '0')}/${monthYearLabel(first.year, first.month)}`;
    }

    if (item?.recurrenceType === 'fixed_duration') {
        const total = parseInt(item.durationMonths) || 0;
        if (total > 0) {
            const lastIndex = first.month + total - 1;
            const lastYear = first.year + Math.floor(lastIndex / 12);
            const lastMonth = ((lastIndex % 12) + 12) % 12;
            return `Dia ${day} — de ${monthYearLabel(first.year, first.month)} a ${monthYearLabel(lastYear, lastMonth)}`;
        }
    }

    return `Dia ${day} de cada mês, a partir de ${monthYearLabel(first.year, first.month)}`;
}

// 'YYYY-MM-DD' de hoje no fuso local, para preencher inputs type="date"
export function todayISODate(reference = new Date()) {
    const y = reference.getFullYear();
    const m = String(reference.getMonth() + 1).padStart(2, '0');
    const d = String(reference.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
