import React, { useMemo, useState } from 'react'
import { X, CreditCard, Layers, Wallet } from 'lucide-react'
import CategoryIcon from './CategoryIcon'
import TxActions from './TxActions'
import { getCategoryDetails, formatCurrency } from '../helpers'

// Análise de gastos no crédito: extrato + quebra por categoria + à vista x
// parcelado. Serve o card "Gastos no Crédito" do painel (agrupado por data) e o
// clique num cartão na página Cartões (agrupado por fatura), então quem chama
// decide o agrupamento via groupBy.
//
// `installmentTotal > 1` é dado real da transação — não depende do "(2/4)" que
// aparece na descrição.
function isInstallment(t) {
    return Number(t?.installmentTotal) > 1
}

export default function CreditSpendModal({
    isOpen,
    onClose,
    title,
    subtitle,
    transactions = [],
    groupBy = (t) => t.date,
    groupLabel = (key) => new Date(key + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long' }),
    cardNameById = {},
    color = '#8b5cf6',
    onEdit,
    onDelete
}) {
    const [onlyInstallments, setOnlyInstallments] = useState(false)

    const stats = useMemo(() => {
        const total = transactions.reduce((s, t) => s + t.amount, 0)
        const installmentTotal = transactions.filter(isInstallment).reduce((s, t) => s + t.amount, 0)

        const byCategory = {}
        transactions.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount
        })
        const categories = Object.entries(byCategory)
            .map(([id, amount]) => ({ ...getCategoryDetails('expense', id), id, amount }))
            .sort((a, b) => b.amount - a.amount)

        return {
            total,
            installmentTotal,
            cashTotal: total - installmentTotal,
            installmentCount: transactions.filter(isInstallment).length,
            categories
        }
    }, [transactions])

    const groups = useMemo(() => {
        const visible = onlyInstallments ? transactions.filter(isInstallment) : transactions
        const map = {}
        visible.forEach(t => {
            const key = groupBy(t)
            if (!map[key]) map[key] = []
            map[key].push(t)
        })
        return Object.entries(map)
            .sort((a, b) => (a[0] < b[0] ? 1 : -1)) // mais recente primeiro
            .map(([key, items]) => ({
                key,
                items: items.slice().sort((a, b) => new Date(b.date) - new Date(a.date)),
                total: items.reduce((s, t) => s + t.amount, 0)
            }))
    }, [transactions, groupBy, onlyInstallments])

    if (!isOpen) return null

    const pct = (value) => (stats.total > 0 ? Math.round((value / stats.total) * 100) : 0)

    return (
        <div className="modal-overlay" onMouseDown={e => e.target.className === 'modal-overlay' && onClose()} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto', padding: 16
        }}>
            <div className="modal-content glass-panel" style={{
                background: '#1a1f2e', margin: 'auto', padding: 24, borderRadius: 16,
                width: '100%', maxWidth: 680, border: `1px solid ${color}`,
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${color}22`, position: 'relative'
            }}>
                <button onClick={onClose} style={{
                    position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.1)', border: 'none',
                    color: 'white', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}><X size={16} strokeWidth={2} /></button>

                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'white', margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: 8, paddingRight: 40 }}>
                    <CreditCard size={18} strokeWidth={2} color={color} /> {title}
                </h2>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>
                    {subtitle ? `${subtitle} · ` : ''}
                    <strong style={{ color }}>{formatCurrency(stats.total)}</strong> em {transactions.length} compra(s)
                </div>

                {/* À vista x parcelado */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Wallet size={12} strokeWidth={2} /> À vista
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'white', marginTop: 2 }}>{formatCurrency(stats.cashTotal)}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{pct(stats.cashTotal)}% do total</div>
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: 12, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.25)' }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Layers size={12} strokeWidth={2} /> Parcelas
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#a78bfa', marginTop: 2 }}>{formatCurrency(stats.installmentTotal)}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{stats.installmentCount} parcela(s) · {pct(stats.installmentTotal)}%</div>
                    </div>
                </div>

                {/* Categorias */}
                {stats.categories.length > 0 && (
                    <div style={{ marginBottom: 18 }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                            Por categoria
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {stats.categories.map(cat => (
                                <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <div style={{ width: 26, height: 26, borderRadius: 8, background: cat.color + '22', color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <CategoryIcon name={cat.iconName} size={13} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                                            <span style={{ color: 'white', fontWeight: 600 }}>{cat.label}</span>
                                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{formatCurrency(cat.amount)} <span style={{ color: 'rgba(255,255,255,0.35)' }}>({pct(cat.amount)}%)</span></span>
                                        </div>
                                        <div style={{ height: 5, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct(cat.amount)}%`, background: cat.color, borderRadius: 4 }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Extrato */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Extrato
                    </div>
                    {stats.installmentCount > 0 && (
                        <button
                            onClick={() => setOnlyInstallments(v => !v)}
                            style={{
                                fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '4px 10px', borderRadius: 8,
                                background: onlyInstallments ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${onlyInstallments ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.12)'}`,
                                color: onlyInstallments ? '#c4b5fd' : 'rgba(255,255,255,0.6)'
                            }}
                        >
                            Só parcelas
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '45vh', overflowY: 'auto', paddingRight: 6 }}>
                    {groups.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '32px 0' }}>
                            Nenhuma compra encontrada.
                        </div>
                    ) : groups.map(group => (
                        <div key={group.key}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 4 }}>
                                <span>{groupLabel(group.key)}</span>
                                <span style={{ color: 'rgba(255,255,255,0.5)' }}>{formatCurrency(group.total)}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {group.items.map(t => {
                                    const cat = getCategoryDetails('expense', t.category)
                                    const cardName = cardNameById[String(t.creditCardId)]
                                    return (
                                        <div key={t.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                                            background: 'rgba(255,255,255,0.03)', padding: '10px 14px', borderRadius: 10,
                                            borderLeft: `3px solid ${cat.color}`
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                                <div style={{ width: 32, height: 32, borderRadius: 9, background: cat.color + '22', color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <CategoryIcon name={cat.iconName} size={15} />
                                                </div>
                                                <div style={{ minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, color: 'white', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {t.desc || 'Sem descrição'}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        <span>{cat.label}</span>
                                                        {cardName && <><span>•</span><span>{cardName}</span></>}
                                                        <span>•</span>
                                                        {isInstallment(t) ? (
                                                            <span style={{ color: '#c4b5fd', fontWeight: 700 }}>
                                                                parcela {t.installmentNumber || '?'}/{t.installmentTotal}
                                                            </span>
                                                        ) : (
                                                            <span>à vista</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: 14, color: 'white', whiteSpace: 'nowrap' }}>
                                                    {formatCurrency(t.amount)}
                                                </div>
                                                <TxActions tx={t} onEdit={onEdit} onDelete={onDelete} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
