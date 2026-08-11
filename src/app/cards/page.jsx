"use client";

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import CreditCardItem from '../../components/CreditCardItem'
import FinancialCalendar from '../../components/FinancialCalendar'
import { useSession } from '../../hooks/useSession'
import { useCreditCards } from '../../hooks/useCards'
import { useTransactions } from '../../hooks/useTransactions'
import { useFinancings } from '../../hooks/useFinancings'
import { formatCurrency, formatDate } from '../../helpers'
import { calcCardInvoice, getCardInvoiceBreakdown } from '../../lib/cardMetrics'

export default function CardsPage() {
    const router = useRouter()
    const session = useSession()
    
    useEffect(() => {
        if (session === undefined) return
        if (!session) {
            router.push('/login')
        }
    }, [session, router])

    const { cards, load: loadCards, create: createCard, update: updateCard, remove: removeCard, loading: loadingCards } = useCreditCards(session?.email)
    const { transactions, load: loadTxs, create: createTx, remove: removeTx } = useTransactions(session?.email)
    const { financings, addFinancing, removeFinancing, payInstallment } = useFinancings(session?.email)

    useEffect(() => {
        if (session) {
            loadCards()
            loadTxs()
        }
    }, [session, loadCards, loadTxs])

    // Active Tab state: 'cards' or 'financings'
    const [activeTab, setActiveTab] = useState('cards')

    // Credit Card Form state
    const [isAddingCard, setIsAddingCard] = useState(false)
    const [editingCardId, setEditingCardId] = useState(null)
    const [newCard, setNewCard] = useState({ name: '', brand: 'Mastercard', limit: '', closingDay: '', dueDay: '', color: '#8b5cf6' })

    // Inline Subscription Form state
    const [isAddingSub, setIsAddingSub] = useState(false)
    const [newSub, setNewSub] = useState({
        desc: '',
        amount: '',
        cardId: '',
        billingPeriod: 'current',
        date: new Date().toISOString().split('T')[0]
    })

    function handleSubPeriodChange(period) {
        const today = new Date()
        let dateStr = today.toISOString().split('T')[0]
        if (period === 'next') {
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate())
            dateStr = nextMonth.toISOString().split('T')[0]
        }
        setNewSub(prev => ({
            ...prev,
            billingPeriod: period,
            date: dateStr
        }))
    }

    // Inline Credit Card Installment Form state
    const [isAddingInstallment, setIsAddingInstallment] = useState(false)
    const [newInstallment, setNewInstallment] = useState({ desc: '', amount: '', total: '', paidCount: '0', billingPeriod: 'current', cardId: '' })

    // Financing Form state
    const [isAddingFinancing, setIsAddingFinancing] = useState(false)
    const [newFinancing, setNewFinancing] = useState({
        name: '',
        type: 'car',
        monthlyPayment: '',
        totalInstallments: '',
        paidInstallments: '',
        dueDay: '10',
        account: 'checking'
    })

    function handleEditCardClick(card) {
        setEditingCardId(card.id)
        setNewCard({
            name: card.name,
            brand: card.brand,
            limit: card.credit_limit,
            closingDay: card.closing_day,
            dueDay: card.due_day,
            color: card.color
        })
        setIsAddingCard(true)
    }

    function cancelEditCard() {
        setIsAddingCard(false)
        setEditingCardId(null)
        setNewCard({ name: '', brand: 'Mastercard', limit: '', closingDay: '', dueDay: '', color: '#8b5cf6' })
    }

    async function handleAddCard(e) {
        e.preventDefault()
        try {
            const payload = { ...newCard, limit: parseFloat(newCard.limit), closingDay: parseInt(newCard.closingDay), dueDay: parseInt(newCard.dueDay) }
            if (editingCardId) {
                await updateCard(editingCardId, payload)
            } else {
                await createCard(payload)
            }
            cancelEditCard()
        } catch (err) {
            alert('Erro ao salvar cartão: ' + err.message)
        }
    }

    async function handleAddSubSubmit(e) {
        e.preventDefault()
        if (!newSub.desc || !newSub.amount || !newSub.cardId) {
            alert('Preencha todos os campos da assinatura.')
            return
        }
        try {
            await createTx({
                desc: newSub.desc.trim(),
                amount: parseFloat(newSub.amount),
                type: 'expense',
                category: 'leisure',
                account: 'credit',
                date: newSub.date || new Date().toISOString().split('T')[0],
                creditCardId: String(newSub.cardId),
                isSubscription: true
            })
            setIsAddingSub(false)
            setNewSub({ desc: '', amount: '', cardId: '', billingPeriod: 'current', date: new Date().toISOString().split('T')[0] })
        } catch (err) {
            alert('Erro ao salvar assinatura: ' + err.message)
        }
    }

    async function handleAddInstallmentSubmit(e) {
        e.preventDefault()
        if (!newInstallment.desc || !newInstallment.amount || !newInstallment.total || !newInstallment.cardId) {
            alert('Preencha todos os campos do parcelamento.')
            return
        }

        const total = parseInt(newInstallment.total)
        const paid = parseInt(newInstallment.paidCount || 0)
        if (paid >= total) {
            alert('O número de parcelas já pagas não pode ser igual ou superior ao total de parcelas.')
            return
        }

        try {
            const today = new Date()
            const startMonthOffset = newInstallment.billingPeriod === 'next' ? 1 : 0

            for (let i = paid + 1; i <= total; i++) {
                const stepIndex = i - (paid + 1)
                const txDate = new Date(today.getFullYear(), today.getMonth() + startMonthOffset + stepIndex, today.getDate())
                const dateStr = txDate.toISOString().split('T')[0]

                await createTx({
                    desc: `${newInstallment.desc.trim()} (${i}/${total})`,
                    amount: parseFloat(newInstallment.amount),
                    type: 'expense',
                    category: 'other_expense',
                    account: 'credit',
                    date: dateStr,
                    creditCardId: String(newInstallment.cardId),
                    installmentNumber: i,
                    installmentTotal: total
                })
            }
            setIsAddingInstallment(false)
            setNewInstallment({ desc: '', amount: '', total: '', paidCount: '0', billingPeriod: 'current', cardId: '' })
        } catch (err) {
            alert('Erro ao salvar compra parcelada: ' + err.message)
        }
    }

    function handleAddFinancingSubmit(e) {
        e.preventDefault()
        if (!newFinancing.name || !newFinancing.monthlyPayment || !newFinancing.totalInstallments) {
            alert('Preencha os campos obrigatórios do financiamento.')
            return
        }
        addFinancing(newFinancing)
        setIsAddingFinancing(false)
        setNewFinancing({
            name: '',
            type: 'car',
            monthlyPayment: '',
            totalInstallments: '',
            paidInstallments: '',
            dueDay: '10',
            account: 'checking'
        })
    }

    async function handlePayInvoice(card, invoiceAmount, invoiceKey = null) {
        if (invoiceAmount <= 0) {
            alert('A fatura deste mês já está zerada ou paga.')
            return
        }

        let descLabel = `Pagamento Fatura - ${card.name}`
        if (invoiceKey) {
            const [y, m] = invoiceKey.split('-')
            const monthLabel = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
            descLabel = `Pagamento Fatura (${monthLabel}) - ${card.name}`
        }
        
        const ok = confirm(`Deseja pagar o valor de ${formatCurrency(invoiceAmount)} referente à fatura do cartão ${card.name}?\nIsso debitará o valor da sua Conta Corrente.`)
        if (!ok) return

        try {
            await createTx({
                desc: descLabel,
                amount: invoiceAmount,
                type: 'expense',
                category: 'invoice_payment',
                account: 'checking',
                date: new Date().toISOString().split('T')[0],
                creditCardId: String(card.id)
            })
            alert('Fatura paga com sucesso! O valor foi deduzido da sua Conta Corrente.')
        } catch (err) {
            alert('Erro ao pagar fatura: ' + err.message)
        }
    }

    const handlePayFinancingInstallment = (f) => {
        const remaining = f.totalInstallments - f.paidInstallments;
        if (remaining <= 0) {
            alert('Este financiamento já está 100% quitado!');
            return;
        }

        const nextNum = f.paidInstallments + 1;
        const ok = confirm(`Confirmar o pagamento da parcela ${nextNum}/${f.totalInstallments} no valor de ${formatCurrency(f.monthlyPayment)}?\n\nIsso avançará seu progresso e registrará o lançamento da despesa.`);
        if (!ok) return;

        payInstallment(f.id, (txData) => {
            createTx(txData).catch(err => console.error("Erro ao registrar transação da parcela", err));
        });
    }

    // Filter transactions
    const cardTxs = useMemo(() => transactions.filter(t => t.creditCardId != null && t.creditCardId !== ''), [transactions])
    const subscriptions = useMemo(() => cardTxs.filter(t => t.isSubscription), [cardTxs])
    const installments = useMemo(() => cardTxs.filter(t => (t.installmentTotal && t.installmentTotal > 1) || /\(\d+[\s\/de]+\d+\)/i.test(t.desc)), [cardTxs])

    const handleRemoveInstallmentGroup = async (inst) => {
        const ok = confirm(`Deseja apagar o parcelamento "${inst.name}" e todas as suas parcelas?`)
        if (!ok) return
        try {
            for (const id of inst.txIds) {
                await removeTx(id, { skipConfirm: true })
            }
        } catch (err) {
            alert('Erro ao apagar parcelamento: ' + err.message)
        }
    }

    // Group installments to show progress
    const activeInstallments = useMemo(() => {
        const groups = {}
        installments.forEach(t => {
            const match = t.desc.match(/\((\d+)[\s\/de]+(\d+)\)/i)
            const cleanName = t.desc.replace(/\s*\(\d+[\s\/de]+\d+\).*/gi, '').trim() || t.desc
            const instNum = t.installmentNumber || (match ? parseInt(match[1]) : 1)
            const instTotal = t.installmentTotal || (match ? parseInt(match[2]) : 1)

            const groupKey = `${cleanName.toLowerCase()}_${t.creditCardId || ''}_${t.amount}`

            if (!groups[groupKey]) {
                groups[groupKey] = { 
                    name: cleanName, 
                    total: instTotal, 
                    amount: t.amount, 
                    minNum: instNum, 
                    paidCount: 0,
                    txIds: [t.id],
                    cardId: t.creditCardId 
                }
            } else {
                groups[groupKey].txIds.push(t.id)
                if (instNum < groups[groupKey].minNum) {
                    groups[groupKey].minNum = instNum
                }
                if (instTotal > groups[groupKey].total) {
                    groups[groupKey].total = instTotal
                }
            }

            const txDate = new Date(t.date + 'T00:00:00')
            if (txDate <= new Date()) {
                groups[groupKey].paidCount++
            }
        })

        return Object.values(groups).map(g => {
            const initialPaid = Math.max(0, g.minNum - 1)
            const current = initialPaid + g.paidCount
            return {
                ...g,
                current: Math.min(g.total, current)
            }
        })
    }, [installments])

    // Total debt statistics for financings
    const totalFinancingRemainingDebt = useMemo(() => {
        return financings.reduce((sum, f) => {
            const remaining = Math.max(0, f.totalInstallments - f.paidInstallments)
            return sum + (remaining * f.monthlyPayment)
        }, 0)
    }, [financings])

    const totalFinancingPaid = useMemo(() => {
        return financings.reduce((sum, f) => {
            return sum + (f.paidInstallments * f.monthlyPayment)
        }, 0)
    }, [financings])

    const totalSubscriptionAmount = useMemo(() => {
        return subscriptions.reduce((sum, s) => sum + s.amount, 0)
    }, [subscriptions])

    const totalInstallmentMonthly = useMemo(() => {
        return activeInstallments.reduce((sum, inst) => sum + (inst.current < inst.total ? inst.amount : 0), 0)
    }, [activeInstallments])

    const totalInstallmentRemaining = useMemo(() => {
        return activeInstallments.reduce((sum, inst) => sum + Math.max(0, inst.total - inst.current) * inst.amount, 0)
    }, [activeInstallments])

    const totalFinancingMonthly = useMemo(() => {
        return financings.reduce((sum, f) => {
            return sum + (f.paidInstallments < f.totalInstallments ? f.monthlyPayment : 0)
        }, 0)
    }, [financings])

    const totalFixedMonthly = useMemo(() => {
        return totalSubscriptionAmount + totalInstallmentMonthly + totalFinancingMonthly
    }, [totalSubscriptionAmount, totalInstallmentMonthly, totalFinancingMonthly])

    const allFixedItems = useMemo(() => {
        const list = []

        // Subscriptions
        subscriptions.forEach(sub => {
            const cardObj = cards.find(c => String(c.id) === String(sub.creditCardId))
            list.push({
                id: `sub_${sub.id}`,
                name: sub.desc,
                type: 'subscription',
                typeLabel: '🔁 Assinatura',
                typeColor: '#8b5cf6',
                origin: cardObj ? `Cartão ${cardObj.name}` : 'Cartão de Crédito',
                progressText: 'Mensal Recorrente',
                monthlyAmount: sub.amount,
                remainingTotal: null,
                isCompleted: false
            })
        })

        // Installments
        activeInstallments.forEach(inst => {
            const cardObj = cards.find(c => String(c.id) === String(inst.cardId))
            const isCompleted = inst.current >= inst.total
            const remainingCount = Math.max(0, inst.total - inst.current)
            list.push({
                id: `inst_${inst.name}_${inst.cardId}`,
                name: inst.name,
                type: 'installment',
                typeLabel: '⏳ Compra Parcelada',
                typeColor: '#3b82f6',
                origin: cardObj ? `Cartão ${cardObj.name}` : 'Cartão de Crédito',
                progressText: `${inst.current} de ${inst.total} parcelas (${Math.round((inst.current / inst.total) * 100)}%)`,
                monthlyAmount: inst.amount,
                remainingTotal: remainingCount * inst.amount,
                isCompleted
            })
        })

        // Financings
        financings.forEach(fin => {
            const isCompleted = fin.paidInstallments >= fin.totalInstallments
            const remainingCount = Math.max(0, fin.totalInstallments - fin.paidInstallments)
            const typeNames = { car: 'Veículo', housing: 'Imóvel', loan: 'Empréstimo Bancário', other: 'Outros' }
            list.push({
                id: `fin_${fin.id}`,
                name: fin.name,
                type: 'financing',
                typeLabel: '🚗 Financiamento',
                typeColor: '#f59e0b',
                origin: typeNames[fin.type] || 'Financiamento',
                progressText: `${fin.paidInstallments} de ${fin.totalInstallments} parcelas (${Math.round((fin.paidInstallments / fin.totalInstallments) * 100)}%)`,
                monthlyAmount: fin.monthlyPayment,
                remainingTotal: remainingCount * fin.monthlyPayment,
                isCompleted
            })
        })

        return list
    }, [subscriptions, activeInstallments, financings, cards])

    if (session === undefined) return null;

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />

                <main className="main-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
                        <header className="top-header fade-up" style={{ flex: 1, margin: 0 }}>
                            <div>
                                <h2 className="page-title">💳 Crédito & Dívidas</h2>
                                <p className="page-subtitle">Gerencie cartões de crédito, faturas, financiamentos e empréstimos.</p>
                            </div>
                        </header>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {activeTab === 'cards' && (
                                <button className="btn-primary" onClick={() => { cancelEditCard(); setIsAddingCard(true); }}>
                                    <span className="icon">💳</span> Adicionar Cartão
                                </button>
                            )}
                            {activeTab === 'financings' && (
                                <button className="btn-primary" onClick={() => setIsAddingFinancing(!isAddingFinancing)}>
                                    <span className="icon">🚗</span> {isAddingFinancing ? 'Cancelar' : '+ Novo Financiamento'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="fade-up" style={{ display: 'flex', gap: 12, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12, flexWrap: 'wrap' }}>
                        <button
                            onClick={() => setActiveTab('cards')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 10,
                                border: 'none',
                                background: activeTab === 'cards' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>💳</span> Cartões de Crédito ({cards.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('financings')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 10,
                                border: 'none',
                                background: activeTab === 'financings' ? '#3b82f6' : 'rgba(255,255,255,0.05)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>🚗</span> Financiamentos & Empréstimos ({financings.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('calendar')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 10,
                                border: 'none',
                                background: activeTab === 'calendar' ? '#8b5cf6' : 'rgba(255,255,255,0.05)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>📅</span> Calendário de Vencimentos
                        </button>
                        <button
                            onClick={() => setActiveTab('summary')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 10,
                                border: 'none',
                                background: activeTab === 'summary' ? '#10b981' : 'rgba(255,255,255,0.05)',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s'
                            }}
                        >
                            <span>📋</span> Resumo de Contas Fixas ({allFixedItems.length})
                        </button>
                    </div>

                    {/* TAB: CALENDAR */}
                    {activeTab === 'calendar' && (
                        <FinancialCalendar
                            mode="payables"
                            cards={cards}
                            financings={financings}
                            subscriptions={subscriptions}
                            transactions={transactions}
                            onPayFinancing={handlePayFinancingInstallment}
                            onPayCardInvoice={handlePayInvoice}
                        />
                    )}

                    {/* TAB 1: CREDIT CARDS */}
                    {activeTab === 'cards' && (
                        <>
                            {isAddingCard && (
                                <div className="glass-panel fade-up" style={{ padding: 24, marginBottom: 24, border: '1px solid rgba(139,92,246,0.3)' }}>
                                    <h3 style={{ marginBottom: 16 }}>{editingCardId ? 'Editar Cartão' : 'Novo Cartão de Crédito'}</h3>
                                    <form onSubmit={handleAddCard} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
                                        <div className="tx-field">
                                            <label>Nome do Cartão</label>
                                            <input type="text" value={newCard.name} onChange={e => setNewCard({...newCard, name: e.target.value})} required />
                                        </div>
                                        <div className="tx-field">
                                            <label>Limite (R$)</label>
                                            <input type="number" value={newCard.limit} onChange={e => setNewCard({...newCard, limit: e.target.value})} min="0" step="0.01" required />
                                        </div>
                                        <div className="tx-field">
                                            <label>Bandeira</label>
                                            <select value={newCard.brand} onChange={e => setNewCard({...newCard, brand: e.target.value})}>
                                                <option value="Mastercard">Mastercard</option>
                                                <option value="Visa">Visa</option>
                                                <option value="Elo">Elo</option>
                                                <option value="Amex">American Express</option>
                                            </select>
                                        </div>
                                        <div className="tx-field">
                                            <label>Dia de Fechamento</label>
                                            <input type="number" value={newCard.closingDay} onChange={e => setNewCard({...newCard, closingDay: e.target.value})} min="1" max="31" required />
                                        </div>
                                        <div className="tx-field">
                                            <label>Dia de Vencimento</label>
                                            <input type="number" value={newCard.dueDay} onChange={e => setNewCard({...newCard, dueDay: e.target.value})} min="1" max="31" required />
                                        </div>
                                        <div className="tx-field">
                                            <label>Cor do Cartão</label>
                                            <input type="color" value={newCard.color} onChange={e => setNewCard({...newCard, color: e.target.value})} style={{ height: 42, width: '100%', padding: 2, cursor: 'pointer' }} />
                                        </div>
                                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                                            <button type="button" onClick={cancelEditCard} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
                                            <button type="submit" className="btn-primary" style={{ padding: '10px 20px' }}>Salvar Cartão</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Cards Grid */}
                            <section className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24, marginBottom: 32 }}>
                                {cards.length === 0 && !loadingCards && (
                                    <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                                        <div style={{ fontSize: 'clamp(28px, 6vw, 40px)', marginBottom: 12 }}>💳</div>
                                        Nenhum cartão cadastrado.
                                    </div>
                                )}
                                {cards.map(card => {
                                    const invoicesBreakdown = getCardInvoiceBreakdown(cardTxs, card, new Date())
                                    const invoiceAmount = invoicesBreakdown.reduce((sum, inv) => sum + inv.remaining, 0)

                                    return (
                                        <CreditCardItem
                                            key={card.id}
                                            card={card}
                                            invoiceAmount={invoiceAmount}
                                            invoicesBreakdown={invoicesBreakdown}
                                            onEdit={handleEditCardClick}
                                            onRemove={removeCard}
                                            onPayInvoice={handlePayInvoice}
                                        />
                                    )
                                })}
                            </section>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
                                {/* Subscriptions */}
                                <div className="glass-panel fade-up delay-2" style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 440, justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                                        <div className="section-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 20, margin: 0 }}>
                                                <span style={{ color: '#8b5cf6', fontSize: 26 }}>🔁</span> Minhas Assinaturas
                                            </h3>
                                            <button 
                                                onClick={() => setIsAddingSub(!isAddingSub)}
                                                style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                {isAddingSub ? 'Cancelar' : '+ Nova Assinatura'}
                                            </button>
                                        </div>

                                        {/* Inline Add Subscription Form */}
                                        {isAddingSub && (
                                            <form onSubmit={handleAddSubSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(139,92,246,0.3)', flexShrink: 0 }}>
                                                <div className="tx-field">
                                                    <label>Nome da Assinatura</label>
                                                    <input type="text" value={newSub.desc} onChange={e => setNewSub({...newSub, desc: e.target.value})} required />
                                                </div>
                                                <div className="tx-field">
                                                    <label>Valor Mensal (R$)</label>
                                                    <input type="number" step="0.01" min="0" value={newSub.amount} onChange={e => setNewSub({...newSub, amount: e.target.value})} required />
                                                </div>
                                                <div className="tx-field">
                                                    <label>Cartão de Crédito</label>
                                                    <select value={newSub.cardId} onChange={e => setNewSub({...newSub, cardId: e.target.value})} required>
                                                        <option value="">Selecione o cartão...</option>
                                                        {cards.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="tx-field">
                                                    <label>Primeira Cobrança</label>
                                                    <select value={newSub.billingPeriod} onChange={e => handleSubPeriodChange(e.target.value)}>
                                                        <option value="current">📅 Fatura Deste Mês (Atual)</option>
                                                        <option value="next">📆 Próxima Fatura (Mês Que Vem)</option>
                                                    </select>
                                                </div>
                                                <div className="tx-field">
                                                    <label>Data da Cobrança</label>
                                                    <input type="date" value={newSub.date} onChange={e => setNewSub({...newSub, date: e.target.value})} required />
                                                </div>
                                                <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>
                                                    Salvar Assinatura
                                                </button>
                                            </form>
                                        )}

                                        <div data-lenis-prevent style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
                                            {subscriptions.length === 0 ? (
                                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Nenhuma assinatura no cartão.</p>
                                            ) : subscriptions.map(sub => (
                                                <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                                                    <div>
                                                        <div style={{ fontWeight: 500 }}>{sub.desc}</div>
                                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                                                            Cartão: {cards.find(c => String(c.id) === String(sub.creditCardId))?.name || 'Não vinculado'} • Data: {formatDate(sub.date)}
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                        <div style={{ fontWeight: 600, color: 'var(--danger-color)' }}>- {formatCurrency(sub.amount)} /mês</div>
                                                        <button onClick={() => { if(confirm(`Remover assinatura "${sub.desc}"?`)) removeTx(sub.id) }} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.6 }} title="Remover Assinatura">✖</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Total Subscriptions Summary */}
                                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Total em Assinaturas</span>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--danger-color)' }}>- {formatCurrency(totalSubscriptionAmount)} /mês</span>
                                    </div>
                                </div>

                                {/* Installments */}
                                <div className="glass-panel fade-up delay-2" style={{ padding: 24, display: 'flex', flexDirection: 'column', height: 440, justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                                        <div className="section-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 20, margin: 0 }}>
                                                <span style={{ color: '#3b82f6', fontSize: 26 }}>⏳</span> Compras Parceladas no Cartão
                                            </h3>
                                            <button 
                                                onClick={() => setIsAddingInstallment(!isAddingInstallment)}
                                                style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                {isAddingInstallment ? 'Cancelar' : '+ Nova Compra Parcelada'}
                                            </button>
                                        </div>

                                        {/* Inline Add Installment Purchase Form */}
                                        {isAddingInstallment && (
                                            <form onSubmit={handleAddInstallmentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16, background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px solid rgba(59,130,246,0.3)', flexShrink: 0 }}>
                                                <div className="tx-field">
                                                    <label>Descrição da Compra</label>
                                                    <input type="text" value={newInstallment.desc} onChange={e => setNewInstallment({...newInstallment, desc: e.target.value})} required />
                                                </div>
                                                <div className="tx-field">
                                                    <label>Valor de Cada Parcela (R$)</label>
                                                    <input type="number" step="0.01" min="0" value={newInstallment.amount} onChange={e => setNewInstallment({...newInstallment, amount: e.target.value})} required />
                                                </div>
                                                <div className="tx-field">
                                                    <label>Total de Parcelas</label>
                                                    <input type="number" min="2" max="60" value={newInstallment.total} onChange={e => setNewInstallment({...newInstallment, total: e.target.value})} required />
                                                </div>
                                                <div className="tx-field">
                                                    <label>Parcelas Já Pagas (Antigas)</label>
                                                    <input type="number" min="0" max={newInstallment.total || 60} value={newInstallment.paidCount} onChange={e => setNewInstallment({...newInstallment, paidCount: e.target.value})} />
                                                </div>
                                                <div className="tx-field">
                                                    <label>Próxima Cobrança na Fatura</label>
                                                    <select value={newInstallment.billingPeriod} onChange={e => setNewInstallment({...newInstallment, billingPeriod: e.target.value})}>
                                                        <option value="current">📅 Fatura Deste Mês (Atual)</option>
                                                        <option value="next">📆 Próxima Fatura (Mês Que Vem)</option>
                                                    </select>
                                                </div>
                                                <div className="tx-field">
                                                    <label>Cartão de Crédito</label>
                                                    <select value={newInstallment.cardId} onChange={e => setNewInstallment({...newInstallment, cardId: e.target.value})} required>
                                                        <option value="">Selecione o cartão...</option>
                                                        {cards.map(c => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, background: '#3b82f6' }}>
                                                    Salvar Compra Parcelada
                                                </button>
                                            </form>
                                        )}

                                        <div data-lenis-prevent style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingRight: 4 }}>
                                            {activeInstallments.length === 0 ? (
                                                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Nenhuma compra parcelada.</p>
                                            ) : activeInstallments.map((inst, i) => {
                                                const progress = Math.min((inst.current / inst.total) * 100, 100)
                                                return (
                                                    <div key={i} style={{ padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                            <div>
                                                                <div style={{ fontWeight: 500 }}>{inst.name}</div>
                                                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{formatCurrency(inst.amount)} por parcela</div>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                                                                    {inst.current} de {inst.total}
                                                                </div>
                                                                <button 
                                                                    onClick={() => handleRemoveInstallmentGroup(inst)} 
                                                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.6, fontSize: 14 }} 
                                                                    title="Apagar Compra Parcelada"
                                                                >
                                                                    ✖
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                                                            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-primary)', borderRadius: 3, transition: 'width 0.5s' }} />
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Total Installments Summary */}
                                    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                                        <div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>Total de Parcelas (Mensal)</div>
                                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Saldo a pagar: {formatCurrency(totalInstallmentRemaining)}</div>
                                        </div>
                                        <span style={{ fontSize: 16, fontWeight: 700, color: '#60a5fa' }}>{formatCurrency(totalInstallmentMonthly)} /mês</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* TAB 2: FINANCINGS & LOANS */}
                    {activeTab === 'financings' && (
                        <>
                            {/* Summary Metrics */}
                            <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 24 }}>
                                <div className="card glass-panel" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(239,68,68,0.3)' }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
                                        Saldo Devedor Restante
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: '#ef4444' }}>
                                        {formatCurrency(totalFinancingRemainingDebt)}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                                        Soma de todas as parcelas restantes
                                    </div>
                                </div>

                                <div className="card glass-panel" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(16,185,129,0.3)' }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
                                        Total Já Amortizado / Pago
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>
                                        {formatCurrency(totalFinancingPaid)}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                                        Valor total já quitado
                                    </div>
                                </div>
                            </div>

                            {/* Add Financing Form */}
                            {isAddingFinancing && (
                                <div className="glass-panel fade-up" style={{ padding: 24, marginBottom: 24, border: '1px solid rgba(59,130,246,0.3)' }}>
                                    <h3 style={{ marginBottom: 16 }}>Novo Financiamento ou Empréstimo</h3>
                                    <form onSubmit={handleAddFinancingSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'end' }}>
                                        <div className="tx-field">
                                            <label>Tipo</label>
                                            <select value={newFinancing.type} onChange={e => setNewFinancing({...newFinancing, type: e.target.value})}>
                                                <option value="car">🚗 Veículo (Carro / Moto)</option>
                                                <option value="housing">🏠 Imóvel (Casa / Apto)</option>
                                                <option value="loan">🏦 Empréstimo Bancário</option>
                                                <option value="other">💳 Outros Financiamentos</option>
                                            </select>
                                        </div>

                                        <div className="tx-field">
                                            <label>Nome</label>
                                            <input type="text" value={newFinancing.name} onChange={e => setNewFinancing({...newFinancing, name: e.target.value})} required />
                                        </div>

                                        <div className="tx-field">
                                            <label>Valor da Parcela (R$)</label>
                                            <input type="number" step="0.01" min="0" value={newFinancing.monthlyPayment} onChange={e => setNewFinancing({...newFinancing, monthlyPayment: e.target.value})} required />
                                        </div>

                                        <div className="tx-field">
                                            <label>Total de Parcelas</label>
                                            <input type="number" min="1" max="600" value={newFinancing.totalInstallments} onChange={e => setNewFinancing({...newFinancing, totalInstallments: e.target.value})} required />
                                        </div>

                                        <div className="tx-field">
                                            <label>Parcelas Já Pagas</label>
                                            <input type="number" min="0" max={newFinancing.totalInstallments || 600} value={newFinancing.paidInstallments} onChange={e => setNewFinancing({...newFinancing, paidInstallments: e.target.value})} />
                                        </div>

                                        <div className="tx-field">
                                            <label>Dia do Vencimento</label>
                                            <input type="number" min="1" max="31" value={newFinancing.dueDay} onChange={e => setNewFinancing({...newFinancing, dueDay: e.target.value})} required />
                                        </div>

                                        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 12 }}>
                                            <button type="button" onClick={() => setIsAddingFinancing(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
                                            <button type="submit" className="btn-primary" style={{ padding: '10px 20px', background: '#3b82f6' }}>Salvar Financiamento</button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Financings List */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
                                {financings.length === 0 && !isAddingFinancing ? (
                                    <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                                        <div style={{ fontSize: 'clamp(28px, 6vw, 40px)', marginBottom: 12 }}>🚗</div>
                                        Nenhum financiamento ou empréstimo cadastrado. Clique em "+ Novo Financiamento" para adicionar!
                                    </div>
                                ) : financings.map(f => {
                                    const remainingInstallments = Math.max(0, f.totalInstallments - f.paidInstallments);
                                    const totalPaidAmount = f.paidInstallments * f.monthlyPayment;
                                    const remainingDebt = remainingInstallments * f.monthlyPayment;
                                    const progressPct = Math.min(100, Math.max(0, (f.paidInstallments / f.totalInstallments) * 100));
                                    const isPaidOff = remainingInstallments === 0;

                                    const icon = f.type === 'car' ? '🚗' : f.type === 'housing' ? '🏠' : f.type === 'loan' ? '🏦' : '💳';

                                    return (
                                        <div key={f.id} className="card glass-panel fade-up" style={{ padding: 24, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                            <button 
                                                onClick={() => { if (confirm(`Remover financiamento "${f.name}"?`)) removeFinancing(f.id); }}
                                                style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.5 }}
                                                title="Remover Financiamento"
                                            >
                                                ✖
                                            </button>

                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                                                        {icon}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 18, color: 'white' }}>{f.name}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                            Vencimento todo dia {f.dueDay}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                <div style={{ marginBottom: 16 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Progresso de Quitação</span>
                                                        <span style={{ fontWeight: 700, color: isPaidOff ? '#10b981' : '#60a5fa' }}>
                                                            {f.paidInstallments} de {f.totalInstallments} ({progressPct.toFixed(1)}%)
                                                        </span>
                                                    </div>
                                                    <div style={{ height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${progressPct}%`, background: isPaidOff ? '#10b981' : 'linear-gradient(90deg, #3b82f6, #10b981)', borderRadius: 5, transition: 'width 0.6s ease' }} />
                                                    </div>
                                                </div>

                                                {/* Metrics breakdown */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 14, borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 16 }}>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Valor da Parcela</div>
                                                        <div style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>{formatCurrency(f.monthlyPayment)}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Saldo Restante</div>
                                                        <div style={{ fontSize: 15, fontWeight: 700, color: isPaidOff ? '#10b981' : '#ef4444' }}>{formatCurrency(remainingDebt)}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Parcelas Restantes</div>
                                                        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{remainingInstallments} parcelas</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Total Já Pago</div>
                                                        <div style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>{formatCurrency(totalPaidAmount)}</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Pay Action Button */}
                                            <div>
                                                {isPaidOff ? (
                                                    <div style={{ padding: '10px', textAlign: 'center', background: 'rgba(16,185,129,0.15)', color: '#10b981', borderRadius: 10, fontWeight: 700, fontSize: 14 }}>
                                                        🎉 Financiamento 100% Quitado!
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => handlePayFinancingInstallment(f)}
                                                        className="btn-primary"
                                                        style={{ width: '100%', padding: '11px', background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14 }}
                                                    >
                                                        <span>✅</span> Dar Baixa na Parcela ({f.paidInstallments + 1}/{f.totalInstallments})
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </>
                    )}

                    {/* TAB 3: UNIFIED FIXED EXPENSES & DEBT SUMMARY */}
                    {activeTab === 'summary' && (
                        <>
                            {/* Top Summary Metric Banner */}
                            <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, marginBottom: 24 }}>
                                {/* Total Monthly Fixed Commitments */}
                                <div className="card glass-panel" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(0,0,0,0.3) 100%)', border: '1px solid rgba(16,185,129,0.4)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
                                        Total Contas Fixas / Mês
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>
                                        {formatCurrency(totalFixedMonthly)}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                                        Soma de todos os compromissos mensais
                                    </div>
                                </div>

                                {/* Subscriptions */}
                                <div className="card glass-panel" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(139,92,246,0.3)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
                                        Assinaturas ({subscriptions.length})
                                    </div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: '#a78bfa' }}>
                                        {formatCurrency(totalSubscriptionAmount)} /mês
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                                        Cobranças mensais recorrentes
                                    </div>
                                </div>

                                {/* Card Installments */}
                                <div className="card glass-panel" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(59,130,246,0.3)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
                                        Parcelas no Cartão ({activeInstallments.length})
                                    </div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: '#60a5fa' }}>
                                        {formatCurrency(totalInstallmentMonthly)} /mês
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                                        Saldo total: {formatCurrency(totalInstallmentRemaining)}
                                    </div>
                                </div>

                                {/* Financings */}
                                <div className="card glass-panel" style={{ padding: 20, background: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(245,158,11,0.3)' }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 6 }}>
                                        Financiamentos ({financings.length})
                                    </div>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: '#fbbf24' }}>
                                        {formatCurrency(totalFinancingMonthly)} /mês
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                                        Saldo total: {formatCurrency(totalFinancingRemainingDebt)}
                                    </div>
                                </div>
                            </div>

                            {/* Unified Table of All Fixed Commitments */}
                            <div className="glass-panel fade-up delay-2" style={{ padding: 24 }}>
                                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <h3 style={{ fontSize: 20, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{ fontSize: 24 }}>📋</span> Todas as Contas Fixas & Dívidas ({allFixedItems.length})
                                    </h3>
                                </div>

                                {allFixedItems.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.4)' }}>
                                        <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
                                        Nenhuma conta fixa, assinatura ou financiamento cadastrado no momento.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {allFixedItems.map(item => (
                                            <div 
                                                key={item.id} 
                                                style={{ 
                                                    display: 'flex', 
                                                    justify: 'space-between', 
                                                    alignItems: 'center', 
                                                    padding: 16, 
                                                    background: 'rgba(255,255,255,0.03)', 
                                                    borderRadius: 12, 
                                                    border: '1px solid rgba(255,255,255,0.06)',
                                                    flexWrap: 'wrap',
                                                    gap: 12
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 240 }}>
                                                    <span 
                                                        style={{ 
                                                            padding: '6px 12px', 
                                                            borderRadius: 20, 
                                                            fontSize: 12, 
                                                            fontWeight: 700, 
                                                            background: `${item.typeColor}20`, 
                                                            color: item.typeColor,
                                                            border: `1px solid ${item.typeColor}40`
                                                        }}
                                                    >
                                                        {item.typeLabel}
                                                    </span>
                                                    <div>
                                                        <div style={{ fontWeight: 600, fontSize: 16, color: 'white' }}>{item.name}</div>
                                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{item.origin}</div>
                                                    </div>
                                                </div>

                                                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', textAlign: 'right' }}>
                                                    <div style={{ fontWeight: 500 }}>{item.progressText}</div>
                                                    {item.remainingTotal != null && (
                                                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                                            Falta pagar: {formatCurrency(item.remainingTotal)}
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ textAlign: 'right', minWidth: 120 }}>
                                                    <div style={{ fontSize: 18, fontWeight: 800, color: item.type === 'subscription' ? 'var(--danger-color)' : 'white' }}>
                                                        {formatCurrency(item.monthlyAmount)}
                                                    </div>
                                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>por mês</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    )
}
