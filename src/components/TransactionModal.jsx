"use client";

import { useState, useEffect } from 'react'
import { CATEGORY_MAP, ACCOUNTS } from '../helpers'
import { useSession } from '../hooks/useSession'
import { useCreditCards } from '../hooks/useCards'

export default function TransactionModal({ isOpen, onClose, onSave, editTx }) {
    const session = useSession()
    const { cards } = useCreditCards(session?.email)

    const [type, setType] = useState('expense')
    const [desc, setDesc] = useState('')
    const [amount, setAmount] = useState('')
    const [category, setCategory] = useState('')
    const [account, setAccount] = useState('cash')
    const [date, setDate] = useState(new Date().toISOString().split('T')[0])
    const [note, setNote] = useState('')
    
    // Novas opções de cartão
    const [creditCardId, setCreditCardId] = useState('')
    const [cardPurchaseType, setCardPurchaseType] = useState('normal') // normal, subscription, installment
    const [installmentTotal, setInstallmentTotal] = useState('')
    
    const [isRecurring, setIsRecurring] = useState(false)
    const [recurringDuration, setRecurringDuration] = useState('')
    
    const [errors, setErrors] = useState([])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (editTx) {
            setType(editTx.type)
            setDesc(editTx.desc)
            setAmount(editTx.amount)
            setCategory(editTx.category)
            setAccount(editTx.account || 'cash')
            setDate(editTx.date)
            setNote(editTx.note || '')
            setIsRecurring(editTx.isRecurring || false)
            setRecurringDuration(editTx.recurringDuration || '')
            setCreditCardId(editTx.creditCardId || '')
            if (editTx.isSubscription) setCardPurchaseType('subscription')
            else if (editTx.installmentTotal > 1) setCardPurchaseType('installment')
            else setCardPurchaseType('normal')
            setInstallmentTotal(editTx.installmentTotal || '')
        } else {
            resetForm()
        }
    }, [editTx, isOpen])

    // Update category when type changes
    useEffect(() => {
        const cats = CATEGORY_MAP[type]
        if (cats && cats.length > 0 && !cats.find(c => c.id === category)) {
            setCategory(cats[0].id)
        }
    }, [type, category])

    // Se selecionou cartão de crédito, e tem cartões, seleciona o primeiro por padrão
    useEffect(() => {
        if (account === 'credit' && cards.length > 0 && !creditCardId) {
            setCreditCardId(cards[0].id)
        }
    }, [account, cards, creditCardId])

    function resetForm() {
        setType('expense')
        setDesc('')
        setAmount('')
        setCategory(CATEGORY_MAP.expense[0].id)
        setAccount('cash')
        setDate(new Date().toISOString().split('T')[0])
        setNote('')
        setIsRecurring(false)
        setRecurringDuration('')
        setCreditCardId('')
        setCardPurchaseType('normal')
        setInstallmentTotal('')
        setErrors([])
    }

    function validate() {
        const errs = []
        if (!desc || desc.trim().length < 2) errs.push('A descrição deve ter pelo menos 2 caracteres.')
        if (!amount || isNaN(amount) || Number(amount) <= 0) errs.push('Informe um valor maior que zero.')
        if (!['income', 'expense', 'investment'].includes(type)) errs.push('Tipo inválido.')
        if (!category) errs.push('Selecione uma categoria.')
        if (!account) errs.push('Selecione uma conta.')
        if (account === 'credit' && !creditCardId) errs.push('Selecione o cartão de crédito utilizado.')
        if (account === 'credit' && cardPurchaseType === 'installment' && (!installmentTotal || installmentTotal < 2)) errs.push('Informe a quantidade de parcelas (mínimo 2).')
        if (!date) errs.push('Informe a data.')
        return errs
    }

    async function handleSubmit(e) {
        e.preventDefault()
        const errs = validate()
        if (errs.length) { setErrors(errs); return }
        setErrors([])
        setSaving(true)

        try {
            await onSave({
                desc: desc.trim(),
                amount: parseFloat(amount),
                type,
                category,
                account,
                date,
                note: note.trim(),
                isRecurring: account !== 'credit' && isRecurring,
                recurringDuration: account !== 'credit' && isRecurring && recurringDuration ? parseInt(recurringDuration) : null,
                creditCardId: (account === 'credit' || category === 'invoice_payment') ? creditCardId : null,
                isSubscription: account === 'credit' && cardPurchaseType === 'subscription',
                installmentTotal: account === 'credit' && cardPurchaseType === 'installment' ? parseInt(installmentTotal) : null
            }, editTx?.id)
            onClose()
            resetForm()
        } catch (err) {
            setErrors([err.message || 'Erro ao salvar.'])
        }
        setSaving(false)
    }

    if (!isOpen) return null

    const cats = CATEGORY_MAP[type] || []

    return (
        <div
            id="tx-modal-new"
            style={{ position: 'fixed', inset: 0, zIndex: 8000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', fontFamily: "'Outfit',sans-serif", color: 'white', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
                        {editTx ? '✏️ Editar Transação' : '➕ Nova Transação'}
                    </h3>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'rgba(255,255,255,0.6)', cursor: 'pointer', width: 32, height: 32, fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>

                {/* Type selector */}
                <div className="tx-type-row">
                    {['expense', 'income', 'investment'].map(t => (
                        <button
                            key={t}
                            type="button"
                            className={`tx-type-btn${type === t ? ` active-${t}` : ''}`}
                            onClick={() => setType(t)}
                        >
                            {t === 'expense' ? '📤 Gasto' : t === 'income' ? '📥 Receita' : '📈 Invest.'}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Errors */}
                    {errors.length > 0 && (
                        <div className="tx-form-errors">
                            {errors.map((err, i) => <div key={i} className="tx-error-item">⚠️ {err}</div>)}
                        </div>
                    )}

                    <div className="tx-form-grid">
                        {/* Descrição */}
                        <div className="tx-field tx-form-full">
                            <label>Descrição</label>
                            <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Ex: Aluguel, Supermercado..." required />
                        </div>

                        {/* Valor */}
                        <div className="tx-field">
                            <label>Valor (R$)</label>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" min="0.01" step="0.01" required />
                        </div>

                        {/* Data */}
                        <div className="tx-field">
                            <label>Data</label>
                            <input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                        </div>

                        {/* Categoria */}
                        <div className="tx-field">
                            <label>Categoria</label>
                            <select value={category} onChange={e => setCategory(e.target.value)}>
                                {cats.map(c => (
                                    <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Conta */}
                        <div className="tx-field">
                            <label>Conta/Forma de Pagamento</label>
                            <select value={account} onChange={e => setAccount(e.target.value)}>
                                {ACCOUNTS.map(a => (
                                    <option key={a.id} value={a.id}>{a.icon} {a.label}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Lógica Específica Cartão de Crédito */}
                        {account === 'credit' && (
                            <div className="tx-field tx-form-full" style={{ padding: 16, background: 'rgba(59,130,246,0.1)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.2)' }}>
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ color: '#93c5fd' }}>Qual Cartão?</label>
                                    <select value={creditCardId} onChange={e => setCreditCardId(e.target.value)} style={{ borderColor: 'rgba(59,130,246,0.3)' }} required>
                                        <option value="" disabled>Selecione um cartão...</option>
                                        {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div style={{ marginBottom: 12 }}>
                                    <label style={{ color: '#93c5fd' }}>Tipo de Cobrança no Cartão</label>
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        {['normal', 'subscription', 'installment'].map(t => (
                                            <button 
                                                key={t}
                                                type="button" 
                                                onClick={() => setCardPurchaseType(t)}
                                                style={{ flex: 1, padding: '8px 4px', fontSize: 12, borderRadius: 6, border: '1px solid', borderColor: cardPurchaseType === t ? '#3b82f6' : 'rgba(255,255,255,0.1)', background: cardPurchaseType === t ? 'rgba(59,130,246,0.2)' : 'transparent', color: 'white', cursor: 'pointer' }}
                                            >
                                                {t === 'normal' ? 'Avulsa' : t === 'subscription' ? 'Assinatura' : 'Parcelado'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {cardPurchaseType === 'installment' && (
                                    <div>
                                        <label style={{ color: '#93c5fd' }}>Quantidade de Parcelas</label>
                                        <input type="number" value={installmentTotal} onChange={e => setInstallmentTotal(e.target.value)} placeholder="Ex: 12" min="2" style={{ borderColor: 'rgba(59,130,246,0.3)' }} required />
                                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, display: 'block' }}>O valor lá de cima (R$) deve ser o valor de CADA parcela.</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Observação */}
                        <div className="tx-field tx-form-full">
                            <label>Observação (opcional)</label>
                            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Notas adicionais..." />
                        </div>

                        {/* Recorrência Antiga (só pra contas normais) */}
                        {account !== 'credit' && (
                            <>
                                <div className="tx-field tx-form-full" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.03)', padding: 12, borderRadius: 10 }}>
                                    <input
                                        type="checkbox"
                                        id="tx-recurring"
                                        checked={isRecurring}
                                        onChange={e => setIsRecurring(e.target.checked)}
                                        style={{ width: 18, height: 18, cursor: 'pointer' }}
                                    />
                                    <label htmlFor="tx-recurring" style={{ cursor: 'pointer', textTransform: 'none', fontSize: 14, color: 'var(--text-secondary)', letterSpacing: 0 }}>
                                        🔁 Transação recorrente (mensal)
                                    </label>
                                </div>

                                {isRecurring && (
                                    <div className="tx-field tx-form-full">
                                        <label>Duração (meses, deixe vazio para indefinido)</label>
                                        <input type="number" value={recurringDuration} onChange={e => setRecurringDuration(e.target.value)} placeholder="Ex: 12 (para 1 ano)" min="1" />
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <button type="submit" className="tx-submit-btn" disabled={saving}>
                        {saving ? '⏳ Salvando...' : editTx ? 'Salvar Alterações' : 'Salvar Transação'}
                    </button>
                </form>
            </div>
        </div>
    )
}
