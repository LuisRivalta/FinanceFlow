"use client";

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Chart, ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler } from 'chart.js'
import Sidebar from '../../components/Sidebar'
import { useSession } from '../../hooks/useSession'
import { supabase } from '../../lib/supabase'
import { mapFromDB, formatCurrency, getCategoryDetails, CATEGORY_MAP } from '../../lib/utils'

// Register Chart.js components
Chart.register(ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler)

Chart.defaults.color = 'rgba(255,255,255,0.55)'
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)'
Chart.defaults.font.family = "'Outfit', sans-serif"
Chart.defaults.font.size = 12

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const fmtShort = v => {
    if (Math.abs(v) >= 1000) return 'R$' + (v / 1000).toFixed(1) + 'k'
    return 'R$' + v.toFixed(0)
}

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

function getCat(id) {
    for (const list of Object.values(CATEGORY_MAP)) {
        const f = list.find(c => c.id === id)
        if (f) return f
    }
    return { label: id || 'Outros', icon: '📌', color: '#94a3b8' }
}

export default function ChartsPage() {
    const router = useRouter()
    const session = useSession()
    const [allTx, setAllTx] = useState([])
    const [loading, setLoading] = useState(true)
    const [months, setMonths] = useState(3)

    // Canvas refs
    const balanceRef = useRef(null)
    const monthlyRef = useRef(null)
    const catExpenseRef = useRef(null)
    const typeDistRef = useRef(null)
    const catIncomeRef = useRef(null)

    useEffect(() => {
        async function load() {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_email', session?.email)
                .order('date', { ascending: true })
            if (!error && data) setAllTx(data.map(mapFromDB))
            setLoading(false)
        }
        if (session === undefined) return
        if (!session) {
            router.push('/login')
            return
        }
        if (session?.email) load()
    }, [session, router])

    const filtered = useMemo(() => {
        if (months === 0) return [...allTx]
        const cutoff = new Date()
        cutoff.setMonth(cutoff.getMonth() - months)
        return allTx.filter(t => new Date(t.date + 'T00:00:00') >= cutoff)
    }, [allTx, months])

    // KPIs
    const kpiIncome = useMemo(() => filtered.filter(t => t.type === 'income'), [filtered])
    const kpiExpense = useMemo(() => filtered.filter(t => t.type === 'expense'), [filtered])
    const kpiInvest = useMemo(() => filtered.filter(t => t.type === 'investment'), [filtered])
    const totalIncome = kpiIncome.reduce((s, t) => s + t.amount, 0)
    const totalExpense = kpiExpense.reduce((s, t) => s + t.amount, 0)
    const totalInvest = kpiInvest.reduce((s, t) => s + t.amount, 0)
    const netBalance = totalIncome - totalExpense

    // 1. Balance Chart
    const balanceChartConfig = useMemo(() => {
        if (!filtered.length) return null
        const sorted = [...filtered].sort((a, b) => new Date(a.date) - new Date(b.date))
        let running = 0
        const labels = [], data = []
        sorted.forEach(t => {
            running += t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0
            labels.push(new Date(t.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }))
            data.push(running)
        })
        const accent = '#6366f1'
        return {
            type: 'line',
            data: { labels, datasets: [{ label: 'Saldo', data, borderColor: accent, backgroundColor: accent + '18', borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: data.length > 30 ? 0 : 3, pointHoverRadius: 5, pointBackgroundColor: accent }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false }, tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => ' Saldo: ' + fmt(ctx.raw) } } },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { maxTicksLimit: 10 } },
                    y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtShort(v) } }
                }
            }
        }
    }, [filtered])
    useChart(balanceRef, balanceChartConfig, [balanceChartConfig])

    // 2. Monthly Chart
    const monthlyChartConfig = useMemo(() => {
        if (!filtered.length) return null
        const buckets = {}
        filtered.forEach(t => {
            const d = new Date(t.date + 'T00:00:00')
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            if (!buckets[key]) buckets[key] = { income: 0, expense: 0, investment: 0 }
            buckets[key][t.type] = (buckets[key][t.type] || 0) + t.amount
        })
        const sortedKeys = Object.keys(buckets).sort()
        const labels = sortedKeys.map(k => {
            const [y, m] = k.split('-')
            return new Date(+y, +m - 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
        })
        return {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Receitas', data: sortedKeys.map(k => buckets[k].income), backgroundColor: 'rgba(16,185,129,0.7)', borderColor: '#10b981', borderWidth: 1.5, borderRadius: 6, borderSkipped: false },
                    { label: 'Despesas', data: sortedKeys.map(k => buckets[k].expense), backgroundColor: 'rgba(239,68,68,0.7)', borderColor: '#ef4444', borderWidth: 1.5, borderRadius: 6, borderSkipped: false },
                    { label: 'Investimentos', data: sortedKeys.map(k => buckets[k].investment), backgroundColor: 'rgba(139,92,246,0.7)', borderColor: '#8b5cf6', borderWidth: 1.5, borderRadius: 6, borderSkipped: false }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { position: 'top', labels: { usePointStyle: true, padding: 16 } }, tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)}` } } },
                scales: { x: { grid: { color: 'rgba(255,255,255,0.04)' } }, y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { callback: v => fmtShort(v) } } }
            }
        }
    }, [filtered])
    useChart(monthlyRef, monthlyChartConfig, [monthlyChartConfig])

    // 3. Cat Expense Donut
    const catExpenseConfig = useMemo(() => {
        const expenses = filtered.filter(t => t.type === 'expense')
        if (!expenses.length) return null
        const totals = {}
        expenses.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount })
        const entries = Object.entries(totals).sort((a, b) => b[1] - a[1])
        const labels = entries.map(([id]) => { const c = getCat(id); return `${c.icon} ${c.label}` })
        const data = entries.map(([, v]) => v)
        const colors = entries.map(([id]) => getCat(id).color)
        return {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 2, hoverOffset: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } }, tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => ` ${fmt(ctx.raw)}` } } } }
        }
    }, [filtered])
    useChart(catExpenseRef, catExpenseConfig, [catExpenseConfig])

    // 4. Type Distribution Pie
    const typeDistConfig = useMemo(() => {
        if (!filtered.length) return null
        const inc = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
        const exp = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
        const inv = filtered.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
        return {
            type: 'pie',
            data: { labels: ['📥 Receitas', '📤 Despesas', '📈 Investimentos'], datasets: [{ data: [inc, exp, inv], backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)', 'rgba(139,92,246,0.8)'], borderColor: ['#10b981', '#ef4444', '#8b5cf6'], borderWidth: 2, hoverOffset: 8 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 14 } }, tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0; return ` ${fmt(ctx.raw)} (${pct}%)` } } } }
            }
        }
    }, [filtered])
    useChart(typeDistRef, typeDistConfig, [typeDistConfig])

    // 5. Income Category Donut
    const catIncomeConfig = useMemo(() => {
        const incomes = filtered.filter(t => t.type === 'income')
        if (!incomes.length) return null
        const totals = {}
        incomes.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount })
        const entries = Object.entries(totals).sort((a, b) => b[1] - a[1])
        const labels = entries.map(([id]) => { const c = getCat(id); return `${c.icon} ${c.label}` })
        const data = entries.map(([, v]) => v)
        const colors = entries.map(([id]) => getCat(id).color)
        return {
            type: 'doughnut',
            data: { labels, datasets: [{ data, backgroundColor: colors.map(c => c + 'cc'), borderColor: colors, borderWidth: 2, hoverOffset: 8 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'right', labels: { usePointStyle: true, pointStyle: 'circle', padding: 12 } }, tooltip: { ...TOOLTIP_OPTS, callbacks: { label: ctx => { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? Math.round((ctx.raw / total) * 100) : 0; return ` ${fmt(ctx.raw)} (${pct}%)` } } } } }
        }
    }, [filtered])
    useChart(catIncomeRef, catIncomeConfig, [catIncomeConfig])

    // Top cats
    const topCats = useMemo(() => {
        const expenses = filtered.filter(t => t.type === 'expense')
        if (!expenses.length) return []
        const totals = {}
        expenses.forEach(t => { totals[t.category] = (totals[t.category] || 0) + t.amount })
        const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6)
        const max = entries[0]?.[1] || 1
        return entries.map(([id, val]) => ({ cat: getCat(id), val, pct: Math.round((val / max) * 100) }))
    }, [filtered])

    if (session === undefined) return null;

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />

                <main className="main-content">
                    {loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 16, color: 'white' }}>
                            <div className="spinner" />
                            <div>Carregando dados...</div>
                        </div>
                    ) : (
                        <section style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 0', width: '100%' }}>
                            {/* Header */}
                            <div style={{ marginBottom: 32 }}>
                                <h1 style={{ fontSize: 'clamp(24px,4vw,36px)', fontWeight: 800, margin: '0 0 6px', background: 'linear-gradient(135deg,#fff 0%,rgba(255,255,255,0.6) 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                    📈 Análise Financeira
                                </h1>
                                <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, margin: 0 }}>Visualize seus rendimentos, gastos e evolução patrimonial.</p>
                            </div>

                            {/* Period selector */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
                                {[1, 3, 6, 12, 0].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => setMonths(m)}
                                        style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: months === m ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)', color: months === m ? 'white' : 'rgba(255,255,255,0.5)', borderColor: months === m ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, transition: 'all 0.15s' }}
                                    >
                                        {m === 0 ? 'Tudo' : m === 1 ? 'Este mês' : `${m} meses`}
                                    </button>
                                ))}
                            </div>

                            {/* KPIs */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
                                {[
                                    { label: '💰 Receitas Totais', val: totalIncome, count: kpiIncome.length, color: '#10b981' },
                                    { label: '💸 Despesas Totais', val: totalExpense, count: kpiExpense.length, color: '#ef4444' },
                                    { label: '📈 Investimentos', val: totalInvest, count: kpiInvest.length, color: '#8b5cf6' },
                                    { label: '🏦 Saldo Líquido', val: netBalance, sub: netBalance >= 0 ? '✅ Positivo' : '⚠️ Negativo', color: netBalance >= 0 ? '#10b981' : '#ef4444' }
                                ].map((k, i) => (
                                    <div key={i} className="card glass-panel" style={{ padding: 20, gap: 6 }}>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '.5px', fontWeight: 700 }}>{k.label}</div>
                                        <div style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{fmt(k.val)}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{k.sub || `${k.count} transação(ões)`}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Charts Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20 }}>
                                {/* 1. Balance */}
                                <ChartCard title="📉 Evolução do Saldo" subtitle="Saldo acumulado ao longo do tempo" full>
                                    <div style={{ position: 'relative', height: 320, width: '100%' }}>
                                        {!balanceChartConfig ? <Empty /> : <canvas ref={balanceRef} />}
                                    </div>
                                </ChartCard>

                                {/* 2. Monthly */}
                                <ChartCard title="⚖️ Receitas vs Despesas por Mês" subtitle="Comparativo mensal de entrada e saída" full>
                                    <div style={{ position: 'relative', height: 320, width: '100%' }}>
                                        {!monthlyChartConfig ? <Empty /> : <canvas ref={monthlyRef} />}
                                    </div>
                                </ChartCard>

                                {/* 3. Cat Expense */}
                                <ChartCard title="🍩 Gastos por Categoria" subtitle="Distribuição das despesas">
                                    <div style={{ position: 'relative', height: 260, width: '100%' }}>
                                        {!catExpenseConfig ? <Empty msg="Nenhuma despesa" /> : <canvas ref={catExpenseRef} />}
                                    </div>
                                </ChartCard>

                                {/* 4. Type Dist */}
                                <ChartCard title="🥧 Distribuição por Tipo" subtitle="Quanto vai para cada categoria financeira">
                                    <div style={{ position: 'relative', height: 260, width: '100%' }}>
                                        {!typeDistConfig ? <Empty /> : <canvas ref={typeDistRef} />}
                                    </div>
                                </ChartCard>

                                {/* 5. Top Cats */}
                                <ChartCard title="🔥 Top Gastos" subtitle="Categorias que mais pesam no bolso">
                                    {topCats.length === 0 ? (
                                        <Empty msg="Nenhum gasto" />
                                    ) : topCats.map(({ cat, val, pct }, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0, background: cat.color + '22', color: cat.color }}>{cat.icon}</div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</div>
                                                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: 2, background: cat.color, width: pct + '%', transition: 'width 0.5s ease' }} />
                                                </div>
                                            </div>
                                            <div style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, color: cat.color }}>{fmt(val)}</div>
                                        </div>
                                    ))}
                                </ChartCard>

                                {/* 6. Income Cat */}
                                <ChartCard title="🌱 Fontes de Renda" subtitle="De onde vem seu dinheiro">
                                    <div style={{ position: 'relative', height: 260, width: '100%' }}>
                                        {!catIncomeConfig ? <Empty msg="Sem receitas" /> : <canvas ref={catIncomeRef} />}
                                    </div>
                                </ChartCard>
                            </div>
                        </section>
                    )}
                </main>
            </div>
        </div>
    )
}

function ChartCard({ title, subtitle, children, full }) {
    return (
        <div className="card glass-panel" style={{ gridColumn: full ? '1/-1' : 'auto' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 4px' }}>{title}</h3>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: '0 0 20px' }}>{subtitle}</p>
            {children}
        </div>
    )
}

function Empty({ msg = 'Sem dados no período' }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 120, color: 'rgba(255,255,255,0.2)', fontSize: 13, gap: 8 }}>
            <span style={{ fontSize: 32 }}>📭</span>
            {msg}
        </div>
    )
}
