import React from 'react'
import { X } from 'lucide-react'
import CategoryIcon from './CategoryIcon'
import TxActions from './TxActions'
import { getCategoryDetails, getAccountLabel } from '../helpers'

export default function DetailsModal({ isOpen, onClose, type, transactions, title, color, onEdit, onDelete }) {
    if (!isOpen) return null

    // Helper formatter
    const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
    
    // Group transactions by Date for better readability
    const grouped = transactions.reduce((acc, t) => {
        const d = t.date
        if (!acc[d]) acc[d] = []
        acc[d].push(t)
        return acc
    }, {})

    const dates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)) // Latest first

    const total = transactions.reduce((acc, t) => acc + t.amount, 0)

    return (
        <div className="modal-overlay" onMouseDown={e => e.target.className === 'modal-overlay' && onClose()} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto'
        }}>
            <div className="modal-content glass-panel" style={{
                background: '#1a1f2e', margin: 'auto', padding: '24px', borderRadius: '16px',
                width: '100%', maxWidth: '600px', border: `1px solid ${color}`,
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}22`,
                position: 'relative'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none',
                    color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><X size={16} strokeWidth={2} /></button>

                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
                    {title}
                </h2>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
                    Total no período: <strong style={{ color }}>{formatCurrency(total)}</strong> ({transactions.length} registros)
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '60vh', overflowY: 'auto', paddingRight: 8 }}>
                    {dates.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '40px 0' }}>
                            Nenhum registro encontrado.
                        </div>
                    ) : (
                        dates.map(dateStr => {
                            const dateObj = new Date(dateStr + 'T00:00:00')
                            const dateLabel = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' })
                            return (
                                <div key={dateStr}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
                                        {dateLabel}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        {grouped[dateStr].map(t => {
                                            const cat = getCategoryDetails(t.type, t.category)
                                            const acc = getAccountLabel(t.account)
                                            const description = t.desc || t.description || 'Sem descrição'

                                            return (
                                                <div key={t.id} style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    background: 'rgba(255,255,255,0.03)', padding: '12px 16px', borderRadius: 10,
                                                    borderLeft: `3px solid ${color}`
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{
                                                            width: 36, height: 36, borderRadius: 10,
                                                            background: cat.color + '22', color: cat.color,
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            fontSize: 18, flexShrink: 0
                                                        }}>
                                                            <CategoryIcon name={cat.iconName} size={16} />
                                                        </div>
                                                        <div>
                                                            <div style={{ fontWeight: 600, color: 'white', fontSize: 15 }}>{description}</div>
                                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                <span>{cat.label}</span>
                                                                <span>•</span>
                                                                <span className="inline-icon-label"><CategoryIcon name={acc.iconName} size={12} /> {acc.label}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 15, color: color }}>
                                                            {formatCurrency(t.amount)}
                                                        </div>
                                                        <TxActions tx={t} onEdit={onEdit} onDelete={onDelete} />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
    )
}
