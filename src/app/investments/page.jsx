"use client";

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import Wallet from '../../components/Wallet'
import NumberField from '../../components/NumberField'
import dynamic from 'next/dynamic'
import { useSession } from '../../hooks/useSession'
import { useTransactions } from '../../hooks/useTransactions'
import { useRates } from '../../hooks/useRates'
import { INVESTMENT_PRODUCTS, DEFAULT_PRODUCT_ID, getProduct, deriveRate, multiplierLabel } from '../../lib/investmentProducts'
import { formatCurrency, formatPercent, calcInvestment, CATEGORY_MAP } from '../../helpers'
import { Chart, ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler } from 'chart.js'

const WealthParticles = dynamic(() => import('../../components/3d/WealthParticles'), { ssr: false })

Chart.register(ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler)

export default function InvestmentsPage() {
    const session = useSession()
    const router = useRouter()
    const { transactions, loading: txLoading } = useTransactions(session?.email)

    // Simulator State
    const { rates, degraded, loading: ratesLoading } = useRates()

    const [productId, setProductId] = useState(DEFAULT_PRODUCT_ID)
    const [multiplier, setMultiplier] = useState(() => getProduct(DEFAULT_PRODUCT_ID).defaultMultiplier)

    // Consts comuns, não hooks — a ordem das chamadas de hook não é afetada.
    // Precisam vir antes do useState de simRate, que os consome no initializer.
    const product = getProduct(productId) || getProduct(DEFAULT_PRODUCT_ID)
    const multiplierFieldLabel = multiplierLabel(product)

    const [simInitial, setSimInitial] = useState('')
    const [simMonthly, setSimMonthly] = useState('')
    const [simPeriodValue, setSimPeriodValue] = useState('')
    const [simPeriodType, setSimPeriodType] = useState('anos')
    // No primeiro render `rates` já é FALLBACK_RATES, então a taxa inicial sai da
    // mesma derivação que o effect usa depois — sem número mágico duplicado.
    const [simRate, setSimRate] = useState(() => deriveRate(product, rates, multiplier))

    const chartRef = useRef(null)
    const chartInstance = useRef(null)

    useEffect(() => {
        if (session === undefined) return
        if (!session) {
            router.push('/login')
        }
    }, [session, router])

    // Escreve a taxa derivada em simRate quando produto, multiplicador ou taxas
    // mudam. deriveRate devolve null para o Personalizado, e é isso que impede o
    // effect de atropelar a taxa digitada à mão — sem comparar id nenhum.
    useEffect(() => {
        const derived = deriveRate(product, rates, multiplier)
        if (derived === null) return
        setSimRate(derived)
    }, [product, rates, multiplier])

    const handleProductChange = e => {
        const next = getProduct(e.target.value)
        if (!next) return
        setProductId(next.id)
        if (next.defaultMultiplier !== null) setMultiplier(next.defaultMultiplier)
    }

    // Digitar uma taxa própria muda o produto para Personalizado, o que faz
    // deriveRate devolver null e o effect acima parar de sobrescrever.
    const handleRateChange = rate => {
        // Guarda redundante com o `dirty` do NumberField, de propósito: trocar o
        // produto é destrutivo (desliga a taxa automática), então não depende de
        // um único ponto de controle.
        if (rate === simRate) return
        setSimRate(rate)
        setProductId('custom')
    }

    // Linha embaixo do campo de taxa, substituindo a dica hardcoded
    // "Ex: 10.4 para CDI/Selic atual", que estava desatualizada.
    const rateStatus = useMemo(() => {
        const muted = 'rgba(255,255,255,0.3)'

        if (!product.index) {
            return { text: 'taxa definida por você', tone: muted }
        }
        if (ratesLoading) {
            return { text: 'buscando taxas no Banco Central…', tone: muted }
        }
        const indexRate = rates?.[product.index]

        // `degraded` cobre série que o BCB não entregou. Esta segunda guarda cobre
        // chave ausente do objeto inteiro: sem ela, `indexRate.value` lançaria
        // TypeError dentro do useMemo, durante o render, e como não há error
        // boundary em src/app/ a página de investimentos ficaria em branco.
        if (degraded.includes(product.index) || !indexRate || !Number.isFinite(indexRate.value)) {
            return { text: '⚠ não deu pra atualizar; usando último valor conhecido', tone: '#f59e0b' }
        }

        return {
            text: `${product.indexLabel} ${formatPercent(indexRate.value)} a.a. · Banco Central, ${indexRate.date}`,
            tone: muted,
        }
    }, [product, rates, degraded, ratesLoading])

    const invTransactions = useMemo(() => transactions.filter(t => t.type === 'investment'), [transactions])
    
    // Stats
    const totalInvested = useMemo(() => calcInvestment(invTransactions), [invTransactions])
    
    const catTotals = useMemo(() => {
        const totals = { stocks: 0, crypto: 0, fixed: 0, other_inv: 0 }
        invTransactions.forEach(t => {
            if (totals[t.category] !== undefined) totals[t.category] += t.amount
            else totals.other_inv += t.amount
        })
        return totals
    }, [invTransactions])

    // Simulator Calculation
    const simData = useMemo(() => {
        const initial = Number(simInitial) || 0
        const monthly = Number(simMonthly) || 0
        const period = Number(simPeriodValue) || 0
        
        if (period === 0 && initial === 0 && monthly === 0) {
            return {
                labels: ['Hoje', '1 Ano', '2 Anos', '3 Anos', '4 Anos', '5 Anos'],
                dataGross: [0, 0, 0, 0, 0, 0],
                dataInvested: [0, 0, 0, 0, 0, 0],
                finalGross: 0,
                finalInvested: 0
            }
        }

        const months = simPeriodType === 'anos' ? period * 12 : period
        const rate = Number(simRate) || 0
        const monthlyRate = Math.pow(1 + (rate / 100), 1/12) - 1
        
        let currentGross = initial
        let currentInvested = initial
        
        const labels = []
        const dataGross = []
        const dataInvested = []

        labels.push('Hoje')
        dataGross.push(currentGross)
        dataInvested.push(currentInvested)

        for (let m = 1; m <= months; m++) {
            currentGross = currentGross * (1 + monthlyRate) + monthly
            currentInvested += monthly
            
            const step = months <= 12 ? 1 : months <= 24 ? 2 : 12;

            if (m % step === 0 || m === months) {
                let lbl = '';
                if (m % 12 === 0) {
                    const y = m / 12;
                    lbl = `${y} ${y === 1 ? 'Ano' : 'Anos'}`
                } else {
                    lbl = `${m} ${m === 1 ? 'Mês' : 'Meses'}`
                }
                
                // Avoid duplicating the last label if it coincidentally hits the modulo
                if (labels.length > 0 && labels[labels.length - 1] === lbl) continue;

                labels.push(lbl)
                dataGross.push(currentGross)
                dataInvested.push(currentInvested)
            }
        }

        return { labels, dataGross, dataInvested, finalGross: currentGross, finalInvested: currentInvested }
    }, [simInitial, simMonthly, simPeriodValue, simPeriodType, simRate])

    useEffect(() => {
        if (!chartRef.current) return
        if (chartInstance.current) {
            chartInstance.current.destroy()
        }

        const ctx = chartRef.current.getContext('2d')
        
        const gradGross = ctx.createLinearGradient(0, 0, 0, 400)
        gradGross.addColorStop(0, 'rgba(234, 179, 8, 0.4)')
        gradGross.addColorStop(1, 'rgba(234, 179, 8, 0.0)')

        const gradInvested = ctx.createLinearGradient(0, 0, 0, 400)
        gradInvested.addColorStop(0, 'rgba(96, 165, 250, 0.15)')
        gradInvested.addColorStop(1, 'rgba(96, 165, 250, 0.0)')

        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: simData.labels,
                datasets: [
                    {
                        label: 'Valor Total Bruto',
                        data: simData.dataGross,
                        borderColor: '#eab308',
                        backgroundColor: gradGross,
                        borderWidth: 3,
                        pointBackgroundColor: '#eab308',
                        pointBorderColor: '#fff',
                        pointRadius: 4,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Total Investido',
                        data: simData.dataInvested,
                        borderColor: '#60a5fa',
                        backgroundColor: gradInvested,
                        borderWidth: 2,
                        pointRadius: 0,
                        borderDash: [5, 5],
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: 'rgba(255,255,255,0.7)', usePointStyle: true, padding: 20 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        titleColor: 'rgba(255,255,255,0.9)',
                        bodyColor: '#eab308',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (ctx) => {
                                return ctx.dataset.label + ': ' + formatCurrency(ctx.raw)
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                        ticks: { color: 'rgba(255,255,255,0.4)' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                        suggestedMax: 1000,
                        suggestedMin: 0,
                        ticks: {
                            color: 'rgba(255,255,255,0.4)',
                            callback: (val) => new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(val)
                        }
                    }
                }
            }
        })
    }, [simData])

    if (!session) return null

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                <header className="fade-up" style={{ marginBottom: 40 }}>
                    <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>🏦 Meus Investimentos</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>Gerencie seu patrimônio e simule seus rendimentos.</p>
                </header>

                <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, marginBottom: 40 }}>
                    <div className="card glass-panel" style={{ padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(234,179,8,0.1) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(234,179,8,0.3)', position: 'relative', overflow: 'hidden' }}>
                        <svg style={{ position: 'absolute', right: -20, top: -20, width: 250, height: 250, opacity: 0.05, color: '#eab308' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>Total Investido</div>
                            <div style={{ fontSize: 48, fontWeight: 800, color: '#eab308' }}>
                                {txLoading ? '...' : formatCurrency(totalInvested)}
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: 24, position: 'relative', zIndex: 1 }}>
                            {CATEGORY_MAP.investment.map(cat => (
                                <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
                                        <span style={{ color: cat.color }}>{cat.icon}</span> {cat.label}
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>
                                        {formatCurrency(catTotals[cat.id] || 0)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Wallet Section */}
                <Wallet userEmail={session?.email} />

                {/* Simulador Section */}
                <h3 className="fade-up delay-2" style={{ fontSize: 24, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>🧮</span> Simulador de Juros Compostos
                </h3>
                <div className="fade-up delay-2" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '350px 1fr', gap: 24, alignItems: 'stretch' }}>
                    <WealthParticles color="#10b981" />
                    
                    {/* Controles do Simulador */}
                    <div className="card glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Tipo de Investimento</label>
                            <div className="tx-field" style={{ margin: 0 }}>
                                <select value={productId} onChange={handleProductChange} aria-label="Tipo de investimento">
                                    {INVESTMENT_PRODUCTS.map(p => (
                                        <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                                    ))}
                                </select>
                            </div>
                            {product.hint && (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8, lineHeight: 1.5 }}>
                                    {product.hint}
                                </div>
                            )}
                        </div>

                        {multiplierFieldLabel && (
                            <div>
                                <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>{multiplierFieldLabel}</label>
                                <NumberField
                                    value={multiplier}
                                    onChange={setMultiplier}
                                    min={0}
                                    max={product.multiplierKind === 'percent_of' ? 300 : 50}
                                    decimals={2}
                                    icon={product.multiplierKind === 'percent_of' ? '✖️' : '➕'}
                                    ariaLabel={multiplierFieldLabel}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Valor Inicial</label>
                            <NumberField
                                value={simInitial}
                                onChange={setSimInitial}
                                min={0}
                                max={1000000000}
                                decimals={2}
                                icon="💰"
                                ariaLabel="Valor inicial"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Aporte Mensal</label>
                            <NumberField
                                value={simMonthly}
                                onChange={setSimMonthly}
                                min={0}
                                max={1000000000}
                                decimals={2}
                                icon="📅"
                                ariaLabel="Aporte mensal"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Taxa de Rendimento Anual (%)</label>
                            <NumberField
                                value={simRate}
                                onChange={handleRateChange}
                                min={0}
                                max={100}
                                decimals={2}
                                icon="📈"
                                suffix="%"
                                ariaLabel="Taxa de rendimento anual"
                            />
                            <div style={{ fontSize: 12, marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: rateStatus.tone }}>{rateStatus.text}</span>
                                {product.taxExempt && (
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '2px 6px' }}>
                                        isento de IR
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
                                <span>Período</span>
                                <select value={simPeriodType} onChange={e => setSimPeriodType(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#60a5fa', outline: 'none', cursor: 'pointer', fontSize: 14, padding: 0, textAlign: 'right' }}>
                                    <option value="anos" style={{ color: 'black' }}>Anos</option>
                                    <option value="meses" style={{ color: 'black' }}>Meses</option>
                                </select>
                            </label>
                            <NumberField
                                value={simPeriodValue}
                                onChange={setSimPeriodValue}
                                min={1}
                                max={simPeriodType === 'anos' ? 50 : 600}
                                decimals={0}
                                icon="⏳"
                                ariaLabel={`Período em ${simPeriodType}`}
                            />
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Total Investido:</span>
                                <span style={{ color: '#60a5fa' }}>{formatCurrency(simData.finalInvested)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Juros Ganhos:</span>
                                <span style={{ color: '#10b981' }}>+ {formatCurrency(simData.finalGross - simData.finalInvested)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, marginTop: 12, color: '#eab308' }}>
                                <span>Valor Final Bruto:</span>
                                <span>{formatCurrency(simData.finalGross)}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 16, lineHeight: 1.5 }}>
                                Simulação com taxa constante, em valor bruto — sem descontar impostos ou taxas. Rentabilidade passada não garante retorno futuro.
                            </div>
                        </div>
                    </div>

                    {/* Gráfico do Simulador */}
                    <div className="card glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'white' }}>
                            Projeção de Crescimento do Patrimônio
                        </div>
                        <div style={{ flex: 1, minHeight: 400, position: 'relative' }}>
                            <canvas ref={chartRef} />
                        </div>
                    </div>
                </div>

            </main>
            </div>
        </div>
    )
}
