"use client";

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Chart, ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler } from 'chart.js'
import Sidebar from '../components/Sidebar'
import TxCard from '../components/TxCard'
import TransactionModal from '../components/TransactionModal'
import { useSession } from '../hooks/useSession'
import { useTransactions } from '../hooks/useTransactions'
import { formatCurrency, calcBalance, calcIncome, calcExpense, calcInvestment, getCategoryDetails } from '../lib/utils'

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
    const { transactions, loading, load, create, update, remove } = useTransactions(session?.email)

    const [modalOpen, setModalOpen] = useState(false)
    const [editTx, setEditTx] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [showAllModal, setShowAllModal] = useState(false)
    const [allSearch, setAllSearch] = useState('')
    const [allFilter, setAllFilter] = useState('all')

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

    // Summaries
    const income = useMemo(() => calcIncome(transactions), [transactions])
    const expense = useMemo(() => calcExpense(transactions), [transactions])
    const investment = useMemo(() => calcInvestment(transactions), [transactions])
    const balance = income - expense - investment

    // Recent (last 5)
    const recentTxs = useMemo(() => {
        let list = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date))
        if (filterType !== 'all') list = list.filter(t => t.type === filterType)
        if (searchQuery) list = list.filter(t => t.desc.toLowerCase().includes(searchQuery.toLowerCase()) || (t.note || '').toLowerCase().includes(searchQuery.toLowerCase()))
        return list.slice(0, 5)
    }, [transactions, filterType, searchQuery])

    // All modal filtered
    const allTxs = useMemo(() => {
        let list = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date))
        if (allFilter !== 'all') list = list.filter(t => t.type === allFilter)
        if (allSearch) list = list.filter(t => t.desc.toLowerCase().includes(allSearch.toLowerCase()) || (t.note || '').toLowerCase().includes(allSearch.toLowerCase()))
        return list
    }, [transactions, allFilter, allSearch])

    // Split lists
    const incomeList = useMemo(() => [...transactions].filter(t => t.type === 'income').sort((a, b) => new Date(b.date) - new Date(a.date)), [transactions])
    const expenseList = useMemo(() => [...transactions].filter(t => t.type === 'expense' || t.type === 'investment').sort((a, b) => new Date(b.date) - new Date(a.date)), [transactions])

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

    // Data generation
    const monthsData = useMemo(() => {
        if (!transactions) return { inc: { data: [] }, exp: { data: [] }, inv: { data: [] }, bal: { data: [] } }

        const bucketsInc = {}, bucketsExp = {}, bucketsInv = {}, bucketsBal = {}
        for (let i = 5; i >= 0; i--) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            bucketsInc[key] = 0; bucketsExp[key] = 0; bucketsInv[key] = 0; bucketsBal[key] = 0
        }

        const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date))

        for (const k of Object.keys(bucketsInc)) {
            const [y, m] = k.split('-')
            const nextMonth = new Date(+y, +m, 1)

            sorted.forEach(t => {
                const d = new Date(t.date + 'T00:00:00')
                if (d.getFullYear() === +y && d.getMonth() + 1 === +m) {
                    if (t.type === 'income') bucketsInc[k] += t.amount
                    else if (t.type === 'expense') bucketsExp[k] += t.amount
                    else if (t.type === 'investment') bucketsInv[k] += t.amount
                }

                if (d < nextMonth) {
                    if (t.type === 'income') bucketsBal[k] = (bucketsBal[k] || 0) + t.amount
                    else if (t.type === 'expense') bucketsBal[k] = (bucketsBal[k] || 0) - t.amount
                    else if (t.type === 'investment') bucketsBal[k] = (bucketsBal[k] || 0) - t.amount
                }
            })
        }

        const buildMetric = (buckets) => {
            const data = Object.values(buckets)
            const maxVal = Math.max(...data, 0)
            let bestMonth = "-"
            if (maxVal > 0 || data.length > 0) {
                for (const [k, v] of Object.entries(buckets)) {
                    if (v === maxVal && maxVal > 0) {
                        const [y, m] = k.split('-')
                        bestMonth = new Date(+y, +m - 1).toLocaleDateString('pt-BR', { month: 'short' })
                        break
                    }
                }
            }
            return {
                labels: Object.keys(buckets).map(k => {
                    const [y, m] = k.split('-')
                    return new Date(+y, +m - 1).toLocaleDateString('pt-BR', { month: 'short' })
                }),
                data,
                bestMonth,
                bestVal: maxVal
            }
        }

        return {
            inc: buildMetric(bucketsInc),
            exp: buildMetric(bucketsExp),
            inv: buildMetric(bucketsInv),
            bal: buildMetric(bucketsBal)
        }
    }, [transactions])

    const sparkOpts = useMemo(() => ({
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => ' ' + fmt(ctx.raw) } } },
        scales: { x: { display: true, grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } } }, y: { display: false } },
        interaction: { mode: 'index', intersect: false }
    }), [])

    const incConfig = useMemo(() => ({ type: 'line', data: { labels: monthsData.inc.labels, datasets: [{ data: monthsData.inc.data, borderColor: '#10b981', backgroundColor: '#10b98122', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: sparkOpts }), [monthsData, sparkOpts])
    const expConfig = useMemo(() => ({ type: 'line', data: { labels: monthsData.exp.labels, datasets: [{ data: monthsData.exp.data, borderColor: '#ef4444', backgroundColor: '#ef444422', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: sparkOpts }), [monthsData, sparkOpts])
    const invConfig = useMemo(() => ({ type: 'line', data: { labels: monthsData.inv.labels, datasets: [{ data: monthsData.inv.data, borderColor: '#8b5cf6', backgroundColor: '#8b5cf622', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: sparkOpts }), [monthsData, sparkOpts])
    const balConfig = useMemo(() => ({ type: 'line', data: { labels: monthsData.bal.labels, datasets: [{ data: monthsData.bal.data, borderColor: '#3b82f6', backgroundColor: '#3b82f622', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] }, options: sparkOpts }), [monthsData, sparkOpts])

    useChart(incRef, incConfig, [incConfig])
    useChart(expRef, expConfig, [expConfig])
    useChart(invRef, invConfig, [invConfig])
    useChart(balRef, balConfig, [balConfig])

    const pieConfig = useMemo(() => {
        const inc = calcIncome(transactions)
        const exp = calcExpense(transactions)
        const inv = calcInvestment(transactions)

        let data = [inc, exp, inv]
        if (inc === 0 && exp === 0 && inv === 0) {
            data = [1, 1, 1] // placeholder
        }

        return {
            type: 'bar',
            data: { labels: ['Receitas', 'Despesas', 'Investimentos'], datasets: [{ data, backgroundColor: ['#10b981', '#ef4444', '#8b5cf6'], borderRadius: 8, barThickness: 28 }] },
            plugins: [{
                id: 'valueLabelsPlugin',
                afterDatasetsDraw(chart) {
                    const { ctx, data } = chart;
                    ctx.save();
                    ctx.font = 'bold 12px sans-serif';
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'middle';

                    chart.getDatasetMeta(0).data.forEach((datapoint, index) => {
                        const rawValue = data.datasets[0].data[index];
                        // exclude placeholder
                        if (rawValue > 0 && !(inc === 0 && exp === 0 && inv === 0)) {
                            ctx.fillText(fmt(rawValue), datapoint.x + 8, datapoint.y);
                        }
                    });
                    ctx.restore();
                }
            }],
            options: {
                indexAxis: 'y',
                layout: { padding: { right: 85 } },
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0; return inc === 0 && exp === 0 && inv === 0 ? ' Sem dados' : ` ${fmt(ctx.raw)} (${pct}%)` } } } },
                scales: {
                    x: { display: false, min: 0 },
                    y: { border: { display: false }, grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.6)', font: { size: 12, weight: '600' } } }
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
                        <header className="top-header fade-up">
                            <div>
                                <h2 className="page-title">{greeting}</h2>
                                <p className="page-subtitle">Acompanhe suas finanças em tempo real com controle total.</p>
                            </div>
                            <button id="add-transaction-btn" className="btn-primary" onClick={openNew}>
                                <span className="icon">✨</span> Nova Transação
                            </button>
                        </header>

                        {/* Top Stats Row */}
                        <section className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, flexShrink: 0 }}>
                            <div className="card glass-panel" style={{ padding: '20px 24px', paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 12, height: 248, border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Receitas Totais</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981', margin: '2px 0 6px' }}>{formatCurrency(income)}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column' }}>
                                            <span>Melhor mês: {monthsData.inc.bestMonth}</span>
                                            <span style={{ color: '#10b981', fontWeight: 600 }}>{formatCurrency(monthsData.inc.bestVal)}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 24, opacity: 0.9 }}>⬆️</div>
                                </div>
                                <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
                                    <canvas ref={incRef} />
                                </div>
                            </div>

                            <div className="card glass-panel" style={{ padding: '20px 24px', paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 12, height: 248, border: '1px solid rgba(239,68,68,0.3)', background: 'linear-gradient(180deg, rgba(239,68,68,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Despesas Gerais</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: '#ef4444', margin: '2px 0 6px' }}>{formatCurrency(expense)}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column' }}>
                                            <span>Pior mês: {monthsData.exp.bestMonth}</span>
                                            <span style={{ color: '#ef4444', fontWeight: 600 }}>{formatCurrency(monthsData.exp.bestVal)}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 24, opacity: 0.9 }}>⬇️</div>
                                </div>
                                <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
                                    <canvas ref={expRef} />
                                </div>
                            </div>

                            <div className="card glass-panel" style={{ padding: '20px 24px', paddingBottom: 14, display: 'flex', flexDirection: 'column', gap: 12, height: 248, border: '1px solid rgba(139,92,246,0.3)', background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Investimentos</div>
                                        <div style={{ fontSize: 24, fontWeight: 800, color: '#8b5cf6', margin: '2px 0 6px' }}>{formatCurrency(investment)}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column' }}>
                                            <span>Melhor mês: {monthsData.inv.bestMonth}</span>
                                            <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{formatCurrency(monthsData.inv.bestVal)}</span>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 24, opacity: 0.9 }}>🚀</div>
                                </div>
                                <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
                                    <canvas ref={invRef} />
                                </div>
                            </div>
                        </section>

                        {/* Bottom Stats Row */}
                        <section className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 8, alignItems: 'stretch' }}>
                            {/* Balance */}
                            <div className="card glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: 248, border: '1px solid rgba(59,130,246,0.3)', background: 'linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Saldo Disponível</div>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: balanceClass === 'negative' ? '#ef4444' : '#3b82f6', margin: '2px 0 4px' }}>{formatCurrency(balance)}</div>
                                    </div>
                                    <div style={{ fontSize: 28, opacity: 0.9 }}>💰</div>
                                </div>
                                <div style={{ flex: 1, minHeight: 120, width: '100%', marginTop: 12, position: 'relative' }}>
                                    <canvas ref={balRef} />
                                </div>
                            </div>

                            {/* Pie Chart */}
                            <div className="card glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: 248 }}>
                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #f59e0b, #ed8936)', flexShrink: 0 }} />
                                    Distribuição por Tipo
                                </div>
                                <div style={{ flex: 1, minHeight: 120, width: '100%', marginTop: 12, position: 'relative' }}>
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
                                        <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
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
                                    <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                                    Nenhuma transação encontrada.
                                </div>
                            ) : allTxs.map(tx => (
                                <TxCard key={tx.id} tx={tx} onEdit={tx2 => { setShowAllModal(false); openEdit(tx2) }} onDelete={remove} />
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
