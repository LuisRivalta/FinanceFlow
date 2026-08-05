"use client";

import { useEffect, useRef, useState } from 'react'
import { formatCurrency, formatDate } from '../helpers'
import { usagePercent } from '../lib/cardMetrics'

const MAX_TILT_DEG = 5

function Dots() {
    return (
        <div className="cc-dots" aria-hidden="true">
            {[0, 1].map(group => (
                <span key={group}>
                    {[0, 1, 2, 3].map(i => <span key={i} className="cc-dot" />)}
                </span>
            ))}
        </div>
    )
}

function formatInvoiceKey(key) {
    if (!key) return ''
    const [y, m] = key.split('-')
    const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1)
    return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
}

export default function CreditCardItem({ card, invoiceAmount, invoicesBreakdown = [], onEdit, onRemove, onPayInvoice }) {
    const faceRef = useRef(null)
    const [reducedMotion, setReducedMotion] = useState(false)

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
        setReducedMotion(mq.matches)

        const onChange = e => setReducedMotion(e.matches)
        mq.addEventListener('change', onChange)
        return () => mq.removeEventListener('change', onChange)
    }, [])

    const handleMove = e => {
        const el = faceRef.current
        if (!el || reducedMotion) return

        const rect = el.getBoundingClientRect()
        const relX = (e.clientX - rect.left) / rect.width
        const relY = (e.clientY - rect.top) / rect.height
        const nx = relX * 2 - 1
        const ny = relY * 2 - 1

        el.style.setProperty('--cc-ry', `${nx * MAX_TILT_DEG}deg`)
        el.style.setProperty('--cc-rx', `${-ny * MAX_TILT_DEG}deg`)
        el.style.setProperty('--cc-px', String(-nx))
        el.style.setProperty('--cc-py', String(-ny))
        el.style.setProperty('--cc-mx', `${relX * 100}%`)
        el.style.setProperty('--cc-my', `${relY * 100}%`)
        el.dataset.tilting = 'true'
    }

    const handleLeave = () => {
        const el = faceRef.current
        if (!el) return

        el.dataset.tilting = 'false'
        el.style.setProperty('--cc-rx', '0deg')
        el.style.setProperty('--cc-ry', '0deg')
        el.style.setProperty('--cc-px', '0')
        el.style.setProperty('--cc-py', '0')
    }

    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    const openInvoices = invoicesBreakdown.filter(inv => inv.remaining > 0)
    const currentInvoice = openInvoices.find(inv => inv.key === currentMonthKey) || openInvoices[0]
    const displayAmount = currentInvoice ? currentInvoice.remaining : (openInvoices.length > 0 ? openInvoices[0].remaining : Math.max(0, invoiceAmount))
    const pct = usagePercent(displayAmount, card.credit_limit)

    return (
        <div className="cc-item">
            <div
                ref={faceRef}
                className="cc-face"
                style={{ '--cc-color': card.color }}
                onMouseMove={handleMove}
                onMouseLeave={handleLeave}
            >
                <div className="cc-row cc-depth-far">
                    <div className="cc-chip" aria-hidden="true" />
                    <span className="cc-brand">{card.brand}</span>

                    <div className="cc-actions">
                        <button className="cc-action" onClick={() => onEdit(card)} aria-label={`Editar ${card.name}`}>✏️</button>
                        <button className="cc-action" onClick={() => onRemove(card.id)} aria-label={`Excluir ${card.name}`}>🗑️</button>
                    </div>
                </div>

                <div className="cc-row cc-depth-mid" style={{ display: 'block' }}>
                    <div className="cc-label">Fatura Atual {currentInvoice ? `(${formatInvoiceKey(currentInvoice.key)})` : ''}</div>
                    <div className="cc-amount">{formatCurrency(displayAmount)}</div>
                </div>

                <div className="cc-row cc-depth-near" style={{ alignItems: 'flex-end' }}>
                    <div style={{ minWidth: 0 }}>
                        <div className="cc-name">{card.name}</div>
                        <div className="cc-due">vence dia {card.due_day} • fecha dia {card.closing_day || 25}</div>
                    </div>
                    <Dots />
                </div>
            </div>

            <div>
                <div className="cc-usage-track">
                    <div className="cc-usage-fill" style={{ width: `${pct}%`, background: card.color }} />
                </div>
                <div className="cc-usage-legend">
                    <span>{pct}% do limite</span>
                    <span>{formatCurrency(card.credit_limit)}</span>
                </div>
            </div>

            {/* List of open invoices per cycle */}
            {openInvoices.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Faturas em Aberto por Mês
                    </div>
                    {openInvoices.map(inv => (
                        <div key={inv.key} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span>Fatura {formatInvoiceKey(inv.key)}</span>
                                </div>
                                <div style={{ fontSize: 11, color: inv.status === 'overdue' ? '#ef4444' : inv.status === 'pending' ? '#f59e0b' : 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                                    {inv.status === 'overdue' ? '⚠️ Vencida em ' : '🗓️ Vence em '}{formatDate(inv.dueDate)}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                                    {formatCurrency(inv.remaining)}
                                </div>
                                <button
                                    className="btn-primary"
                                    style={{
                                        padding: '5px 12px',
                                        fontSize: 12,
                                        borderRadius: 6,
                                        background: card.color,
                                        cursor: 'pointer',
                                        border: 'none'
                                    }}
                                    onClick={() => onPayInvoice(card, inv.remaining, inv.key)}
                                >
                                    🧾 Pagar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <button
                    className="btn-primary"
                    style={{
                        width: '100%',
                        padding: '10px 0',
                        fontSize: 13,
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.16)',
                        cursor: 'default',
                    }}
                    disabled={true}
                >
                    ✨ Faturas pagas
                </button>
            )}
        </div>
    )
}
