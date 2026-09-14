import React from 'react'
import { ArrowUp, ArrowDown, TrendingUp, Inbox } from 'lucide-react'
import TxCard from '../TxCard'

export default function RecentTransactions({
    incomeList = [],
    expenseList = [],
    income = 0,
    expense = 0,
    investment = 0,
    recentTxs = [],
    loading = false,
    searchQuery = '',
    setSearchQuery,
    filterType = 'all',
    setFilterType,
    onOpenEdit,
    onDelete,
    onViewAll,
    formatCurrency
}) {
    return (
        <section className="dashboard-content fade-up delay-2" style={{ marginTop: 40 }}>
            {/* Split Lists */}
            <div className="recent-transactions glass-panel">
                <div className="section-header" style={{ marginBottom: 16 }}>
                    <h3>Movimentações Recentes</h3>
                </div>

                <div className="split-lists">
                    <div className="list-column">
                        <h4 style={{ marginBottom: 12, color: 'var(--success-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ArrowUp size={18} strokeWidth={2} /> Receitas
                        </h4>
                        <div className="transactions-list">
                            {incomeList.length === 0 ? (
                                <div className="empty-state"><p style={{ fontSize: 14 }}>Sem registros</p></div>
                            ) : incomeList.map(tx => (
                                <TxCard key={tx.id} tx={tx} onEdit={onOpenEdit} onDelete={onDelete} />
                            ))}
                        </div>
                        <div className="column-footer">
                            Total: <span className="positive">{formatCurrency(income)}</span>
                        </div>
                    </div>

                    <div className="list-column">
                        <h4 style={{ marginBottom: 12, color: 'var(--danger-color)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ArrowDown size={18} strokeWidth={2} /> Saídas (Gastos/Invest.)
                        </h4>
                        <div className="transactions-list">
                            {expenseList.length === 0 ? (
                                <div className="empty-state"><p style={{ fontSize: 14 }}>Sem registros</p></div>
                            ) : expenseList.map(tx => (
                                <TxCard key={tx.id} tx={tx} onEdit={onOpenEdit} onDelete={onDelete} />
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
                        onClick={onViewAll}
                        style={{
                            background: 'none',
                            border: '1px solid rgba(99,102,241,0.3)',
                            color: 'var(--accent-primary)',
                            fontFamily: 'inherit',
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '6px 12px',
                            borderRadius: 8,
                            transition: 'background 0.2s'
                        }}
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
                        placeholder="Buscar..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            flex: 1,
                            minWidth: 160,
                            padding: '9px 14px',
                            borderRadius: 10,
                            border: '1px solid rgba(255,255,255,0.1)',
                            background: 'rgba(0,0,0,0.3)',
                            color: 'white',
                            fontSize: 14,
                            fontFamily: 'inherit',
                            outline: 'none'
                        }}
                    />
                    <div className="tx-filter-btns">
                        {['all', 'income', 'expense', 'investment'].map(ft => (
                            <button
                                key={ft}
                                data-tx-filter={ft}
                                className={'tx-filter-btn' + (filterType === ft ? ' tx-filter-active' : '')}
                                onClick={() => setFilterType(ft)}
                            >
                                {ft === 'all' ? 'Todas' : ft === 'income' ? <><ArrowUp size={13} strokeWidth={2} /> Entradas</> : ft === 'expense' ? <><ArrowDown size={13} strokeWidth={2} /> Saídas</> : <><TrendingUp size={13} strokeWidth={2} /> Invest.</>}
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
                            <div style={{ fontSize: 'clamp(22px, 5vw, 32px)', marginBottom: 8 }}><Inbox size={30} strokeWidth={1.5} /></div>
                            Nenhuma transação encontrada.
                        </div>
                    ) : recentTxs.map(tx => (
                        <TxCard key={tx.id} tx={tx} onEdit={onOpenEdit} onDelete={onDelete} />
                    ))}
                </div>
            </div>
        </section>
    )
}
