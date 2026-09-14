"use client";

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import {
    Chart,
    ArcElement,
    DoughnutController,
    LineElement,
    LineController,
    BarElement,
    BarController,
    PieController,
    PointElement,
    CategoryScale,
    LinearScale,
    Legend,
    Tooltip,
    Filler
} from 'chart.js'
import Sidebar from '../components/Sidebar'
import TransactionModal from '../components/TransactionModal'
import DetailsModal from '../components/DetailsModal'
import CreditSpendModal from '../components/CreditSpendModal'
import DashboardMetrics from '../components/dashboard/DashboardMetrics'
import MonthThermometer from '../components/dashboard/MonthThermometer'
import CategoryPieChart from '../components/dashboard/CategoryPieChart'
import RecentTransactions from '../components/dashboard/RecentTransactions'
import AllTransactionsModal from '../components/dashboard/AllTransactionsModal'
import { useSession } from '../hooks/useSession'
import { useTransactions } from '../hooks/useTransactions'
import { useCreditCards } from '../hooks/useCards'
import { useFinancings } from '../hooks/useFinancings'
import { useWalletAssets } from '../hooks/useWalletAssets'
import { formatCurrency, calcBalance, calcIncome, calcInvestment, isSpending } from '../helpers'
import { getCardInvoiceBreakdown, getInvoiceKey, getCardCycleKeyForMonth } from '../lib/cardMetrics'
import { pendingInstallmentsFor } from '../lib/financingSchedule'

Chart.register(
    ArcElement,
    DoughnutController,
    LineElement,
    LineController,
    BarElement,
    BarController,
    PieController,
    PointElement,
    CategoryScale,
    LinearScale,
    Legend,
    Tooltip,
    Filler
)

Chart.defaults.color = 'rgba(255,255,255,0.55)'
Chart.defaults.borderColor = 'rgba(255,255,255,0.06)'
Chart.defaults.font.family = "'Outfit', sans-serif"
Chart.defaults.font.size = 12

export default function DashboardPage() {
    const router = useRouter()
    const session = useSession()
    const { cards } = useCreditCards(session?.email)
    const { financings } = useFinancings(session?.email)
    const { transactions, loading, load, create, update, remove } = useTransactions(session?.email)
    const { totalNetWorth: walletTotalNetWorth } = useWalletAssets(session?.email)

    const [modalOpen, setModalOpen] = useState(false)
    const [editTx, setEditTx] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [filterType, setFilterType] = useState('all')
    const [showAllModal, setShowAllModal] = useState(false)
    const [currentDate, setCurrentDate] = useState(() => {
        const d = new Date()
        return new Date(d.getFullYear(), d.getMonth(), 1)
    })
    const [detailView, setDetailView] = useState(null)

    // Greeting
    const [greeting, setGreeting] = useState('Olá')

    useEffect(() => {
        const hour = new Date().getHours()
        const prefs = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('finance_settings') || '{}') : {}
        const name = prefs.name || session?.name || 'Usuário'
        const firstName = name.split(' ')[0]
        let word = 'Bom dia,'
        if (hour >= 12 && hour < 18) word = 'Boa tarde,'
        else if (hour >= 18) word = 'Boa noite,'
        setGreeting(`${word} ${firstName}`)
    }, [session])

    useEffect(() => {
        if (session === undefined) return
        if (!session) {
            router.push('/login')
            return
        }
        load()
    }, [session, load, router])

    // Filter transactions by selected month
    const filteredTransactions = useMemo(() => {
        const y = currentDate.getFullYear()
        const m = currentDate.getMonth()
        return transactions.filter(t => {
            const d = new Date(t.date + 'T00:00:00')
            return d.getFullYear() === y && d.getMonth() === m
        })
    }, [transactions, currentDate])

    const directExpenses = useMemo(
        () => filteredTransactions.filter(t => isSpending(t) && t.account !== 'credit'),
        [filteredTransactions]
    )

    const creditCycle = useMemo(() => {
        const y = currentDate.getFullYear()
        const m = currentDate.getMonth()

        const purchases = transactions.filter(t => {
            if (!isSpending(t) || t.account !== 'credit') return false
            const card = cards?.find(c => String(c.id) === String(t.creditCardId))
            if (!card) return false
            const targetKey = getCardCycleKeyForMonth(card, y, m)
            return getInvoiceKey(t.date, card.closing_day) === targetKey
        })

        const periods = (cards || []).map(card => {
            const closing = Number(card?.closing_day) || 25
            const dayLabel = (year, month, day) => {
                const maxDay = new Date(year, month + 1, 0).getDate()
                return `${String(Math.min(day, maxDay)).padStart(2, '0')}/${String(month + 1).padStart(2, '0')}`
            }
            if (closing <= 15) {
                const nextM = new Date(y, m + 1, 1)
                return `${dayLabel(y, m, closing + 1)} a ${dayLabel(nextM.getFullYear(), nextM.getMonth(), closing)}`
            } else {
                const prevM = new Date(y, m - 1, 1)
                return `${dayLabel(prevM.getFullYear(), prevM.getMonth(), closing + 1)} a ${dayLabel(y, m, closing)}`
            }
        })
        const uniquePeriods = [...new Set(periods)]

        let periodLabel = null
        if (uniquePeriods.length === 1) {
            periodLabel = uniquePeriods[0]
        } else if (uniquePeriods.length > 1) {
            const raw = currentDate.toLocaleDateString('pt-BR', { month: 'long' })
            periodLabel = `ciclos do mês de ${raw}`
        }

        const weekly = [0, 0, 0, 0]
        purchases.forEach(t => {
            const card = cards?.find(c => String(c.id) === String(t.creditCardId))
            const closing = Number(card?.closing_day) || 25
            const start = closing <= 15 ? new Date(y, m, closing + 1) : new Date(y, m - 1, closing + 1)
            const days = Math.floor((new Date(t.date + 'T00:00:00') - start) / 86400000)
            weekly[Math.min(3, Math.max(0, Math.floor(days / 7)))] += t.amount
        })

        return { purchases, periodLabel, weekly }
    }, [transactions, cards, currentDate])

    const creditPurchases = creditCycle.purchases
    const income = useMemo(() => calcIncome(filteredTransactions), [filteredTransactions])
    const directExpense = useMemo(() => directExpenses.reduce((s, t) => s + t.amount, 0), [directExpenses])
    const creditExpense = useMemo(() => creditPurchases.reduce((s, t) => s + t.amount, 0), [creditPurchases])
    const monthSpending = useMemo(() => [...directExpenses, ...creditPurchases], [directExpenses, creditPurchases])
    const expense = directExpense + creditExpense
    const investment = useMemo(() => calcInvestment(filteredTransactions) + walletTotalNetWorth, [filteredTransactions, walletTotalNetWorth])
    const balance = useMemo(() => calcBalance(filteredTransactions), [filteredTransactions])

    const detailInfo = useMemo(() => {
        if (!detailView) return { transactions: [], title: '', color: '' }
        let list = []
        let title = ''
        let color = ''

        if (detailView === 'income') {
            list = filteredTransactions.filter(t => t.type === 'income')
            title = 'Detalhes de Receitas'
            color = '#10b981'
        } else if (detailView === 'expense') {
            list = filteredTransactions.filter(t => isSpending(t) && t.account !== 'credit')
            title = 'Despesas no Débito, Pix e Dinheiro'
            color = '#ef4444'
        } else if (detailView === 'investment') {
            list = filteredTransactions.filter(t => t.type === 'investment')
            title = 'Detalhes de Investimentos'
            color = '#eab308'
        } else if (detailView === 'balance') {
            list = filteredTransactions
            title = 'Movimentações do Período'
            color = '#3b82f6'
        }

        return {
            transactions: list.slice().sort((a, b) => new Date(b.date) - new Date(a.date)),
            title,
            color
        }
    }, [detailView, filteredTransactions])

    const globalBalance = useMemo(() => {
        return transactions.reduce((acc, t) => {
            if (t.type === 'income') return acc + t.amount
            if (t.type === 'expense' && t.account !== 'credit') return acc - t.amount
            if (t.type === 'investment') return acc - t.amount
            return acc
        }, 0)
    }, [transactions])

    const creditStatus = useMemo(() => {
        if (!creditPurchases.length) return { paid: 0, unpaid: 0, nextDueDate: null }
        if (!cards?.length) return { paid: 0, unpaid: creditExpense, nextDueDate: null }

        const ratioByInvoice = {}
        const dueByInvoice = {}
        cards.forEach(card => {
            getCardInvoiceBreakdown(transactions, card, currentDate).forEach(inv => {
                const id = `${card.id}_${inv.key}`
                ratioByInvoice[id] = inv.totalExpenses > 0 ? inv.paidAmount / inv.totalExpenses : 1
                dueByInvoice[id] = inv.dueDate
            })
        })

        let paid = 0
        let unpaid = 0
        const pendingDueDates = []

        creditPurchases.forEach(t => {
            const card = cards.find(c => String(c.id) === String(t.creditCardId))
            const id = card ? `${card.id}_${getInvoiceKey(t.date, card.closing_day)}` : null
            const ratio = id && ratioByInvoice[id] != null ? ratioByInvoice[id] : 0

            const missing = t.amount * (1 - ratio)
            paid += t.amount * ratio
            unpaid += missing
            if (missing >= 0.01 && id && dueByInvoice[id]) pendingDueDates.push(dueByInvoice[id])
        })

        return {
            paid,
            unpaid,
            nextDueDate: pendingDueDates.sort()[0] || null
        }
    }, [creditPurchases, creditExpense, cards, transactions, currentDate])

    const invoiceMetrics = useMemo(() => {
        const y = currentDate.getFullYear()
        const m = currentDate.getMonth()

        let selectedMonthInvoice = 0
        let priorPendingInvoices = 0

        if (cards && cards.length > 0) {
            cards.forEach(card => {
                const targetKey = getCardCycleKeyForMonth(card, y, m)
                const breakdown = getCardInvoiceBreakdown(transactions, card, currentDate)
                breakdown.forEach(inv => {
                    if (inv.remaining > 0) {
                        if (inv.key === targetKey) {
                            selectedMonthInvoice += inv.remaining
                        } else if (inv.key < targetKey) {
                            priorPendingInvoices += inv.remaining
                        }
                    }
                })
            })
        } else {
            const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59)
            let rawSelected = 0
            let rawPrior = 0
            let totalPayments = 0

            transactions.forEach(t => {
                const d = new Date(t.date + 'T00:00:00')
                if (d <= endOfMonth) {
                    if (t.category === 'invoice_payment') {
                        totalPayments += t.amount
                    } else if (t.account === 'credit' && t.type === 'expense') {
                        if (d.getFullYear() === y && d.getMonth() === m) {
                            rawSelected += t.amount
                        } else {
                            rawPrior += t.amount
                        }
                    }
                }
            })

            let remPayments = totalPayments
            const paidPrior = Math.min(rawPrior, remPayments)
            priorPendingInvoices = Math.max(0, rawPrior - paidPrior)
            remPayments -= paidPrior

            const paidCurrent = Math.min(rawSelected, remPayments)
            selectedMonthInvoice = Math.max(0, rawSelected - paidCurrent)
        }

        const now = new Date()
        const isFutureMonth = y > now.getFullYear() || (y === now.getFullYear() && m > now.getMonth())

        return {
            monthInvoice: selectedMonthInvoice,
            olderPending: isFutureMonth ? 0 : priorPendingInvoices
        }
    }, [transactions, cards, currentDate])

    const { olderPending } = invoiceMetrics
    const monthLabelShort = currentDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')

    const cardNameById = useMemo(() => {
        const map = {}
        ;(cards || []).forEach(c => { map[String(c.id)] = c.name })
        return map
    }, [cards])

    const financingDue = useMemo(
        () => pendingInstallmentsFor(financings, currentDate.getFullYear(), currentDate.getMonth()),
        [financings, currentDate]
    )

    // Recent 5 filtered
    const recentTxs = useMemo(() => {
        let list = [...filteredTransactions].sort((a, b) => new Date(b.date) - new Date(a.date))
        if (filterType !== 'all') list = list.filter(t => t.type === filterType)
        if (searchQuery) list = list.filter(t => t.desc.toLowerCase().includes(searchQuery.toLowerCase()) || (t.note || '').toLowerCase().includes(searchQuery.toLowerCase()))
        return list.slice(0, 5)
    }, [filteredTransactions, filterType, searchQuery])

    // Split lists
    const incomeList = useMemo(() => [...filteredTransactions].filter(t => t.type === 'income').sort((a, b) => new Date(b.date) - new Date(a.date)), [filteredTransactions])
    const expenseList = useMemo(() => [...filteredTransactions].filter(t => t.type === 'expense' || t.type === 'investment').sort((a, b) => new Date(b.date) - new Date(a.date)), [filteredTransactions])

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

    async function handleDelete(id) {
        try {
            await remove(id)
        } catch (err) {
            alert('Não foi possível excluir a transação: ' + (err.message || 'erro desconhecido'))
        }
    }

    function openNew() {
        setEditTx(null)
        setModalOpen(true)
    }

    // Sparklines data (Weekly buckets within the selected month)
    const monthsData = useMemo(() => {
        if (!filteredTransactions) return { inc: { data: [] }, exp: { data: [] }, inv: { data: [] }, bal: { data: [] } }

        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()
        const weekLabels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4']
        const wInc = [0, 0, 0, 0], wExp = [0, 0, 0, 0], wInv = [0, 0, 0, 0], wBal = [0, 0, 0, 0]

        filteredTransactions.forEach(t => {
            const d = new Date(t.date + 'T00:00:00')
            if (d.getFullYear() === year && d.getMonth() === month) {
                const day = d.getDate()
                const wi = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3
                if (t.type === 'income') wInc[wi] += t.amount
                else if (t.type === 'investment') wInv[wi] += t.amount
                else if (isSpending(t) && t.account !== 'credit') wExp[wi] += t.amount
            }
        })

        const prevBalance = transactions.reduce((acc, t) => {
            const d = new Date(t.date + 'T00:00:00')
            if (d < new Date(year, month, 1)) {
                if (t.type === 'income') return acc + t.amount
                if (t.type === 'expense' && t.account !== 'credit') return acc - t.amount
            }
            return acc
        }, 0)

        const wCash = [0, 0, 0, 0]
        filteredTransactions.forEach(t => {
            const d = new Date(t.date + 'T00:00:00')
            if (d.getFullYear() === year && d.getMonth() === month && t.type === 'expense' && t.account !== 'credit') {
                const day = d.getDate()
                wCash[day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : 3] += t.amount
            }
        })

        wBal[0] = prevBalance + wInc[0] - wCash[0] - wInv[0]
        wBal[1] = wBal[0] + wInc[1] - wCash[1] - wInv[1]
        wBal[2] = wBal[1] + wInc[2] - wCash[2] - wInv[2]
        wBal[3] = wBal[2] + wInc[3] - wCash[3] - wInv[3]

        const buildWeekMetric = (arr) => ({
            labels: weekLabels,
            data: arr,
            bestMonth: weekLabels[arr.indexOf(Math.max(...arr))],
            bestVal: Math.max(...arr, 0)
        })

        return {
            inc: buildWeekMetric(wInc),
            exp: buildWeekMetric(wExp),
            inv: buildWeekMetric(wInv),
            bal: buildWeekMetric(wBal)
        }
    }, [filteredTransactions, transactions, currentDate])

    if (session === undefined) return null;

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />

                <main className="main-content">
                    <div style={{ minHeight: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Header */}
                        <header className="top-header fade-up" style={{ position: 'relative', zIndex: 50 }}>
                            <div>
                                <h2 className="page-title">{greeting}</h2>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                    <p className="page-subtitle" style={{ margin: 0 }}>Acompanhe suas finanças em tempo real com controle total.</p>
                                    {(() => {
                                        const rawMonth = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                                        const displayMonth = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1)
                                        const now = new Date()
                                        const isCurrentMonth = currentDate.getFullYear() === now.getFullYear() && currentDate.getMonth() === now.getMonth()
                                        return (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)' }}>
                                                    <button
                                                        onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                                                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', padding: '8px 12px', cursor: 'pointer', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                                                        &lt;
                                                    </button>
                                                    <div style={{ padding: '0 16px', fontWeight: 600, color: 'white', minWidth: 140, textAlign: 'center', fontSize: 14 }}>
                                                        {displayMonth}
                                                    </div>
                                                    <button
                                                        onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                                                        style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.7)', padding: '8px 12px', cursor: 'pointer', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                                                        &gt;
                                                    </button>
                                                </div>
                                                {!isCurrentMonth && (
                                                    <button
                                                        onClick={() => setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1))}
                                                        style={{
                                                            background: 'rgba(59, 130, 246, 0.15)',
                                                            border: '1px solid rgba(59, 130, 246, 0.3)',
                                                            color: '#60a5fa',
                                                            borderRadius: 12,
                                                            padding: '6px 12px',
                                                            fontSize: 12,
                                                            fontWeight: 600,
                                                            cursor: 'pointer'
                                                        }}>
                                                        Mês Atual
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })()}
                                </div>
                            </div>
                            <button id="add-transaction-btn" className="btn-primary" onClick={openNew}>
                                <Plus size={16} strokeWidth={2} className="icon" /> Nova Transação
                            </button>
                        </header>

                        {/* Indicadores Principais (KPI Cards com Sparklines) */}
                        <DashboardMetrics
                            income={income}
                            directExpense={directExpense}
                            directExpenses={directExpenses}
                            creditExpense={creditExpense}
                            creditPurchases={creditPurchases}
                            creditCycle={creditCycle}
                            creditStatus={creditStatus}
                            globalBalance={globalBalance}
                            financingDue={financingDue}
                            monthLabelShort={monthLabelShort}
                            olderPending={olderPending}
                            investment={investment}
                            monthsData={monthsData}
                            onSelectDetail={setDetailView}
                            onNavigateInvestments={() => router.push('/investments')}
                            formatCurrency={formatCurrency}
                        />

                        {/* Termômetro Financeiro do Mês */}
                        <MonthThermometer
                            income={income}
                            expense={expense}
                            directExpense={directExpense}
                            creditExpense={creditExpense}
                            formatCurrency={formatCurrency}
                        />

                        {/* Gráfico de Rosca de Categorias */}
                        <CategoryPieChart monthSpending={monthSpending} />
                    </div>

                    {/* Transações Recentes e Filtros de Busca */}
                    <RecentTransactions
                        incomeList={incomeList}
                        expenseList={expenseList}
                        income={income}
                        expense={expense}
                        investment={investment}
                        recentTxs={recentTxs}
                        loading={loading}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        filterType={filterType}
                        setFilterType={setFilterType}
                        onOpenEdit={openEdit}
                        onDelete={handleDelete}
                        onViewAll={() => setShowAllModal(true)}
                        formatCurrency={formatCurrency}
                    />
                </main>
            </div>

            {/* Modais */}
            <TransactionModal
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditTx(null) }}
                onSave={handleSave}
                editTx={editTx}
            />

            <AllTransactionsModal
                isOpen={showAllModal}
                onClose={() => setShowAllModal(false)}
                transactions={filteredTransactions}
                onEdit={openEdit}
                onDelete={handleDelete}
            />

            <CreditSpendModal
                isOpen={detailView === 'credit'}
                onClose={() => setDetailView(null)}
                title="Gastos no Crédito"
                subtitle={creditCycle.periodLabel}
                transactions={creditCycle.purchases}
                cardNameById={cardNameById}
                onEdit={openEdit}
                onDelete={handleDelete}
            />

            <DetailsModal
                isOpen={!!detailView && detailView !== 'credit'}
                onClose={() => setDetailView(null)}
                type={detailView}
                transactions={detailInfo.transactions}
                title={detailInfo.title}
                color={detailInfo.color}
                onEdit={openEdit}
                onDelete={handleDelete}
            />
        </div>
    )
}
