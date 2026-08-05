"use client";

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Chart, ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler } from 'chart.js'
import Sidebar from '../components/Sidebar'
import TxCard from '../components/TxCard'
import TransactionModal from '../components/TransactionModal'
import DetailsModal from '../components/DetailsModal'
import dynamic from 'next/dynamic'
import { useSession } from '../hooks/useSession'
import { useTransactions } from '../hooks/useTransactions'
import { useCreditCards } from '../hooks/useCards'
import { useWalletAssets } from '../hooks/useWalletAssets'
import { formatCurrency, calcBalance, calcIncome, calcExpense, calcInvestment, getCategoryDetails } from '../helpers'
import { getCardInvoiceBreakdown } from '../lib/cardMetrics'
import { currentLegendPosition } from '../lib/responsive'

const Coin3D = dynamic(() => import('../components/3d/Coin3D'), { ssr: false })

Chart.register(ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler)

Chart.defaults.color = 'rgba(255,255,255,0.55)'
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)'
Chart.defaults.font.family = "'Outfit', sans-serif"
Chart.defaults.font.size = 12

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const TOOLTIP_OPTS = {
    backgroundColor: 'rgba(17,24,39,0.95)',
    padding: 12,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1
}

function useChart(canvasRef, config, deps) {
    const chartRef = useRef(null)
    useEffect(() => {
        if (!canvasRef.current) return
        if (chartRef.current) chartRef.current.destroy()
        if (config) {
            chartRef.current = new Chart(canvasRef.current, config)
        }
        return () => { if (chartRef.current) chartRef.current.destroy() }
    }, deps) // eslint-disable-line
}

export default function DashboardPage() {
    const router = useRouter()
    const session = useSession()
    const { cards } = useCreditCards(session?.email)
    const { transactions, loading, load, create, update, remove } = useTransactions(session?.email)
    const { totalNetWorth: walletTotalNetWorth } = useWalletAssets(session?.email)

    const [modalOpen, setModalOpen] = useState(false)
    const [editTx, setEditTx] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [showAllModal, setShowAllModal] = useState(false)
    const [allSearch, setAllSearch] = useState('')
    const [allFilter, setAllFilter] = useState('all')
    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [detailView, setDetailView] = useState(null)

    // Greeting
    const [greeting, setGreeting] = useState('Olá 👋')

    useEffect(() => {
        const hour = new Date().getHours()
        const prefs = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('finance_settings') || '{}') : {}
        const name = prefs.name || session?.name || 'Usuário'
        const firstName = name.split(' ')[0]
        let word = 'Bom dia,'
        if (hour >= 12 && hour < 18) word = 'Boa tarde,'
        else if (hour >= 18) word = 'Boa noite,'
        setGreeting(`${word} ${firstName} 👋`)
    }, [session])

    useEffect(() => {
        if (session === undefined) return
        if (!session) {
            router.push('/login')
            return
        }
        load()
    }, [session, load, router])

    // Filter transactions by selected month
    const filteredTransactions = useMemo(() => {
        const y = currentDate.getFullYear()
        const m = currentDate.getMonth()
        return transactions.filter(t => {
            const d = new Date(t.date + 'T00:00:00')
            return d.getFullYear() === y && d.getMonth() === m
        })
    }, [transactions, currentDate])

    const detailInfo = useMemo(() => {
        if (!detailView) return { transactions: [], title: '', color: '' }
        let list = []
        let title = ''
        let color = ''

        if (detailView === 'income') {
            list = filteredTransactions.filter(t => t.type === 'income')
            title = 'Detalhes de Receitas'
            color = '#10b981'
        } else if (detailView === 'expense') {
            list = filteredTransactions.filter(t => t.type === 'expense' && t.category !== 'invoice_payment')
            title = 'Detalhes de Despesas'
            color = '#ef4444'
        } else if (detailView === 'investment') {
            list = filteredTransactions.filter(t => t.type === 'investment')
            title = 'Detalhes de Investimentos'
            color = '#eab308'
        } else if (detailView === 'balance') {
            list = filteredTransactions
            title = 'Movimentações do Período'
            color = '#3b82f6'
        } else if (detailView === 'invoices') {
            const y = currentDate.getFullYear()
            const m = currentDate.getMonth()
            const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59)
            list = transactions.filter(t => {
                const d = new Date(t.date + 'T00:00:00')
                return (t.account === 'credit' || t.category === 'invoice_payment') && d <= endOfMonth
            })
            title = 'Faturas do Período'
            color = '#8b5cf6'
        }

        return {
            transactions: list.slice().sort((a, b) => new Date(b.date) - new Date(a.date)),
            title,
            color
        }
    }, [detailView, filteredTransactions, transactions, currentDate])

    // Summaries
    const income = useMemo(() => calcIncome(filteredTransactions), [filteredTransactions])
    const expense = useMemo(() => calcExpense(filteredTransactions), [filteredTransactions])
    const investment = useMemo(() => calcInvestment(filteredTransactions) + walletTotalNetWorth, [filteredTransactions, walletTotalNetWorth])
    const balance = useMemo(() => calcBalance(filteredTransactions), [filteredTransactions])
    
    const globalBalance = useMemo(() => {
        return transactions.reduce((acc, t) => {
            if (t.type === 'income') return acc + t.amount
            if (t.type === 'expense' && t.account !== 'credit') return acc - t.amount
            if (t.type === 'investment') return acc - t.amount
            return acc
        }, 0)
    }, [transactions])
    
    const invoiceMetrics = useMemo(() => {
        const y = currentDate.getFullYear()
        const m = currentDate.getMonth()
        const selectedKey = `${y}-${String(m + 1).padStart(2, '0')}`

        let selectedMonthInvoice = 0
        let priorPendingInvoices = 0

        if (cards && cards.length > 0) {
            cards.forEach(card => {
                const breakdown = getCardInvoiceBreakdown(transactions, card, currentDate)
                breakdown.forEach(inv => {
                    if (inv.remaining > 0) {
                        if (inv.key === selectedKey) {
                            selectedMonthInvoice += inv.remaining
                        } else if (inv.key < selectedKey) {
                            priorPendingInvoices += inv.remaining
                        }
                    }
                })
            })
        } else {
            const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59)
            let rawSelected = 0
            let rawPrior = 0
            let totalPayments = 0

            transactions.forEach(t => {
                const d = new Date(t.date + 'T00:00:00')
                if (d <= endOfMonth) {
                    if (t.category === 'invoice_payment') {
                        totalPayments += t.amount
                    } else if (t.account === 'credit' && t.type === 'expense') {
                        if (d.getFullYear() === y && d.getMonth() === m) {
                            rawSelected += t.amount
                        } else {
                            rawPrior += t.amount
                        }
                    }
                }
            })

            let remPayments = totalPayments
            const paidPrior = Math.min(rawPrior, remPayments)
            priorPendingInvoices = Math.max(0, rawPrior - paidPrior)
            remPayments -= paidPrior

            const paidCurrent = Math.min(rawSelected, remPayments)
            selectedMonthInvoice = Math.max(0, rawSelected - paidCurrent)
        }

        const totalInvoices = selectedMonthInvoice + priorPendingInvoices

        return {
            selectedMonthInvoice,
            priorPendingInvoices,
            totalInvoices
        }
    }, [transactions, cards, currentDate])

    const { selectedMonthInvoice, priorPendingInvoices, totalInvoices } = invoiceMetrics

    const freeBalance = globalBalance - Math.max(0, totalInvoices)

    // Recent (last 5)
    const recentTxs = useMemo(() => {
        let list = [...filteredTransactions].sort((a, b) => new Date(b.date) - new Date(a.date))
        if (filterType !== 'all') list = list.filter(t => t.type === filterType)
        if (searchQuery) list = list.filter(t => t.desc.toLowerCase().includes(searchQuery.toLowerCase()) || (t.note || '').toLowerCase().includes(searchQuery.toLowerCase()))
        return list.slice(0, 5)
    }, [filteredTransactions, filterType, searchQuery])

    // All modal filtered
    const allTxs = useMemo(() => {
        let list = [...filteredTransactions].sort((a, b) => new Date(b.date) - new Date(a.date))
        if (allFilter !== 'all') list = list.filter(t => t.type === allFilter)
        if (allSearch) list = list.filter(t => t.desc.toLowerCase().includes(allSearch.toLowerCase()) || (t.note || '').toLowerCase().includes(allSearch.toLowerCase()))
        return list
    }, [filteredTransactions, allFilter, allSearch])

    // Split lists
    const incomeList = useMemo(() => [...filteredTransactions].filter(t => t.type === 'income').sort((a, b) => new Date(b.date) - new Date(a.date)), [filteredTransactions])
    const expenseList = useMemo(() => [...filteredTransactions].filter(t => t.type === 'expense' || t.type === 'investment').sort((a, b) => new Date(b.date) - new Date(a.date)), [filteredTransactions])

    const balanceClass = balance > 0 ? 'positive' : balance < 0 ? 'negative' : ''

    async function handleSave(data, editId) {
        if (editId) {
            await update(editId, data)
        } else {
            await create(data)
        }
    }

    function openEdit(tx) {
        setEditTx(tx)
        setModalOpen(true)
    }

    function openNew() {
        setEditTx(null)
        setModalOpen(true)
    }

    // Chart refs
    const incRef = useRef(null)
    const expRef = useRef(null)
    const invRef = useRef(null)
    const balRef = useRef(null)
    const pieRef = useRef(null)

    // Data generation for sparklines (Weekly buckets within the selected month)
    const monthsData = useMemo(() => {
        if (!filteredTransactions) return { inc: { data: [] }, exp: { data: [] }, inv: { data: [] }, bal: { data: [] } }

        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        // Create 4 weekly buckets
        const weekLabels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4']
        const wInc = [0, 0, 0, 0], wExp = [0, 0, 0, 0], wInv = [0, 0, 0, 0], wBal = [0, 0, 0, 0]

        filteredTransactions.forEach(t => {
            const d = new Date(t.date + 'T00:00:00')
            if (d.getFullYear() === year && d.getMonth() === month) {
                const day = d.getDate()
                const wi = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3
                if (t.type === 'income') wInc[wi] += t.amount
                else if (t.type === 'expense') wExp[wi] += t.amount
                else if (t.type === 'investment') wInv[wi] += t.amount
            }
        })

        // Cumulative balance per week
        const prevBalance = transactions.reduce((acc, t) => {
            const d = new Date(t.date + 'T00:00:00')
            if (d < new Date(year, month, 1)) {
                if (t.type === 'income') return acc + t.amount
                if (t.type === 'expense' && t.account !== 'credit') return acc - t.amount
            }
            return acc
        }, 0)

        wBal[0] = prevBalance + wInc[0] - wExp[0] - wInv[0]
        wBal[1] = wBal[0] + wInc[1] - wExp[1] - wInv[1]
        wBal[2] = wBal[1] + wInc[2] - wExp[2] - wInv[2]
        wBal[3] = wBal[2] + wInc[3] - wExp[3] - wInv[3]

        const buildWeekMetric = (arr) => ({
            labels: weekLabels, data: arr,
            bestMonth: weekLabels[arr.indexOf(Math.max(...arr))],
            bestVal: Math.max(...arr, 0)
        })

        return {
            inc: buildWeekMetric(wInc),
            exp: buildWeekMetric(wExp),
            inv: buildWeekMetric(wInv),
            bal: buildWeekMetric(wBal)
        }
    }, [filteredTransactions, transactions, currentDate])



    const sparkOpts = useMemo(() => ({
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => ' ' + fmt(ctx.raw) } } },
        scales: { x: { display: true, grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } }, y: { display: false } },
        interaction: { mode: 'index', intersect: false }
    }), [])

    const incConfig = useMemo(() => ({ type: 'line', data: { labels: monthsData.inc.labels, datasets: [{ data: monthsData.inc.data, borderColor: '#10b981', backgroundColor: '#10b98122', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: sparkOpts }), [monthsData, sparkOpts])
    const expConfig = useMemo(() => ({ type: 'line', data: { labels: monthsData.exp.labels, datasets: [{ data: monthsData.exp.data, borderColor: '#ef4444', backgroundColor: '#ef444422', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: sparkOpts }), [monthsData, sparkOpts])
    const invConfig = useMemo(() => ({ type: 'line', data: { labels: monthsData.inv.labels, datasets: [{ data: monthsData.inv.data, borderColor: '#eab308', backgroundColor: '#eab30822', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: sparkOpts }), [monthsData, sparkOpts])
    const balConfig = useMemo(() => ({ type: 'line', data: { labels: monthsData.bal.labels, datasets: [{ data: monthsData.bal.data, borderColor: '#3b82f6', backgroundColor: '#3b82f622', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: sparkOpts }), [monthsData, sparkOpts])

    useChart(incRef, incConfig, [incConfig])
    useChart(expRef, expConfig, [expConfig])
    useChart(invRef, invConfig, [invConfig])
    useChart(balRef, balConfig, [balConfig])

    const pieConfig = useMemo(() => {
        const expenses = filteredTransactions.filter(t => t.type === 'expense' && t.category !== 'invoice_payment')
        const catTotals = {}
        let totalExp = 0
        expenses.forEach(t => {
            catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
            totalExp += t.amount
        })

        if (totalExp === 0) {
            return {
                type: 'doughnut',
                data: { labels: ['Sem Despesas'], datasets: [{ data: [1], backgroundColor: ['#334155'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { enabled: false }, legend: { position: currentLegendPosition(), labels: { color: '#94a3b8', usePointStyle: true, padding: 20 } } }, cutout: '75%' }
            }
        }

        const sortedCats = Object.entries(catTotals).sort((a,b) => b[1] - a[1])
        const labels = []
        const data = []
        const bg = []
        
        sortedCats.forEach(([catId, amount]) => {
            const catDef = getCategoryDetails('expense', catId)
            labels.push(`${catDef.icon} ${catDef.label}`)
            data.push(amount)
            bg.push(catDef.color)
        })

        return {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: bg, borderWidth: 2, borderColor: '#1a1f2e', hoverOffset: 4 }] },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '65%',
                layout: { padding: 10 },
                plugins: {
                    legend: { position: currentLegendPosition(), labels: { color: '#cbd5e1', usePointStyle: true, padding: 16, font: { size: 12, family: "'Outfit', sans-serif" } } },
                    tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => { const pct = Math.round((ctx.raw / totalExp) * 100); return ` ${fmt(ctx.raw)} (${pct}%)` } } }
                }
            }
        }
    }, [transactions])
    useChart(pieRef, pieConfig, [pieConfig])

    if (session === undefined) return null;

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />

                <main className="main-content">
                    <div style={{ minHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Header */}
                        <header className="top-header fade-up" style={{ position: 'relative', zIndex: 50 }}>
                            <div>
                                <h2 className="page-title">{greeting}</h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <p className="page-subtitle" style={{ margin: 0 }}>Acompanhe suas finanças em tempo real com controle total.</p>
                                    {(() => {
                                        const rawMonth = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                                        const displayMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                                                <button 
                                                    onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', padding: '8px 12px', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                                    &lt;
                                                </button>
                                                <div style={{ padding: '0 16px', fontWeight: 600, color: 'white', minWidth: 140, textAlign: 'center', fontSize: 14 }}>
                                                    {displayMonth}
                                                </div>
                                                <button 
                                                    onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                                                    style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', padding: '8px 12px', cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                                                    &gt;
                                                </button>
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                            <button id="add-transaction-btn" className="btn-primary" onClick={openNew}>
                                <span className="icon">✨</span> Nova Transação
                            </button>
                        </header>

                        {/* Top Stats Row */}
                        <section className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, flexShrink: 0 }}>
                            <div className="card glass-panel clickable-card" onClick={() => setDetailView('income')} style={{ padding: '20px 24px', paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 12, height: 240, border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.02) 100%)', overflow: 'hidden', position: 'relative' }}>
                                {/* Big faint background icon */}
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

                            <div className="card glass-panel clickable-card" onClick={() => setDetailView('expense')} style={{ padding: '20px 24px', paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 12, height: 240, border: '1px solid rgba(239,68,68,0.3)', background: 'linear-gradient(180deg, rgba(239,68,68,0.08) 0%, rgba(255,255,255,0.02) 100%)', overflow: 'hidden', position: 'relative' }}>
                                {/* Big faint background icon */}
                                <svg style={{ position: 'absolute', top: -10, right: 85, width: 150, height: 150, opacity: 0.03, color: '#ef4444', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M20 12l-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8 8-8z" />
                                </svg>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Despesas Gerais</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', margin: '2px 0 6px' }}>{formatCurrency(expense)}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column' }}>
                                            <span>Pior mês: {monthsData.exp.bestMonth}</span>
                                            <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatCurrency(monthsData.exp.bestVal)}</span>
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

                            <div className="card glass-panel clickable-card" onClick={() => router.push('/investments')} style={{ padding: '20px 24px', paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 12, height: 240, border: '1px solid rgba(234,179,8,0.3)', background: 'linear-gradient(180deg, rgba(234,179,8,0.08) 0%, rgba(255,255,255,0.02) 100%)', overflow: 'hidden', position: 'relative' }}>
                                {/* Big faint background icon */}
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


                        <section className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginBottom: 24, alignItems: 'stretch' }}>
                            {/* Balance */}
                            <div className="card glass-panel clickable-card" onClick={() => setDetailView('balance')} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: 240, border: '1px solid rgba(59,130,246,0.3)', background: 'linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(255,255,255,0.02) 100%)', overflow: 'hidden', position: 'relative' }}>
                                {/* Big faint background icon */}
                                <svg style={{ position: 'absolute', top: -10, right: 85, width: 140, height: 140, opacity: 0.04, transform: 'rotate(-5deg)', color: '#3b82f6', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M2 6v12h20V6H2zm18 10H4V8h16v8zm-9-7c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zm0 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
                                    <circle cx="5.5" cy="12" r="1.5" />
                                    <circle cx="18.5" cy="12" r="1.5" />
                                </svg>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo Livre</div>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: freeBalance < 0 ? '#ef4444' : '#3b82f6', margin: '2px 0 6px' }}>{formatCurrency(freeBalance)}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <span>Na Conta: <strong style={{ color: 'white' }}>{formatCurrency(globalBalance)}</strong></span>
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

                            {/* Invoices Card */}
                            <div className="card glass-panel clickable-card" onClick={() => setDetailView('invoices')} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: 240, border: '1px solid rgba(139,92,246,0.3)', background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(255,255,255,0.02) 100%)', overflow: 'hidden', position: 'relative' }}>
                                {/* Big faint background icon */}
                                <svg style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 220, height: 220, opacity: 0.03, color: '#8b5cf6', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                    <line x1="1" y1="10" x2="23" y2="10" />
                                </svg>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fatura do Mês</div>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: '#8b5cf6', margin: '2px 0 4px' }}>{formatCurrency(selectedMonthInvoice)}</div>
                                        {priorPendingInvoices > 0 ? (
                                            <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
                                                + {formatCurrency(priorPendingInvoices)} (anterior pendente)
                                            </div>
                                        ) : (
                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>
                                                Faturas anteriores em dia
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(139,92,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b5cf6' }}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
                                            <line x1="1" y1="10" x2="23" y2="10" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Termômetro Financeiro */}
                        <section className="fade-up delay-1" style={{ marginBottom: 24 }}>
                            {(() => {
                                const spendPct = income > 0 ? (expense / income) * 100 : expense > 0 ? 100 : 0;
                                let statusMsg = "Tudo tranquilo! Você não gastou quase nada ainda.";
                                let statusColor = "#10b981"; // green
                                
                                if (spendPct > 85) {
                                    statusMsg = "Cuidado! Seus gastos estão altíssimos em relação à renda do mês.";
                                    statusColor = "#ef4444"; // red
                                } else if (spendPct > 60) {
                                    statusMsg = "Atenção. Os gastos já ultrapassaram a metade da sua receita.";
                                    statusColor = "#f59e0b"; // yellow
                                } else if (spendPct > 0) {
                                    statusMsg = "Saudável! Seus gastos estão sob controle.";
                                    statusColor = "#3b82f6"; // blue
                                } else if (income === 0 && expense === 0) {
                                    statusMsg = "Sem lançamentos neste mês.";
                                    statusColor = "#94a3b8"; // gray
                                }

                                return (
                                    <div className="card glass-panel" style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', border: `1px solid ${statusColor}44`, background: `linear-gradient(90deg, ${statusColor}11 0%, rgba(255,255,255,0.02) 100%)` }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                                            <div>
                                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                                                    Termômetro do Mês
                                                </div>
                                                <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>
                                                    {statusMsg}
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 28, fontWeight: 800, color: statusColor }}>
                                                {Math.min(100, Math.round(spendPct))}%
                                            </div>
                                        </div>
                                        
                                        <div style={{ width: '100%', height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                                            <div style={{ 
                                                height: '100%', 
                                                width: `${Math.min(100, spendPct)}%`, 
                                                background: statusColor,
                                                borderRadius: 10,
                                                transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                                            }} />
                                        </div>
                                        
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                                            <span>R$ 0</span>
                                            <span>{formatCurrency(income)} (Receita)</span>
                                        </div>
                                    </div>
                                )
                            })()}
                        </section>

                        {/* Pie Chart Row (Row 3) */}
                        <section className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, marginBottom: 8 }}>
                            {/* Pie Chart */}
                            <div className="card glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: 300 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #f87171)', flexShrink: 0 }} />
                                    Despesas por Categoria
                                </div>
                                <div style={{ flex: 1, minHeight: 0, width: '100%', marginTop: 12, position: 'relative' }}>
                                    <canvas ref={pieRef} />
                                </div>
                            </div>
                        </section>
                    </div>


                    {/* Dashboard Content */}
                    <section className="dashboard-content fade-up delay-2" style={{ marginTop: 40 }}>
                        {/* Split Lists */}
                        <div className="recent-transactions glass-panel">
                            <div className="section-header" style={{ marginBottom: 16 }}>
                                <h3>Movimentações Recentes</h3>
                            </div>

                            <div className="split-lists">
                                <div className="list-column">
                                    <h4 style={{ marginBottom: 12, color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 18 }}>⬆️</span> Receitas
                                    </h4>
                                    <div className="transactions-list">
                                        {incomeList.length === 0 ? (
                                            <div className="empty-state"><p style={{ fontSize: 14 }}>Sem registros</p></div>
                                        ) : incomeList.map(tx => (
                                            <TxCard key={tx.id} tx={tx} onEdit={openEdit} onDelete={remove} />
                                        ))}
                                    </div>
                                    <div className="column-footer">
                                        Total: <span className="positive">{formatCurrency(income)}</span>
                                    </div>
                                </div>

                                <div className="list-column">
                                    <h4 style={{ marginBottom: 12, color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 18 }}>⬇️</span> Saídas (Gastos/Invest.)
                                    </h4>
                                    <div className="transactions-list">
                                        {expenseList.length === 0 ? (
                                            <div className="empty-state"><p style={{ fontSize: 14 }}>Sem registros</p></div>
                                        ) : expenseList.map(tx => (
                                            <TxCard key={tx.id} tx={tx} onEdit={openEdit} onDelete={remove} />
                                        ))}
                                    </div>
                                    <div className="column-footer">
                                        Total: <span className="negative">{formatCurrency(expense + investment)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent 5 with filter */}
                        <div className="recent-transactions glass-panel" style={{ marginTop: 0 }}>
                            <div className="section-header" style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3>Últimas Transações</h3>
                                <button
                                    id="btn-ver-todas"
                                    onClick={() => setShowAllModal(true)}
                                    style={{ background: 'none', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--accent-primary)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '6px 12px', borderRadius: 8, transition: 'background 0.2s' }}
                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                                    onMouseOut={e => e.currentTarget.style.background = 'none'}
                                >
                                    Ver todas →
                                </button>
                            </div>

                            {/* Filtros */}
                            <div id="tx-list-toolbar">
                                <input
                                    type="search"
                                    id="tx-search"
                                    placeholder="🔍 Buscar..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{ flex: 1, minWidth: 160, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                                />
                                <div className="tx-filter-btns">
                                    {['all', 'income', 'expense', 'investment'].map(ft => (
                                        <button
                                            key={ft}
                                            data-tx-filter={ft}
                                            className={'tx-filter-btn' + (filterType === ft ? ' tx-filter-active' : '')}
                                            onClick={() => setFilterType(ft)}
                                        >
                                            {ft === 'all' ? 'Todas' : ft === 'income' ? '📥 Entradas' : ft === 'expense' ? '📤 Saídas' : '📈 Invest.'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div id="tx-list-container" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {loading ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                                        <div className="spinner" style={{ margin: '0 auto 12px' }} />
                                        Carregando...
                                    </div>
                                ) : recentTxs.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                                        <div style={{ fontSize: 'clamp(22px, 5vw, 32px)', marginBottom: 8 }}>📭</div>
                                        Nenhuma transação encontrada.
                                    </div>
                                ) : recentTxs.map(tx => (
                                    <TxCard key={tx.id} tx={tx} onEdit={openEdit} onDelete={remove} />
                                ))}
                            </div>
                        </div>
                    </section>
                </main>
            </div>

            {/* Modal Nova/Editar Transação */}
            <TransactionModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditTx(null) }}
                onSave={handleSave}
                editTx={editTx}
            />

            {/* Modal Ver Todas */}
            {showAllModal && (
                <div
                    style={{ display: 'flex', position: 'fixed', inset: 0, zIndex: 8100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 40 }}
                    onClick={e => { if (e.target === e.currentTarget) setShowAllModal(false) }}
                >
                    <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, width: '100%', maxWidth: 680, maxHeight: '80vh', display: 'flex', flexDirection: 'column', color: 'white', boxShadow: '0 25px 60px rgba(0,0,0,0.7)', margin: '0 16px' }}>
                        {/* Header */}
                        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <input
                                type="search"
                                placeholder="🔍 Buscar por descrição ou observação..."
                                value={allSearch}
                                onChange={e => setAllSearch(e.target.value)}
                                style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
                                autoFocus
                            />
                            <button
                                id="all-tx-close"
                                onClick={() => setShowAllModal(false)}
                                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 34, height: 34, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            >✕</button>
                        </div>

                        {/* Filters */}
                        <div style={{ padding: '12px 24px', display: 'flex', gap: 6, borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
                            {['all', 'income', 'expense', 'investment'].map(ft => (
                                <button
                                    key={ft}
                                    className={'tx-filter-btn' + (allFilter === ft ? ' tx-filter-active' : '')}
                                    onClick={() => setAllFilter(ft)}
                                >
                                    {ft === 'all' ? 'Todas' : ft === 'income' ? '📥 Entradas' : ft === 'expense' ? '📤 Saídas' : '📈 Invest.'}
                                </button>
                            ))}
                        </div>

                        {/* List */}
                        <div id="all-tx-list" style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {allTxs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                                    <div style={{ fontSize: 'clamp(22px, 5vw, 32px)', marginBottom: 8 }}>📭</div>
                                    Nenhuma transação encontrada.
                                </div>
                            ) : allTxs.map(tx => (
                                <TxCard key={tx.id} tx={tx} onEdit={tx2 => { setShowAllModal(false); openEdit(tx2) }} onDelete={remove} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
            <DetailsModal
                isOpen={!!detailView}
                onClose={() => setDetailView(null)}
                type={detailView}
                transactions={detailInfo.transactions}
                title={detailInfo.title}
                color={detailInfo.color}
            />
        </div>
    )
}
