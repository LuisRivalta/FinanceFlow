"use client";

import { getCategoryDetails, getAccountLabel, formatCurrency, formatDate } from '../lib/utils'

export default function TxCard({ tx, onEdit, onDelete }) {
    const isIncome = tx.type === 'income'
    const isInvestment = tx.type === 'investment'
    const color = isIncome ? '#10b981' : isInvestment ? '#8b5cf6' : '#ef4444'
    const sign = isIncome ? '+' : isInvestment ? '' : '-'
    const cat = getCategoryDetails(tx.type, tx.category)
    const acc = getAccountLabel(tx.account)

    return (
        <div className="tx-card">
            <div className="tx-card-left">
                <div className="tx-card-icon" style={{ background: cat.color + '22', color: cat.color }}>{cat.icon}</div>
                <div className="tx-card-info">
                    <div className="tx-card-desc">{tx.desc}</div>
                    <div className="tx-card-meta">
                        <span>{cat.label}</span>
                        <span className="tx-meta-dot">·</span>
                        <span>{acc.icon} {acc.label}</span>
                        <span className="tx-meta-dot">·</span>
                        <span>{formatDate(tx.date)}</span>
                        {tx.note && (
                            <>
                                <span className="tx-meta-dot">·</span>
                                <span title={tx.note} style={{ color: 'rgba(255,255,255,0.4)', cursor: 'help' }}>📝 obs</span>
                            </>
                        )}
                        {tx.isRecurring && <span title="Recorrente" style={{ color: 'var(--warning-color)' }}>↻</span>}
                        {tx.parentId && <span title="Gerado automaticamente" style={{ color: 'var(--text-secondary)' }}>↳</span>}
                    </div>
                </div>
            </div>
            <div className="tx-card-right">
                <div className="tx-card-amount" style={{ color }}>{sign} {formatCurrency(tx.amount)}</div>
                <div className="tx-card-actions">
                    <button className="tx-act-btn" onClick={() => onEdit(tx)} title="Editar">✏️</button>
                    <button className="tx-act-btn tx-act-danger" onClick={() => onDelete(tx.id)} title="Excluir">🗑️</button>
                </div>
            </div>
        </div>
    )
}
