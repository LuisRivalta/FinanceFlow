import React, { useRef, useEffect, useMemo } from 'react'
import { Chart } from 'chart.js'
import { getCategoryDetails } from '../../helpers'
import { currentLegendPosition } from '../../lib/responsive'

const fmt = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
const TOOLTIP_OPTS = {
    backgroundColor: 'rgba(17,24,39,0.95)',
    padding: 12,
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1
}

export default function CategoryPieChart({ monthSpending = [] }) {
    const pieRef = useRef(null)
    const chartInstanceRef = useRef(null)

    const pieConfig = useMemo(() => {
        const expenses = monthSpending
        const catTotals = {}
        let totalExp = 0
        expenses.forEach(t => {
            catTotals[t.category] = (catTotals[t.category] || 0) + t.amount
            totalExp += t.amount
        })

        if (totalExp === 0) {
            return {
                type: 'doughnut',
                data: {
                    labels: ['Sem Despesas'],
                    datasets: [{ data: [1], backgroundColor: ['#334155'], borderWidth: 0 }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: { enabled: false },
                        legend: { position: currentLegendPosition(), labels: { color: '#94a3b8', usePointStyle: true, padding: 20 } }
                    },
                    cutout: '75%'
                }
            }
        }

        const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1])
        const labels = []
        const data = []
        const bg = []

        sortedCats.forEach(([catId, amount]) => {
            const catDef = getCategoryDetails('expense', catId)
            labels.push(catDef.label)
            data.push(amount)
            bg.push(catDef.color)
        })

        return {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{ data, backgroundColor: bg, borderWidth: 2, borderColor: '#1a1f2e', hoverOffset: 4 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                layout: { padding: 10 },
                plugins: {
                    legend: {
                        position: currentLegendPosition(),
                        labels: { color: '#cbd5e1', usePointStyle: true, padding: 16, font: { size: 12, family: "'Outfit', sans-serif" } }
                    },
                    tooltip: {
                        ...TOOLTIP_OPTS,
                        callbacks: {
                            label: ctx => {
                                const pct = Math.round((ctx.raw / totalExp) * 100)
                                return ` ${fmt(ctx.raw)} (${pct}%)`
                            }
                        }
                    }
                }
            }
        }
    }, [monthSpending])

    useEffect(() => {
        if (!pieRef.current) return
        if (chartInstanceRef.current) chartInstanceRef.current.destroy()
        if (pieConfig) {
            chartInstanceRef.current = new Chart(pieRef.current, pieConfig)
        }
        return () => {
            if (chartInstanceRef.current) chartInstanceRef.current.destroy()
        }
    }, [pieConfig])

    return (
        <section className="fade-up delay-2" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, marginBottom: 8 }}>
            <div className="card glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', height: 300 }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #ef4444, #f87171)', flexShrink: 0 }} />
                    Despesas por Categoria <span style={{ textTransform: 'none', fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>(débito + crédito)</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, width: '100%', marginTop: 12, position: 'relative' }}>
                    <canvas ref={pieRef} />
                </div>
            </div>
        </section>
    )
}
