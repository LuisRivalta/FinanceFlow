"use client";

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Sidebar from '../../components/Sidebar'
import { useSession } from '../../hooks/useSession'
import { useCreditCards } from '../../hooks/useCards'
import { useTransactions } from '../../hooks/useTransactions'
import { formatCurrency } from '../../helpers'

const Card3D = dynamic(() => import('../../components/3d/Card3D'), { ssr: false })

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
    const { transactions, load: loadTxs, create: createTx } = useTransactions(session?.email)

    useEffect(() => {
        if (session) {
            loadCards()
            loadTxs()
        }
    }, [session, loadCards, loadTxs])

    const [isAddingCard, setIsAddingCard] = useState(false)
    const [editingCardId, setEditingCardId] = useState(null)
    const [newCard, setNewCard] = useState({ name: '', brand: 'Mastercard', limit: '', closingDay: '', dueDay: '', color: '#8b5cf6' })
    const [selectedCard3D, setSelectedCard3D] = useState(null)

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

    function cancelEdit() {
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
            cancelEdit()
        } catch (err) {
            alert('Erro ao salvar cartão: ' + err.message)
        }
    }

    async function handlePayInvoice(card, invoiceAmount) {
        if (invoiceAmount <= 0) {
            alert('A fatura deste mês já está zerada ou paga.')
            return
        }
        
        const ok = confirm(`Deseja pagar a fatura de ${formatCurrency(invoiceAmount)} do cartão ${card.name}?\nIsso debitará o valor da sua Conta Corrente.`)
        if (!ok) return

        try {
            await createTx({
                desc: `Pagamento Fatura - ${card.name}`,
                amount: invoiceAmount,
                type: 'expense',
                category: 'invoice_payment',
                account: 'checking',
                date: new Date().toISOString().split('T')[0],
                creditCardId: card.id
            })
            alert('Fatura paga com sucesso! O valor foi deduzido da sua Conta Corrente.')
        } catch (err) {
            alert('Erro ao pagar fatura: ' + err.message)
        }
    }

    // Filter transactions
    const cardTxs = useMemo(() => transactions.filter(t => t.creditCardId), [transactions])
    const subscriptions = useMemo(() => cardTxs.filter(t => t.isSubscription), [cardTxs])
    const installments = useMemo(() => cardTxs.filter(t => t.installmentTotal > 1), [cardTxs])

    // Group installments to show progress
    const activeInstallments = useMemo(() => {
        const groups = {}
        installments.forEach(t => {
            // Group by description base (remove (X/Y))
            const baseName = t.desc.replace(/\s\(\d+\/\d+\)$/, '')
            if (!groups[baseName]) {
                groups[baseName] = { name: baseName, total: t.installmentTotal, amount: t.amount, current: 0, cardId: t.creditCardId }
            }
            // Count how many are in the past or current month (simplified assumption for "paid")
            const txDate = new Date(t.date)
            if (txDate <= new Date()) {
                groups[baseName].current++
            }
        })
        return Object.values(groups)
    }, [installments])

    if (session === undefined) return null;

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />

                <main className="main-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <header className="top-header fade-up" style={{ flex: 1 }}>
                            <div>
                                <h2 className="page-title">Meus Cartões</h2>
                                <p className="page-subtitle">Gerencie suas faturas, assinaturas e parcelamentos.</p>
                            </div>
                            <button className="btn-primary" style={{ marginTop: 20 }} onClick={() => { cancelEdit(); setIsAddingCard(true); }}>
                                <span className="icon">💳</span> Adicionar Cartão
                            </button>
                        </header>
                    </div>

                    {isAddingCard && (
                        <div className="glass-panel fade-up" style={{ padding: 24, marginBottom: 24, border: '1px solid rgba(139,92,246,0.3)' }}>
                            <h3 style={{ marginBottom: 16 }}>{editingCardId ? 'Editar Cartão' : 'Novo Cartão de Crédito'}</h3>
                            <form onSubmit={handleAddCard} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, alignItems: 'end' }}>
                                <div className="tx-field">
                                    <label>Nome do Cartão (ex: Nubank)</label>
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
                                    <button type="button" onClick={cancelEdit} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 8, cursor: 'pointer' }}>Cancelar</button>
                                    <button type="submit" className="btn-primary" style={{ padding: '10px 20px' }}>Salvar Cartão</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Cards Grid */}
                    <section className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24, marginBottom: 32 }}>
                        {cards.length === 0 && !loadingCards && (
                            <div className="glass-panel" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
                                <div style={{ fontSize: 40, marginBottom: 12 }}>💳</div>
                                Nenhum cartão cadastrado.
                            </div>
                        )}
                        {cards.map(card => {
                            // Calcula fatura atual (soma de despesas subtraindo os pagamentos)
                            const currentMonth = new Date().getMonth()
                            const invoiceAmount = cardTxs
                                .filter(t => t.creditCardId === card.id && new Date(t.date).getMonth() === currentMonth)
                                .reduce((acc, t) => {
                                    if (t.category === 'invoice_payment') return acc - t.amount
                                    return acc + t.amount
                                }, 0)
                            const available = card.credit_limit - invoiceAmount

                            return (
                                <div key={card.id} className="card glass-panel" style={{ padding: 24, background: 'rgba(0,0,0,0.5)', border: `1px solid ${card.color}55`, position: 'relative', overflow: 'hidden' }}>
                                    <Card3D card={card} />
                                    
                                    {/* Overlay content over the 3D canvas */}
                                    <div style={{ position: 'relative', zIndex: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: 18 }}>{card.name}</h3>
                                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{card.brand}</span>
                                        </div>
                                            <div style={{ display: 'flex', gap: 12, position: 'relative', zIndex: 10 }}>
                                                <button onClick={() => handleEditCardClick(card)} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', padding: 6, borderRadius: 6 }}>✏️</button>
                                                <button onClick={() => removeCard(card.id)} style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 6, borderRadius: 6 }}>🗑️</button>
                                            </div>
                                    </div>
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Fatura Atual</div>
                                        <div style={{ fontSize: 28, fontWeight: 800, color: 'white' }}>{formatCurrency(Math.max(0, invoiceAmount))}</div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.7)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 16, marginBottom: 12 }}>
                                        <div>Vence dia <strong>{card.due_day}</strong></div>
                                        <div>Limite: {formatCurrency(card.credit_limit)}</div>
                                    </div>
                                        <button 
                                            className="btn-primary" 
                                            style={{ width: '100%', padding: '8px 0', fontSize: 13, background: invoiceAmount > 0 ? card.color : 'rgba(255,255,255,0.1)', position: 'relative', zIndex: 10, border: '1px solid rgba(255,255,255,0.2)' }}
                                            onClick={() => handlePayInvoice(card, invoiceAmount)}
                                            disabled={invoiceAmount <= 0}
                                        >
                                            {invoiceAmount > 0 ? '🧾 Pagar Fatura' : '✨ Fatura Paga'}
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </section>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                        {/* Subscriptions */}
                        <div className="glass-panel fade-up delay-2" style={{ padding: 24 }}>
                            <div className="section-header" style={{ marginBottom: 16 }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 20 }}>
                                    <span style={{ color: '#8b5cf6', fontSize: 26 }}>🔁</span> Minhas Assinaturas
                                </h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {subscriptions.length === 0 ? (
                                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Nenhuma assinatura no cartão.</p>
                                ) : subscriptions.map(sub => (
                                    <div key={sub.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'rgba(255,255,255,0.03)', borderRadius: 10 }}>
                                        <div>
                                            <div style={{ fontWeight: 500 }}>{sub.desc}</div>
                                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Cartão: {cards.find(c => c.id === sub.creditCardId)?.name}</div>
                                        </div>
                                        <div style={{ fontWeight: 600, color: 'var(--danger-color)' }}>{formatCurrency(sub.amount)} /mês</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Installments */}
                        <div className="glass-panel fade-up delay-2" style={{ padding: 24 }}>
                            <div className="section-header" style={{ marginBottom: 16 }}>
                                <h3 style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 20 }}>
                                    <span style={{ color: '#3b82f6', fontSize: 26 }}>⏳</span> Compras Parceladas
                                </h3>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
                                                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
                                                    {inst.current} de {inst.total}
                                                </div>
                                            </div>
                                            {/* Progress bar */}
                                            <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                                                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-primary)', borderRadius: 3, transition: 'width 0.5s' }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                </main>
            </div>
            {selectedCard3D && <Card3D card={selectedCard3D} onClose={() => setSelectedCard3D(null)} />}
        </div>
    )
}
