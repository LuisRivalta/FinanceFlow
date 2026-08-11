// Geração de alertas financeiros (contas a receber, financiamentos e faturas)
// e helpers de notificação nativa do navegador — tudo sem custo de API.
//
// NOTA: este arquivo deveria se chamar financialNotifications.js — o Bitdefender
// da máquina de dev bloqueia a criação desse caminho exato. Os nomes exportados
// não mudaram. Ver docs/contas-a-receber-e-notificacoes.md

import { occursIn, dueDayIn } from './receivableSchedule';

function startOfDay(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
}

function daysBetween(from, to) {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}

// Data de vencimento neste mês, respeitando meses mais curtos (ex: dia 31 em fevereiro)
function dueDateFor(dueDay, year, month) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(dueDay || 10, daysInMonth));
}

function severityFor(daysLeft) {
    if (daysLeft < 0) return 'danger';   // vencido
    if (daysLeft <= 1) return 'danger';  // vence hoje ou amanhã
    if (daysLeft <= 3) return 'warning';
    return 'info';
}

function whenLabel(daysLeft) {
    if (daysLeft < 0) return `venceu há ${Math.abs(daysLeft)} dia(s)`;
    if (daysLeft === 0) return 'vence hoje';
    if (daysLeft === 1) return 'vence amanhã';
    return `vence em ${daysLeft} dias`;
}

function formatBRL(amount) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount || 0);
}

/**
 * Monta a lista de alertas ativos a partir dos dados financeiros do usuário.
 *
 * @param {object} data - { receivables, financings, cards, transactions }
 * @param {object} options - { daysAhead: número de dias à frente a considerar, referenceDate }
 * @returns {Array} alertas ordenados por urgência (mais urgente primeiro)
 */
export function generateFinancialNotifications(data = {}, options = {}) {
    const {
        receivables = [],
        financings = [],
        cards = [],
        transactions = []
    } = data;

    const daysAhead = options.daysAhead ?? 5;
    const today = startOfDay(options.referenceDate || new Date());
    const year = today.getFullYear();
    const month = today.getMonth();
    const yearMonth = `${year}-${String(month + 1).padStart(2, '0')}`;

    const alerts = [];

    // Só interessam itens dentro da janela (inclui vencidos do mês corrente)
    const inWindow = (daysLeft) => daysLeft <= daysAhead;

    // 1. Contas a receber ainda não confirmadas neste mês
    receivables.forEach(r => {
        if (!occursIn(r, year, month)) return; // ainda não começou ou já terminou
        if (r.receivedMonths && r.receivedMonths[yearMonth]) return;

        const due = dueDateFor(dueDayIn(r, year, month), year, month);
        const daysLeft = daysBetween(today, due);
        if (!inWindow(daysLeft)) return;

        alerts.push({
            id: `receivable_${r.id}_${yearMonth}`,
            type: 'receivable',
            severity: daysLeft < 0 ? 'warning' : 'success',
            title: `A receber: ${r.name}`,
            message: `${formatBRL(r.amount)}${r.payer ? ` de ${r.payer}` : ''} — ${whenLabel(daysLeft)} (dia ${due.getDate()}).`,
            amount: r.amount,
            daysLeft,
            dueDate: due.toISOString(),
            itemId: r.id,
            yearMonth
        });
    });

    // 2. Parcelas de financiamento em aberto neste mês
    financings.forEach(f => {
        if (f.paidInstallments >= f.totalInstallments) return;

        const paidThisMonth = (f.history || []).some(h => {
            const hDate = new Date(h.date);
            return hDate.getFullYear() === year && hDate.getMonth() === month;
        });
        if (paidThisMonth) return;

        const due = dueDateFor(f.dueDay, year, month);
        const daysLeft = daysBetween(today, due);
        if (!inWindow(daysLeft)) return;

        alerts.push({
            id: `financing_${f.id}_${yearMonth}`,
            type: 'financing',
            severity: severityFor(daysLeft),
            title: `Parcela: ${f.name}`,
            message: `Parcela ${f.paidInstallments + 1}/${f.totalInstallments} de ${formatBRL(f.monthlyPayment)} — ${whenLabel(daysLeft)}.`,
            amount: f.monthlyPayment,
            daysLeft,
            dueDate: due.toISOString(),
            itemId: f.id,
            financingId: f.id,
            yearMonth
        });
    });

    // 3. Faturas de cartão em aberto
    cards.forEach(card => {
        const cardTxs = transactions.filter(t => String(t.creditCardId) === String(card.id));
        const invoiceAmount = cardTxs.reduce((sum, t) => {
            if (t.category === 'invoice_payment') return sum - t.amount;
            if (t.type === 'expense') return sum + t.amount;
            return sum;
        }, 0);

        if (invoiceAmount <= 0) return; // fatura zerada ou já paga

        const due = dueDateFor(card.due_day, year, month);
        const daysLeft = daysBetween(today, due);
        if (!inWindow(daysLeft)) return;

        alerts.push({
            id: `card_${card.id}_${yearMonth}`,
            type: 'card',
            severity: severityFor(daysLeft),
            title: `Fatura: ${card.name}`,
            message: `${formatBRL(invoiceAmount)} em aberto — ${whenLabel(daysLeft)}.`,
            amount: invoiceAmount,
            daysLeft,
            dueDate: due.toISOString(),
            itemId: card.id,
            cardId: card.id,
            yearMonth
        });
    });

    // Mais urgente primeiro; em empate, o maior valor
    return alerts.sort((a, b) => (a.daysLeft - b.daysLeft) || (b.amount - a.amount));
}

/**
 * Pede permissão para notificações nativas do navegador.
 * @returns {Promise<{granted: boolean, reason?: string}>}
 */
export async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
        return { granted: false, reason: 'unsupported' };
    }

    if (Notification.permission === 'granted') return { granted: true };
    if (Notification.permission === 'denied') return { granted: false, reason: 'denied' };

    try {
        const permission = await Notification.requestPermission();
        return { granted: permission === 'granted', reason: permission };
    } catch (err) {
        return { granted: false, reason: err?.message || 'error' };
    }
}

/**
 * Dispara uma notificação nativa, se houver permissão.
 * @returns {boolean} true se a notificação foi enviada
 */
export function sendBrowserNotification(title, options = {}) {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;

    try {
        new Notification(title, { icon: '/favicon.ico', badge: '/favicon.ico', ...options });
        return true;
    } catch (err) {
        console.error('Erro ao enviar notificação do navegador', err);
        return false;
    }
}
