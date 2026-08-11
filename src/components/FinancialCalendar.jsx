"use client";

import { useState, useMemo } from 'react';
import { formatCurrency, formatDate } from '../helpers';
import { occursIn, dueDayIn } from '../lib/receivableSchedule';
import { CalendarDays, HandCoins, CreditCard, Repeat, Car, Check, Coins, Receipt, X } from 'lucide-react';

// Ícone derivado do `type` do item. Os typeLabel guardam só texto porque a
// mesma string alimenta contextos onde JSX não entra.
const TYPE_ICON = { receivable: HandCoins, card: CreditCard, subscription: Repeat, financing: Car };

function TypeIcon({ type, size = 11 }) {
    const Cmp = TYPE_ICON[type];
    return Cmp ? <Cmp size={size} strokeWidth={2} /> : null;
}

// mode define o escopo do calendário:
//   'receivables' → só contas a receber
//   'payables'    → só contas a pagar (faturas, assinaturas, financiamentos)
//   'all'         → tudo, com os botões de filtro manual
export default function FinancialCalendar({
    receivables = [],
    cards = [],
    financings = [],
    subscriptions = [],
    transactions = [],
    mode = 'all',
    onMarkReceived,
    onPayFinancing,
    onPayCardInvoice
}) {
    const showReceivables = mode !== 'payables';
    const showPayables = mode !== 'receivables';
    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), 1);
    });

    const [selectedDayItems, setSelectedDayItems] = useState(null);
    const [selectedDayNum, setSelectedDayNum] = useState(null);
    const [calendarFilter, setCalendarFilter] = useState('all'); // 'all' | 'receivables' | 'payables'

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-11
    const yearMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

    // Days calculation
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sunday

    // Build items map by day number (1 to daysInMonth)
    const itemsByDay = useMemo(() => {
        const map = {};

        // 1. Contas a Receber
        // Uma conta só entra no mês em que de fato tem recebimento previsto:
        // nada antes do primeiro vencimento nem depois do fim da recorrência.
        if (showReceivables) receivables.forEach(r => {
            if (!occursIn(r, year, month)) return;
            const dueDay = dueDayIn(r, year, month);
            if (!map[dueDay]) map[dueDay] = [];
            const isReceived = r.receivedMonths && r.receivedMonths[yearMonthStr];
            map[dueDay].push({
                id: `rec_${r.id}`,
                name: r.name,
                amount: r.amount,
                type: 'receivable',
                typeLabel: 'Conta a Receber',
                typeColor: '#10b981',
                status: isReceived ? 'received' : 'pending',
                statusLabel: isReceived ? 'Recebido' : 'A Receber',
                payer: r.payer,
                account: r.account,
                rawItem: r,
                dueDay
            });
        });

        // 2. Cartões de Crédito (Vencimento da Fatura)
        if (showPayables) cards.forEach(card => {
            const dueDay = Math.min(card.due_day || 10, daysInMonth);
            if (!map[dueDay]) map[dueDay] = [];

            // Calculate pending invoice for this month
            const cardTxs = transactions.filter(t => String(t.creditCardId) === String(card.id));
            const invoiceAmount = cardTxs.reduce((sum, t) => {
                if (t.type === 'expense' && t.category !== 'invoice_payment') return sum + t.amount;
                if (t.category === 'invoice_payment') return sum - t.amount;
                return sum;
            }, 0);

            const isPaid = invoiceAmount <= 0;

            map[dueDay].push({
                id: `card_${card.id}`,
                name: `Fatura ${card.name}`,
                amount: invoiceAmount > 0 ? invoiceAmount : card.credit_limit,
                type: 'card',
                typeLabel: 'Fatura Cartão',
                typeColor: '#8b5cf6',
                status: isPaid ? 'paid' : 'pending',
                statusLabel: isPaid ? 'Fatura Paga / Zerada' : 'Fatura em Aberto',
                brand: card.brand,
                closingDay: card.closing_day,
                rawItem: card,
                dueDay
            });
        });

        // 3. Assinaturas no Cartão
        if (showPayables) subscriptions.forEach(sub => {
            const subDate = new Date(sub.date + 'T00:00:00');
            const dueDay = Math.min(subDate.getDate() || 5, daysInMonth);
            if (!map[dueDay]) map[dueDay] = [];
            map[dueDay].push({
                id: `sub_${sub.id}`,
                name: sub.desc,
                amount: sub.amount,
                type: 'subscription',
                typeLabel: 'Assinatura',
                typeColor: '#ec4899',
                status: 'scheduled',
                statusLabel: 'Cobrança Recorrente',
                dueDay
            });
        });

        // 4. Financiamentos & Empréstimos
        if (showPayables) financings.forEach(f => {
            const dueDay = Math.min(f.dueDay || 10, daysInMonth);
            if (!map[dueDay]) map[dueDay] = [];

            const isCompleted = f.paidInstallments >= f.totalInstallments;
            const hasPaidThisMonth = (f.history || []).some(h => {
                const hDate = new Date(h.date);
                return hDate.getFullYear() === year && hDate.getMonth() === month;
            });

            map[dueDay].push({
                id: `fin_${f.id}`,
                name: f.name,
                amount: f.monthlyPayment,
                type: 'financing',
                typeLabel: 'Financiamento / Empréstimo',
                typeColor: '#f59e0b',
                status: isCompleted ? 'completed' : hasPaidThisMonth ? 'paid' : 'pending',
                statusLabel: isCompleted ? 'Quitado' : hasPaidThisMonth ? 'Parcela Paga' : `Parcela ${f.paidInstallments + 1}/${f.totalInstallments}`,
                rawItem: f,
                dueDay
            });
        });

        return map;
    }, [receivables, cards, subscriptions, financings, transactions, year, month, yearMonthStr, daysInMonth, showReceivables, showPayables]);

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
    const goToToday = () => {
        const now = new Date();
        setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    };

    const todayDate = new Date();
    const isCurrentMonthView = todayDate.getFullYear() === year && todayDate.getMonth() === month;
    const todayDayNum = isCurrentMonthView ? todayDate.getDate() : null;

    // Fora do modo 'all' o escopo já foi aplicado na montagem dos itens, então
    // o filtro manual não se aplica.
    const filterItem = (item) => {
        if (mode !== 'all') return true;
        if (calendarFilter === 'receivables') return item.type === 'receivable';
        if (calendarFilter === 'payables') return item.type !== 'receivable';
        return true;
    };

    const headerTitle = mode === 'receivables' ? 'Calendário de Recebimentos'
        : mode === 'payables' ? 'Calendário de Pagamentos'
            : 'Calendário Financeiro';

    const headerSubtitle = mode === 'receivables' ? 'Datas previstas de recebimento das suas contas a receber.'
        : mode === 'payables' ? 'Vencimentos de faturas, assinaturas, financiamentos e empréstimos.'
            : 'Vizualize datas de recebimento, cartões, assinaturas e parcelas.';

    const headerColor = mode === 'receivables' ? '#10b981'
        : mode === 'payables' ? '#8b5cf6'
            : '#60a5fa';

    const handleDayClick = (dayNum, dayItems) => {
        const filtered = (dayItems || []).filter(filterItem);
        setSelectedDayNum(dayNum);
        setSelectedDayItems(filtered);
    };

    return (
        <div className="glass-panel fade-up" style={{ padding: 24, borderRadius: 20 }}>
            {/* Calendar Header Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 42, height: 42, borderRadius: 12, background: `${headerColor}26`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: headerColor }}>
                        <CalendarDays size={20} strokeWidth={1.8} />
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{headerTitle}</h3>
                        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{headerSubtitle}</p>
                    </div>
                </div>

                {/* Month Navigation & Filters */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {/* View Filters — só fazem sentido quando o calendário mostra tudo */}
                    {mode === 'all' && (
                    <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                            onClick={() => setCalendarFilter('all')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: 'none',
                                background: calendarFilter === 'all' ? 'var(--accent-primary)' : 'transparent',
                                color: 'white',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Ver Todos
                        </button>
                        <button
                            onClick={() => setCalendarFilter('receivables')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: 'none',
                                background: calendarFilter === 'receivables' ? '#10b981' : 'transparent',
                                color: 'white',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <HandCoins size={13} strokeWidth={2} /> Receber
                        </button>
                        <button
                            onClick={() => setCalendarFilter('payables')}
                            style={{
                                padding: '6px 12px',
                                borderRadius: 8,
                                border: 'none',
                                background: calendarFilter === 'payables' ? '#8b5cf6' : 'transparent',
                                color: 'white',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            <CreditCard size={13} strokeWidth={2} /> Pagar & Cartões
                        </button>
                    </div>
                    )}

                    {/* Month Picker Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                        <button
                            onClick={prevMonth}
                            style={{ background: 'transparent', border: 'none', color: 'white', padding: '8px 14px', cursor: 'pointer', fontSize: 14 }}
                            title="Mês Anterior"
                        >
                            &lt;
                        </button>
                        <span style={{ padding: '0 16px', fontWeight: 700, fontSize: 14, color: 'white', minWidth: 140, textAlign: 'center' }}>
                            {capitalizedMonth}
                        </span>
                        <button
                            onClick={nextMonth}
                            style={{ background: 'transparent', border: 'none', color: 'white', padding: '8px 14px', cursor: 'pointer', fontSize: 14 }}
                            title="Próximo Mês"
                        >
                            &gt;
                        </button>
                    </div>

                    {!isCurrentMonthView && (
                        <button
                            onClick={goToToday}
                            style={{
                                padding: '8px 14px',
                                borderRadius: 12,
                                background: 'rgba(59,130,246,0.15)',
                                border: '1px solid rgba(59,130,246,0.3)',
                                color: '#60a5fa',
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Hoje
                        </button>
                    )}
                </div>
            </div>

            {/* Weekdays Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, marginBottom: 8, textAlign: 'center' }}>
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day, idx) => (
                    <div key={idx} style={{ fontSize: 12, fontWeight: 700, color: idx === 0 || idx === 6 ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.7)', textTransform: 'uppercase', padding: '6px 0' }}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
                {/* Empty cells before month start */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} style={{ minHeight: 85, borderRadius: 12, background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)' }} />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const dayNum = i + 1;
                    const dayItems = (itemsByDay[dayNum] || []).filter(filterItem);
                    const isToday = dayNum === todayDayNum;

                    const recItems = dayItems.filter(item => item.type === 'receivable');
                    const payItems = dayItems.filter(item => item.type !== 'receivable');

                    return (
                        <div
                            key={dayNum}
                            onClick={() => handleDayClick(dayNum, itemsByDay[dayNum])}
                            style={{
                                minHeight: 85,
                                padding: 8,
                                borderRadius: 12,
                                background: isToday ? 'rgba(59,130,246,0.12)' : dayItems.length > 0 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                                border: isToday ? '2px solid #3b82f6' : dayItems.length > 0 ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.04)',
                                cursor: dayItems.length > 0 ? 'pointer' : 'default',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                transition: 'all 0.2s ease',
                                position: 'relative'
                            }}
                            className={dayItems.length > 0 ? 'calendar-day-hover' : ''}
                        >
                            {/* Day Number */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{
                                    fontSize: 13,
                                    fontWeight: isToday ? 800 : 600,
                                    color: isToday ? '#60a5fa' : 'white',
                                    background: isToday ? 'rgba(59,130,246,0.2)' : 'transparent',
                                    padding: '2px 6px',
                                    borderRadius: 6
                                }}>
                                    {dayNum}
                                </span>
                                {dayItems.length > 0 && (
                                    <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', padding: '1px 5px', borderRadius: 10, fontWeight: 700 }}>
                                        {dayItems.length}
                                    </span>
                                )}
                            </div>

                            {/* Item Badge Dots / Chips */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                                {dayItems.slice(0, 2).map((item, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            fontSize: 10,
                                            fontWeight: 600,
                                            padding: '2px 5px',
                                            borderRadius: 4,
                                            background: `${item.typeColor}22`,
                                            color: item.typeColor,
                                            border: `1px solid ${item.typeColor}44`,
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}
                                        title={`${item.name} - ${formatCurrency(item.amount)}`}
                                    >
                                        {item.name}
                                    </div>
                                ))}

                                {dayItems.length > 2 && (
                                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                                        +{dayItems.length - 2} mais
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Selected Day Modal / Details Drawer */}
            {selectedDayNum && selectedDayItems && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center',
                    padding: 20
                }}>
                    <div className="glass-panel fade-up" style={{ width: '100%', maxWidth: 520, padding: 28, borderRadius: 20, border: '1px solid rgba(255,255,255,0.15)', background: '#111827' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 16 }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                                    <CalendarDays size={18} strokeWidth={2} /> Dia {selectedDayNum} de {capitalizedMonth}
                                </h3>
                                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                                    {selectedDayItems.length} compromisso(s) financeiro(s) nesta data
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedDayNum(null)}
                                style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer', opacity: 0.7 }}
                            >
                                <X size={18} strokeWidth={2} />
                            </button>
                        </div>

                        {/* List of day items */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: 360, overflowY: 'auto', paddingRight: 4 }}>
                            {selectedDayItems.length === 0 ? (
                                <p style={{ color: 'rgba(255,255,255,0.5)', textAlign: 'center', padding: 20 }}>Nenhum lançamento cadastrado neste dia.</p>
                            ) : (
                                selectedDayItems.map((item, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            padding: 16,
                                            borderRadius: 14,
                                            background: 'rgba(255,255,255,0.03)',
                                            border: `1px solid ${item.typeColor}33`,
                                            display: 'flex',
                                            justify: 'space-between',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${item.typeColor}25`, color: item.typeColor }} className="inline-icon-label">
                                                    <TypeIcon type={item.type} /> {item.typeLabel}
                                                </span>
                                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                                                    {item.statusLabel}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
                                                {item.name}
                                            </div>
                                            {item.payer && (
                                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                                                    Pagador: {item.payer}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 16, fontWeight: 800, color: item.type === 'receivable' ? '#10b981' : '#ef4444' }}>
                                                {item.type === 'receivable' ? '+' : '-'} {formatCurrency(item.amount)}
                                            </div>

                                            {/* Quick Actions */}
                                            {item.type === 'receivable' && item.status !== 'received' && (
                                                <button
                                                    onClick={() => {
                                                        if (onMarkReceived) onMarkReceived(item.rawItem.id, yearMonthStr);
                                                        setSelectedDayNum(null);
                                                    }}
                                                    style={{
                                                        marginTop: 6,
                                                        padding: '6px 12px',
                                                        borderRadius: 8,
                                                        background: '#10b981',
                                                        color: 'white',
                                                        border: 'none',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Check size={13} strokeWidth={2.5} /> Confirmar Recebimento
                                                </button>
                                            )}

                                            {item.type === 'financing' && item.status !== 'paid' && item.status !== 'completed' && (
                                                <button
                                                    onClick={() => {
                                                        if (onPayFinancing) onPayFinancing(item.rawItem);
                                                        setSelectedDayNum(null);
                                                    }}
                                                    style={{
                                                        marginTop: 6,
                                                        padding: '6px 12px',
                                                        borderRadius: 8,
                                                        background: '#f59e0b',
                                                        color: 'white',
                                                        border: 'none',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Coins size={13} strokeWidth={2} /> Pagar Parcela
                                                </button>
                                            )}

                                            {item.type === 'card' && item.status !== 'paid' && (
                                                <button
                                                    onClick={() => {
                                                        if (onPayCardInvoice) onPayCardInvoice(item.rawItem, item.amount);
                                                        setSelectedDayNum(null);
                                                    }}
                                                    style={{
                                                        marginTop: 6,
                                                        padding: '6px 12px',
                                                        borderRadius: 8,
                                                        background: '#8b5cf6',
                                                        color: 'white',
                                                        border: 'none',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    <Receipt size={13} strokeWidth={2} /> Pagar Fatura
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div style={{ marginTop: 20, textAlign: 'right' }}>
                            <button
                                onClick={() => setSelectedDayNum(null)}
                                style={{ padding: '8px 20px', borderRadius: 10, background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
