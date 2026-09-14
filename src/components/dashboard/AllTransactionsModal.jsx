import React, { useState, useMemo } from 'react'
import { ArrowUp, ArrowDown, TrendingUp, Inbox, X } from 'lucide-react'
import TxCard from '../TxCard'

export default function AllTransactionsModal({
    isOpen,
    onClose,
    transactions = [],
    onEdit,
    onDelete
}) {
    const [allSearch, setAllSearch] = useState('')
    const [allFilter, setAllFilter] = useState('all')

    const allTxs = useMemo(() => {
        let list = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date))
        if (allFilter !== 'all') list = list.filter(t => t.type === allFilter)
        if (allSearch) {
            const q = allSearch.toLowerCase()
            list = list.filter(t => t.desc.toLowerCase().includes(q) || (t.note || '').toLowerCase().includes(q))
        }
        return list
    }, [transactions, allFilter, allSearch])

    if (!isOpen) return null

    return (
        <div
            style={{
                display: 'flex',
                position: 'fixed',
                inset: 0,
                zIndex: 8100,
                background: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(6px)',
                alignItems: 'flex-start',
                justifyContent: 'center',
                paddingTop: 40
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                style={{
                    background: '#111827',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 20,
                    width: '100%',
                    maxWidth: 680,
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    color: 'white',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
                    margin: '0 16px'
                }}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '20px 24px 16px',
                        borderBottom: '1px solid rgba(255,255,255,0.07)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flexShrink: 0
                    }}
                >
                    <input
                        type="search"
                        placeholder="Buscar por descrição ou observação..."
                        value={allSearch}
                        onChange={e => setAllSearch(e.target.value)}
                        style={{
                            flex: 1,
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(0,0,0,0.3)',
                            color: 'white',
                            fontSize: 14,
                            fontFamily: 'inherit',
                            outline: 'none'
                        }}
                        autoFocus
                    />
                    <button
                        id="all-tx-close"
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.07)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 8,
                            color: 'rgba(255,255,255,0.6)',
                            cursor: 'pointer',
                            width: 34,
                            height: 34,
                            fontSize: 18,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        <X size={16} strokeWidth={2} />
                    </button>
                </div>

                {/* Filters */}
                <div
                    style={{
                        padding: '12px 24px',
                        display: 'flex',
                        gap: 6,
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                        flexShrink: 0
                    }}
                >
                    {['all', 'income', 'expense', 'investment'].map(ft => (
                        <button
                            key={ft}
                            className={'tx-filter-btn' + (allFilter === ft ? ' tx-filter-active' : '')}
                            onClick={() => setAllFilter(ft)}
                        >
                            {ft === 'all' ? 'Todas' : ft === 'income' ? <><ArrowUp size={13} strokeWidth={2} /> Entradas</> : ft === 'expense' ? <><ArrowDown size={13} strokeWidth={2} /> Saídas</> : <><TrendingUp size={13} strokeWidth={2} /> Invest.</>}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div id="all-tx-list" style={{ overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {allTxs.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>
                            <div style={{ fontSize: 'clamp(22px, 5vw, 32px)', marginBottom: 8 }}><Inbox size={30} strokeWidth={1.5} /></div>
                            Nenhuma transação encontrada.
                        </div>
                    ) : allTxs.map(tx => (
                        <TxCard
                            key={tx.id}
                            tx={tx}
                            onEdit={tx2 => {
                                onClose()
                                onEdit(tx2)
                            }}
                            onDelete={onDelete}
                        />
                    ))}
                </div>
            </div>
        </div>
    )
}
