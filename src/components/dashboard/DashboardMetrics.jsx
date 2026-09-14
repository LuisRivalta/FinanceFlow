import React, { useRef, useEffect, useMemo } from 'react'
import { Check, CreditCard } from 'lucide-react'
import { Chart } from 'chart.js'

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const TOOLTIP_OPTS = {
    backgroundColor: 'rgba(17,24,39,0.95)',
    padding: 12,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1
}

function useSparkline(canvasRef, config) {
    const chartRef = useRef(null)
    useEffect(() => {
        if (!canvasRef.current) return
        if (chartRef.current) chartRef.current.destroy()
        if (config) {
            chartRef.current = new Chart(canvasRef.current, config)
        }
        return () => {
            if (chartRef.current) chartRef.current.destroy()
        }
    }, [config, canvasRef])
}

export default function DashboardMetrics({
    income = 0,
    directExpense = 0,
    directExpenses = [],
    creditExpense = 0,
    creditPurchases = [],
    creditCycle = { purchases: [], periodLabel: null, weekly: [0, 0, 0, 0] },
    creditStatus = { paid: 0, unpaid: 0, nextDueDate: null },
    globalBalance = 0,
    financingDue = 0,
    monthLabelShort = '',
    olderPending = 0,
    investment = 0,
    monthsData,
    onSelectDetail,
    onNavigateInvestments,
    formatCurrency
}) {
    const incRef = useRef(null)
    const expRef = useRef(null)
    const credRef = useRef(null)
    const balRef = useRef(null)
    const invRef = useRef(null)

    const sparkOpts = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => ' ' + fmt(ctx.raw) } }
        },
        scales: {
            x: { display: true, grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } },
            y: { display: false }
        },
        interaction: { mode: 'index', intersect: false }
    }), [])

    const incConfig = useMemo(() => ({
        type: 'line',
        data: {
            labels: monthsData.inc.labels,
            datasets: [{ data: monthsData.inc.data, borderColor: '#10b981', backgroundColor: '#10b98122', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }]
        },
        options: sparkOpts
    }), [monthsData, sparkOpts])

    const expConfig = useMemo(() => ({
        type: 'line',
        data: {
            labels: monthsData.exp.labels,
            datasets: [{ data: monthsData.exp.data, borderColor: '#ef4444', backgroundColor: '#ef444422', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }]
        },
        options: sparkOpts
    }), [monthsData, sparkOpts])

    const credConfig = useMemo(() => ({
        type: 'line',
        data: {
            labels: ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'],
            datasets: [{ data: creditCycle.weekly, borderColor: '#8b5cf6', backgroundColor: '#8b5cf622', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }]
        },
        options: sparkOpts
    }), [creditCycle, sparkOpts])

    const balConfig = useMemo(() => ({
        type: 'line',
        data: {
            labels: monthsData.bal.labels,
            datasets: [{ data: monthsData.bal.data, borderColor: '#3b82f6', backgroundColor: '#3b82f622', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }]
        },
        options: sparkOpts
    }), [monthsData, sparkOpts])

    const invConfig = useMemo(() => ({
        type: 'line',
        data: {
            labels: monthsData.inv.labels,
            datasets: [{ data: monthsData.inv.data, borderColor: '#eab308', backgroundColor: '#eab30822', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }]
        },
        options: sparkOpts
    }), [monthsData, sparkOpts])

    useSparkline(incRef, incConfig)
    useSparkline(expRef, expConfig)
    useSparkline(credRef, credConfig)
    useSparkline(balRef, balConfig)
    useSparkline(invRef, invConfig)

    return (
        <>
            {/* Top Stats Row */}
            <section className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, flexShrink: 0 }}>
                {/* Receitas Totais */}
                <div
                    className="card glass-panel clickable-card"
                    onClick={() => onSelectDetail('income')}
                    style={{
                        padding: '20px 24px',
                        paddingBottom: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        height: 240,
                        border: '1px solid rgba(16,185,129,0.3)',
                        background: 'linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                        overflow: 'hidden',
                        position: 'relative'
                    }}
                >
                    <svg style={{ position: 'absolute', top: -10, right: 85, width: 140, height: 140, opacity: 0.05, transform: 'rotate(-5deg)', color: '#10b981', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Receitas Totais</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', margin: '2px 0 6px' }}>{formatCurrency(income)}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column' }}>
                                <span>Melhor mês: {monthsData.inc.bestMonth}</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(monthsData.inc.bestVal)}</span>
                            </div>
                        </div>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="1" x2="12" y2="23" />
                                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                            </svg>
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', zIndex: 1 }}>
                        <canvas ref={incRef} />
                    </div>
                </div>

                {/* Despesas no Débito */}
                <div
                    className="card glass-panel clickable-card"
                    onClick={() => onSelectDetail('expense')}
                    style={{
                        padding: '20px 24px',
                        paddingBottom: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        height: 240,
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'linear-gradient(180deg, rgba(239,68,68,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                        overflow: 'hidden',
                        position: 'relative'
                    }}
                >
                    <svg style={{ position: 'absolute', top: -10, right: 85, width: 150, height: 150, opacity: 0.03, color: '#ef4444', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Despesas no Débito</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', margin: '2px 0 6px' }}>{formatCurrency(directExpense)}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column' }}>
                                <span>Pix, débito e dinheiro</span>
                                <span style={{ color: '#ef4444', fontWeight: 600 }}>{directExpenses.length} lançamento(s)</span>
                            </div>
                        </div>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
                            </svg>
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', zIndex: 1 }}>
                        <canvas ref={expRef} />
                    </div>
                </div>

                {/* Gastos no Crédito */}
                <div
                    className="card glass-panel clickable-card"
                    onClick={() => onSelectDetail('credit')}
                    style={{
                        padding: '20px 24px',
                        paddingBottom: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        height: 240,
                        border: '1px solid rgba(139,92,246,0.3)',
                        background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                        overflow: 'hidden',
                        position: 'relative'
                    }}
                >
                    <svg style={{ position: 'absolute', top: 10, right: 85, width: 150, height: 150, opacity: 0.03, color: '#8b5cf6', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                        <line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Gastos no Crédito</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: '#8b5cf6', margin: '2px 0 6px' }}>{formatCurrency(creditExpense)}</div>
                            {creditPurchases.length === 0 ? (
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Nenhuma compra neste ciclo</div>
                            ) : (
                                <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                                        {creditPurchases.length} compra(s){creditCycle.periodLabel ? ` · ${creditCycle.periodLabel}` : ''}
                                    </span>
                                    {creditStatus.unpaid < 0.01 ? (
                                        <span style={{ color: '#10b981', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Check size={12} strokeWidth={2.5} /> Tudo já pago
                                        </span>
                                    ) : (
                                        <span style={{ color: '#a78bfa', fontWeight: 600 }}>
                                            {creditStatus.paid >= 0.01 && `${formatCurrency(creditStatus.paid)} pago • `}
                                            {formatCurrency(creditStatus.unpaid)} a pagar
                                            {creditStatus.nextDueDate && ` (vence ${creditStatus.nextDueDate.slice(8, 10)}/${creditStatus.nextDueDate.slice(5, 7)})`}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                            <CreditCard size={24} strokeWidth={2} />
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', zIndex: 1 }}>
                        <canvas ref={credRef} />
                    </div>
                </div>
            </section>

            {/* Second Stats Row (Saldo em Conta & Investimentos) */}
            <section className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24, alignItems: 'stretch' }}>
                {/* Saldo em Conta */}
                <div
                    className="card glass-panel clickable-card"
                    onClick={() => onSelectDetail('balance')}
                    style={{
                        padding: '20px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        height: 240,
                        border: '1px solid rgba(59,130,246,0.3)',
                        background: 'linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                        overflow: 'hidden',
                        position: 'relative'
                    }}
                >
                    <svg style={{ position: 'absolute', top: -10, right: 85, width: 140, height: 140, opacity: 0.04, transform: 'rotate(-5deg)', color: '#3b82f6', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2 6v12h20V6H2zm18 10H4V8h16v8zm-9-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                        <circle cx="5.5" cy="12" r="1.5" />
                        <circle cx="18.5" cy="12" r="1.5" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo em Conta</div>
                            <div style={{ fontSize: 28, fontWeight: 800, color: globalBalance < 0 ? '#ef4444' : '#3b82f6', margin: '2px 0 6px' }}>{formatCurrency(globalBalance)}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                                {financingDue > 0 && (
                                    <span>Financiamento pendente: <strong style={{ color: '#f59e0b' }}>{formatCurrency(financingDue)}</strong></span>
                                )}
                                {creditExpense > 0 ? (
                                    <span>Fatura de {monthLabelShort}: <strong style={{ color: '#8b5cf6' }}>{formatCurrency(creditExpense)}</strong>{creditStatus.nextDueDate ? ` (vence ${creditStatus.nextDueDate.slice(8, 10)}/${creditStatus.nextDueDate.slice(5, 7)})` : ''}</span>
                                ) : !financingDue && (
                                    <span style={{ color: '#10b981', fontWeight: 600 }}>Sem contas pendentes neste mês</span>
                                )}
                                {(creditExpense > 0 || financingDue > 0) && (
                                    <span>
                                        {(creditExpense + financingDue) > globalBalance 
                                            ? (financingDue > 0 && creditExpense > 0 ? 'Contas − Saldo: ' : creditExpense > 0 ? 'Fatura − Saldo: ' : 'Financiamento − Saldo: ')
                                            : 'Sobra após contas: '}
                                        <strong style={{ color: (creditExpense + financingDue) > globalBalance ? '#ef4444' : '#10b981' }}>
                                            {formatCurrency(Math.abs((creditExpense + financingDue) - globalBalance))}
                                        </strong>
                                    </span>
                                )}
                                {olderPending > 0 && (
                                    <span>Anteriores em aberto: <strong style={{ color: '#ef4444' }}>−{formatCurrency(olderPending)}</strong></span>
                                )}
                            </div>
                        </div>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M2 6v12h20V6H2zm18 10H4V8h16v8zm-9-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                                <circle cx="5.5" cy="12" r="1.5" />
                                <circle cx="18.5" cy="12" r="1.5" />
                            </svg>
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, width: '100%', marginTop: 6, position: 'relative' }}>
                        <canvas ref={balRef} />
                    </div>
                </div>

                {/* Investimentos */}
                <div
                    className="card glass-panel clickable-card"
                    onClick={onNavigateInvestments}
                    style={{
                        padding: '20px 24px',
                        paddingBottom: 14,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        height: 240,
                        border: '1px solid rgba(234,179,8,0.3)',
                        background: 'linear-gradient(180deg, rgba(234,179,8,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                        overflow: 'hidden',
                        position: 'relative'
                    }}
                >
                    <svg style={{ position: 'absolute', top: 5, right: 85, width: 140, height: 140, opacity: 0.05, color: '#eab308', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="1" y="17" width="3" height="5" />
                        <rect x="6" y="13" width="3" height="9" />
                        <rect x="11" y="9" width="3" height="13" />
                        <rect x="16" y="11" width="4" height="11" />
                        <text x="18" y="8" fontSize="9" fontFamily="sans-serif" fontWeight="900" textAnchor="middle" fill="currentColor" stroke="none">$</text>
                        <path d="M 1 14 Q 8 10 13 4" />
                        <polygon points="14,3 10,5 14,8" fill="currentColor" stroke="none" />
                    </svg>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Investimentos</div>
                            <div style={{ fontSize: 24, fontWeight: 800, color: '#eab308', margin: '2px 0 6px' }}>{formatCurrency(investment)}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column' }}>
                                <span>Melhor mês: {monthsData.inv.bestMonth}</span>
                                <span style={{ color: '#eab308', fontWeight: 600 }}>{formatCurrency(monthsData.inv.bestVal)}</span>
                            </div>
                        </div>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(234,179,8,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#eab308' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="1" y="17" width="3" height="5" />
                                <rect x="6" y="13" width="3" height="9" />
                                <rect x="11" y="9" width="3" height="13" />
                                <rect x="16" y="11" width="4" height="11" />
                                <text x="18" y="8" fontSize="9" fontFamily="sans-serif" fontWeight="900" textAnchor="middle" fill="currentColor" stroke="none">$</text>
                                <path d="M 1 14 Q 8 10 13 4" />
                                <polygon points="14,3 10,5 14,8" fill="currentColor" stroke="none" />
                            </svg>
                        </div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', zIndex: 1 }}>
                        <canvas ref={invRef} />
                    </div>
                </div>
            </section>
        </>
    )
}
