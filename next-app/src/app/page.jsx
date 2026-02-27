"use client";

import { useEffect, useState, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import TxCard from '../components/TxCard'
import TransactionModal from '../components/TransactionModal'
import { useSession } from '../hooks/useSession'
import { useTransactions } from '../hooks/useTransactions'
import { formatCurrency, calcBalance, calcIncome, calcExpense, calcInvestment, getCategoryDetails } from '../lib/utils'

export default function DashboardPage() {
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
    const greeting = useMemo(() => {
        const hour = new Date().getHours()
        const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}')
        const name = prefs.name || session?.name || 'Usuário'
        const firstName = name.split(' ')[0]
        let word = 'Bom dia,'
        if (hour >= 12 && hour < 18) word = 'Boa tarde,'
        else if (hour >= 18) word = 'Boa noite,'
        return `${word} ${firstName} 👋`
    }, [session])

    useEffect(() => {
        load()
    }, [load])

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

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />

                <main className="main-content">
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

                    {/* Summary Cards */}
                    <section className="summary-cards fade-up delay-1">
                        <div className="card glass-panel balance-card">
                            <div className="card-header">
                                <h3>Saldo Disponível</h3>
                                <span className="icon">💰</span>
                            </div>
                            <h2 className={`amount ${balanceClass}`}>{formatCurrency(balance)}</h2>
                        </div>

                        <div className="card glass-panel income-card">
                            <div className="card-header">
                                <h3>Receita</h3>
                                <span className="icon">⬆️</span>
                            </div>
                            <h2 className="amount positive">{formatCurrency(income)}</h2>
                        </div>

                        <div className="card glass-panel expense-card">
                            <div className="card-header">
                                <h3>Despesas Gerais</h3>
                                <span className="icon">⬇️</span>
                            </div>
                            <h2 className="amount negative">{formatCurrency(expense)}</h2>
                        </div>

                        <div className="card glass-panel investment-card">
                            <div className="card-header">
                                <h3>Investimentos</h3>
                                <span className="icon">🚀</span>
                            </div>
                            <h2 className="amount neutral">{formatCurrency(investment)}</h2>
                        </div>
                    </section>

                    {/* Dashboard Content */}
                    <section className="dashboard-content fade-up delay-2">
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
