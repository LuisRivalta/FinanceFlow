"use client";

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import { useSession } from '../../hooks/useSession'
import { supabase } from '../../lib/supabase'
import { formatCurrency, mapFromDB, CATEGORY_MAP } from '../../helpers'

export default function RoadmapPage() {
    const session = useSession()
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [transactions, setTransactions] = useState([])
    const [budgets, setBudgets] = useState({})
    const [isEditing, setIsEditing] = useState(false)
    const [editState, setEditState] = useState({})
    const [aiLoading, setAiLoading] = useState(false)
    const [aiAdvice, setAiAdvice] = useState(null)

    useEffect(() => {
        if (session === undefined) return
        if (!session) { router.push('/login'); return }
        loadData()
    }, [session])

    async function loadData() {
        setLoading(true)
        // 1. Load current month's transactions
        const d = new Date()
        const firstDay = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
        
        const { data: txs } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_email', session.email)
            .gte('date', firstDay)
            .lte('date', lastDay)
        
        if (txs) setTransactions(txs.map(mapFromDB))

        // 2. Load budgets (fail silently if table doesn't exist yet)
        const { data: bgts } = await supabase
            .from('budgets')
            .select('*')
            .eq('user_email', session.email)
            .catch(() => ({ data: [] }))
        
        const bmap = {}
        if (bgts) bgts.forEach(b => bmap[b.category_id] = b)
        setBudgets(bmap)
        setEditState(bmap)
        setLoading(false)
    }

    const { totalIncome, spentByCategory, totalSpent } = useMemo(() => {
        let inc = 0
        let spc = {}
        let exp = 0
        transactions.forEach(t => {
            if (t.type === 'income') inc += t.amount
            if (t.type === 'expense' && t.category !== 'invoice_payment') {
                spc[t.category] = (spc[t.category] || 0) + t.amount
                exp += t.amount
            }
        })
        return { totalIncome: inc, spentByCategory: spc, totalSpent: exp }
    }, [transactions])

    async function saveBudgets() {
        setLoading(true)
        const toUpsert = []
        for (const catId of Object.keys(editState)) {
            const b = editState[catId]
            if (b.limit_percentage > 0 || b.limit_amount > 0) {
                toUpsert.push({
                    id: budgets[catId]?.id,
                    user_email: session.email,
                    category_id: catId,
                    limit_percentage: b.limit_percentage || null,
                    limit_amount: b.limit_amount || null
                })
            }
        }
        if (toUpsert.length > 0) {
            await supabase.from('budgets').upsert(toUpsert)
        }
        await loadData()
        setIsEditing(false)
    }

    async function askAI() {
        setAiLoading(true)
        setAiAdvice(null)
        
        const payload = {
            income: totalIncome,
            budgets: CATEGORY_MAP.expense.filter(c => c.id !== 'invoice_payment').map(cat => {
                const bgt = budgets[cat.id]
                const limitAmt = bgt?.limit_percentage 
                    ? (bgt.limit_percentage / 100) * totalIncome 
                    : (bgt?.limit_amount || 0)
                return limitAmt > 0 ? { label: cat.label, limit: formatCurrency(limitAmt) } : null
            }).filter(Boolean),
            expenses: CATEGORY_MAP.expense.filter(c => c.id !== 'invoice_payment').map(cat => {
                const spent = spentByCategory[cat.id] || 0
                return spent > 0 ? { label: cat.label, spent: formatCurrency(spent) } : null
            }).filter(Boolean)
        }

        try {
            const res = await fetch('/api/ai-roadmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            })
            const data = await res.json()
            if (data.advice) {
                setAiAdvice(data.advice)
            } else {
                setAiAdvice("❌ Erro: " + (data.error || "Tente novamente mais tarde. (Verifique se adicionou a GEMINI_API_KEY no .env.local)"))
            }
        } catch (e) {
            setAiAdvice("❌ Erro ao conectar com a API.")
        }
        setAiLoading(false)
    }

    if (session === undefined) return null

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                        <div>
                            <h2 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 800 }}>🗺️ Roteiro Financeiro</h2>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Planeje seus gastos e compare com a realidade</p>
                        </div>
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button className="btn btn-secondary" onClick={askAI} disabled={aiLoading} style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid #6366f1', opacity: aiLoading ? 0.5 : 1 }}>
                                {aiLoading ? '🤖 Analisando...' : '🤖 Pedir Análise da IA'}
                            </button>
                            {isEditing ? (
                                <button className="btn btn-primary" onClick={saveBudgets}>💾 Salvar</button>
                            ) : (
                                <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>✏️ Editar Roteiro</button>
                            )}
                        </div>
                    </div>

                    {loading && <p>Carregando...</p>}

                    {aiAdvice && (
                        <div className="card glass-panel fade-up" style={{ padding: 24, marginBottom: 24, border: '1px solid rgba(99,102,241,0.4)', background: 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span>🤖</span> Conselho do seu Assessor IA
                            </h3>
                            <div style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap' }}>
                                {aiAdvice}
                            </div>
                        </div>
                    )}

                    {!loading && (
                        <div className="card glass-panel" style={{ padding: 24 }}>
                            <div style={{ marginBottom: 24 }}>
                                <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Resumo do Mês Atual</h3>
                                <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>Receita Base: {formatCurrency(totalIncome)}</div>
                            </div>

                            <div style={{ display: 'grid', gap: 16 }}>
                                {CATEGORY_MAP.expense.filter(c => c.id !== 'invoice_payment').map(cat => {
                                    const bgt = isEditing ? editState[cat.id] : budgets[cat.id]
                                    const limitAmt = bgt?.limit_percentage 
                                        ? (bgt.limit_percentage / 100) * totalIncome 
                                        : (bgt?.limit_amount || 0)
                                    const spent = spentByCategory[cat.id] || 0
                                    const pctSpent = limitAmt > 0 ? (spent / limitAmt) * 100 : 0
                                    const isOver = spent > limitAmt && limitAmt > 0

                                    return (
                                        <div key={cat.id} style={{ padding: 16, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, background: 'rgba(255,255,255,0.02)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 32, height: 32, borderRadius: 8, background: cat.color + '22', color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {cat.icon}
                                                    </div>
                                                    <div style={{ fontWeight: 600 }}>{cat.label}</div>
                                                </div>
                                                
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <input 
                                                            type="number" 
                                                            placeholder="%"
                                                            value={bgt?.limit_percentage || ''}
                                                            onChange={e => setEditState(s => ({...s, [cat.id]: {...(s[cat.id]||{}), limit_percentage: e.target.value}}))}
                                                            style={{ width: 60, padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                                                        />
                                                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>% da renda ou R$</span>
                                                        <input 
                                                            type="number" 
                                                            placeholder="Valor"
                                                            value={bgt?.limit_amount || ''}
                                                            onChange={e => setEditState(s => ({...s, [cat.id]: {...(s[cat.id]||{}), limit_amount: e.target.value}}))}
                                                            style={{ width: 100, padding: 8, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                                                            Meta: {limitAmt > 0 ? formatCurrency(limitAmt) : 'Não definida'}
                                                            {bgt?.limit_percentage ? ` (${bgt.limit_percentage}%)` : ''}
                                                        </div>
                                                        <div style={{ fontSize: 15, fontWeight: 700, color: isOver ? '#ef4444' : 'white' }}>
                                                            Gasto: {formatCurrency(spent)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {!isEditing && limitAmt > 0 && (
                                                <div style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(100, pctSpent)}%`, height: '100%', background: isOver ? '#ef4444' : cat.color, borderRadius: 3 }} />
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}
