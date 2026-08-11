"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar'
import CategoryIcon from '../../components/CategoryIcon'
import { Map, Bot, Save, Pencil, Banknote, Target, CreditCard, Shield, Zap, AlertTriangle, Check } from 'lucide-react';
import { useSession } from '../../hooks/useSession';
import { supabase } from '../../lib/supabase';
import { formatCurrency, mapFromDB, CATEGORY_MAP } from '../../helpers';

export default function RoadmapPage() {
    const session = useSession();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState([]);
    const [budgets, setBudgets] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [editState, setEditState] = useState({});
    const [aiLoading, setAiLoading] = useState(false);
    const [aiAdvice, setAiAdvice] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');

    // Month Selector State
    const [currentDate, setCurrentDate] = useState(() => new Date());

    useEffect(() => {
        if (session === undefined) return;
        if (!session) { router.push('/login'); return; }
        loadData();
    }, [session, currentDate]);

    async function loadData() {
        setLoading(true);
        const y = currentDate.getFullYear();
        const m = currentDate.getMonth();
        const firstDay = new Date(y, m, 1).toISOString().split('T')[0];
        const lastDay = new Date(y, m + 1, 0).toISOString().split('T')[0];
        
        // 1. Load transactions for selected month
        const { data: txs } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_email', session.email)
            .gte('date', firstDay)
            .lte('date', lastDay);
        
        if (txs) setTransactions(txs.map(mapFromDB));

        // 2. Load budgets from Supabase or localStorage
        let bmap = {};
        try {
            const { data: bgts } = await supabase
                .from('budgets')
                .select('*')
                .eq('user_email', session.email);
            
            if (bgts && bgts.length > 0) {
                bgts.forEach(b => bmap[b.category_id] = b);
            }
        } catch (e) {
            console.warn("Supabase budgets lookup error, falling back to localStorage", e);
        }

        const localSaved = localStorage.getItem(`finance_budgets_${session.email}`);
        if (localSaved && Object.keys(bmap).length === 0) {
            try {
                bmap = JSON.parse(localSaved);
            } catch (err) {}
        }

        setBudgets(bmap);
        setEditState(bmap);
        setLoading(false);
    }

    const monthLabel = useMemo(() => {
        const raw = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    }, [currentDate]);

    const changeMonth = (delta) => {
        setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };

    const { totalIncome, spentByCategory, totalSpent } = useMemo(() => {
        let inc = 0;
        let spc = {};
        let exp = 0;
        transactions.forEach(t => {
            if (t.type === 'income') inc += t.amount;
            if (t.type === 'expense' && t.category !== 'invoice_payment') {
                spc[t.category] = (spc[t.category] || 0) + t.amount;
                exp += t.amount;
            }
        });
        return { totalIncome: inc, spentByCategory: spc, totalSpent: exp };
    }, [transactions]);

    const totalPlannedLimit = useMemo(() => {
        return CATEGORY_MAP.expense.filter(c => c.id !== 'invoice_payment').reduce((acc, cat) => {
            const bgt = budgets[cat.id];
            if (!bgt) return acc;
            const amt = bgt.limit_percentage
                ? (parseFloat(bgt.limit_percentage) / 100) * totalIncome
                : (parseFloat(bgt.limit_amount) || 0);
            return acc + amt;
        }, 0);
    }, [budgets, totalIncome]);

    const remainingTotalMargin = totalPlannedLimit - totalSpent;

    // Apply 50/30/20 Automated Preset
    const apply503020Preset = () => {
        const preset = {
            housing: { limit_percentage: 25 },
            food: { limit_percentage: 15 },
            transport: { limit_percentage: 10 },
            health: { limit_percentage: 10 },
            leisure: { limit_percentage: 15 },
            education: { limit_percentage: 10 },
            other_expense: { limit_percentage: 15 },
        };

        setEditState(prev => ({
            ...prev,
            ...preset
        }));
    };

    async function saveBudgets() {
        setLoading(true);
        const toUpsert = [];
        for (const catId of Object.keys(editState)) {
            const b = editState[catId];
            if ((b?.limit_percentage > 0) || (b?.limit_amount > 0)) {
                toUpsert.push({
                    id: budgets[catId]?.id,
                    user_email: session.email,
                    category_id: catId,
                    limit_percentage: b.limit_percentage ? parseFloat(b.limit_percentage) : null,
                    limit_amount: b.limit_amount ? parseFloat(b.limit_amount) : null
                });
            }
        }

        if (toUpsert.length > 0) {
            try {
                await supabase.from('budgets').upsert(toUpsert);
            } catch (e) {
                console.warn("Supabase upsert error, saved locally", e);
            }
        }

        // Save local backup
        localStorage.setItem(`finance_budgets_${session.email}`, JSON.stringify(editState));

        await loadData();
        setIsEditing(false);
    }

    async function askAI() {
        setAiLoading(true);
        setAiAdvice(null);
        
        const payload = {
            income: totalIncome,
            budgets: CATEGORY_MAP.expense.filter(c => c.id !== 'invoice_payment').map(cat => {
                const bgt = budgets[cat.id];
                const limitAmt = bgt?.limit_percentage 
                    ? (bgt.limit_percentage / 100) * totalIncome 
                    : (bgt?.limit_amount || 0);
                return limitAmt > 0 ? { label: cat.label, limit: formatCurrency(limitAmt) } : null;
            }).filter(Boolean),
            expenses: CATEGORY_MAP.expense.filter(c => c.id !== 'invoice_payment').map(cat => {
                const spent = spentByCategory[cat.id] || 0;
                return spent > 0 ? { label: cat.label, spent: formatCurrency(spent) } : null;
            }).filter(Boolean)
        };

        try {
            const res = await fetch('/api/ai-roadmap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.advice) {
                setAiAdvice(data.advice);
            } else {
                setAiAdvice("Erro: " + (data.error || "Tente novamente mais tarde."));
            }
        } catch (e) {
            setAiAdvice("Erro ao conectar com o serviço de Inteligência Artificial.");
        }
        setAiLoading(false);
    }

    const categoriesList = CATEGORY_MAP.expense.filter(c => c.id !== 'invoice_payment');

    const filteredCategories = useMemo(() => {
        return categoriesList.filter(cat => {
            const bgt = budgets[cat.id];
            const limitAmt = bgt?.limit_percentage 
                ? (bgt.limit_percentage / 100) * totalIncome 
                : (parseFloat(bgt?.limit_amount) || 0);
            const spent = spentByCategory[cat.id] || 0;

            if (filterStatus === 'alert') {
                return limitAmt > 0 && spent >= limitAmt * 0.75;
            }
            if (filterStatus === 'ok') {
                return limitAmt > 0 && spent < limitAmt * 0.75;
            }
            if (filterStatus === 'unset') {
                return !limitAmt || limitAmt === 0;
            }
            return true;
        });
    }, [categoriesList, budgets, spentByCategory, totalIncome, filterStatus]);

    if (session === undefined) return null;

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                        <div>
                            <h2 style={{ margin: '0 0 6px', fontSize: 28, fontWeight: 800 }} className="inline-icon-label"><Map size={26} strokeWidth={2} /> Roteiro Financeiro &amp; Teto de Gastos</h2>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                                Configure metas de orçamento mensais, evite estouros e receba auxílio da IA.
                            </p>
                        </div>

                        {/* Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            {/* Month Selector */}
                            <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: 12, gap: 12, border: '1px solid var(--panel-border)' }}>
                                <button onClick={() => changeMonth(-1)} className="btn btn-icon" style={{ padding: '4px 8px', fontSize: 14 }} title="Mês Anterior">◀</button>
                                <span style={{ fontWeight: 700, fontSize: 14, minWidth: 120, textAlign: 'center' }}>{monthLabel}</span>
                                <button onClick={() => changeMonth(1)} className="btn btn-icon" style={{ padding: '4px 8px', fontSize: 14 }} title="Próximo Mês">▶</button>
                            </div>

                            <button className="btn btn-secondary" onClick={askAI} disabled={aiLoading} style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', border: '1px solid #6366f1', opacity: aiLoading ? 0.5 : 1 }}>
                                {aiLoading ? <><Bot size={14} strokeWidth={2} /> Analisando...</> : <><Bot size={14} strokeWidth={2} /> Análise da IA</>}
                            </button>

                            {isEditing ? (
                                <button className="btn btn-primary" onClick={saveBudgets} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}><Save size={14} strokeWidth={2} /> Salvar Limites</button>
                            ) : (
                                <button className="btn btn-secondary" onClick={() => setIsEditing(true)}><Pencil size={14} strokeWidth={2} /> Editar Roteiro</button>
                            )}
                        </div>
                    </div>

                    {/* KPI Stats Grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
                        <div className="card glass-panel" style={{ padding: 20 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}><Banknote size={13} strokeWidth={2} /> Receita Mensal Base</span>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', marginTop: 6 }}>
                                {formatCurrency(totalIncome)}
                            </div>
                        </div>

                        <div className="card glass-panel" style={{ padding: 20 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}><Target size={13} strokeWidth={2} /> Orçamento Total Planejado</span>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#818cf8', marginTop: 6 }}>
                                {formatCurrency(totalPlannedLimit)}
                            </div>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2, display: 'block' }}>
                                {totalIncome > 0 ? `${((totalPlannedLimit / totalIncome) * 100).toFixed(1)}% da receita` : 'Sem receita cadastrada'}
                            </span>
                        </div>

                        <div className="card glass-panel" style={{ padding: 20 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}><CreditCard size={13} strokeWidth={2} /> Gastos Realizados</span>
                            <div style={{ fontSize: 22, fontWeight: 800, color: totalSpent > totalPlannedLimit && totalPlannedLimit > 0 ? '#ef4444' : '#38bdf8', marginTop: 6 }}>
                                {formatCurrency(totalSpent)}
                            </div>
                        </div>

                        <div className="card glass-panel" style={{ padding: 20 }}>
                            <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}><Shield size={13} strokeWidth={2} /> Saldo de Limite Livre</span>
                            <div style={{ fontSize: 22, fontWeight: 800, color: remainingTotalMargin >= 0 ? '#10b981' : '#ef4444', marginTop: 6 }}>
                                {formatCurrency(remainingTotalMargin)}
                            </div>
                            <span style={{ fontSize: 11, color: remainingTotalMargin >= 0 ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)', marginTop: 2, display: 'block' }}>
                                {remainingTotalMargin >= 0 ? 'Margem disponível no teto' : 'Estouro total no roteiro!'}
                            </span>
                        </div>
                    </div>

                    {/* AI Advice Display */}
                    {aiAdvice && (
                        <div className="card glass-panel fade-up" style={{ padding: 24, marginBottom: 28, border: '1px solid rgba(99,102,241,0.4)', background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(15,23,42,0.6) 100%)' }}>
                            <h3 style={{ margin: '0 0 14px', fontSize: 16, color: '#818cf8', display: 'flex', alignItems: 'center', gap: 10 }}>
                                <Bot size={18} strokeWidth={2} /> Diagnóstico &amp; Conselho da Inteligência Financeira
                            </h3>
                            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.9)', whiteSpace: 'pre-wrap' }}>
                                {aiAdvice}
                            </div>
                        </div>
                    )}

                    {/* Main Budgets Container */}
                    <div className="card glass-panel" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Teto de Gastos por Categoria</h3>
                                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
                                    {isEditing ? 'Defina metas fixas em R$ ou porcentagem da renda mensal' : 'Acompanhe seu progresso e alertas em tempo real'}
                                </p>
                            </div>

                            {/* Preset button inside edit mode */}
                            {isEditing && (
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={apply503020Preset}
                                    style={{ fontSize: 13, padding: '8px 14px', background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid #3b82f6' }}
                                    title="Preencher % com base no modelo financeiro 50/30/20"
                                >
                                    <Zap size={13} strokeWidth={2} /> Aplicar Modelo 50/30/20
                                </button>
                            )}

                            {/* Filter Status Tabs (View Mode) */}
                            {!isEditing && (
                                <div style={{ display: 'flex', gap: 8, background: 'rgba(0,0,0,0.3)', padding: 4, borderRadius: 10, flexWrap: 'wrap' }}>
                                    <button
                                        className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setFilterStatus('all')}
                                        style={{ padding: '6px 12px', fontSize: 12 }}
                                    >
                                        Todas ({categoriesList.length})
                                    </button>
                                    <button
                                        className={`btn ${filterStatus === 'alert' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setFilterStatus('alert')}
                                        style={{ padding: '6px 12px', fontSize: 12, color: filterStatus === 'alert' ? '#fff' : '#f59e0b' }}
                                    >
                                        <AlertTriangle size={12} strokeWidth={2} /> Alerta / Estourado
                                    </button>
                                    <button
                                        className={`btn ${filterStatus === 'ok' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setFilterStatus('ok')}
                                        style={{ padding: '6px 12px', fontSize: 12, color: filterStatus === 'ok' ? '#fff' : '#10b981' }}
                                    >
                                        <Check size={12} strokeWidth={2.5} /> No Limite
                                    </button>
                                    <button
                                        className={`btn ${filterStatus === 'unset' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setFilterStatus('unset')}
                                        style={{ padding: '6px 12px', fontSize: 12 }}
                                    >
                                        <Pencil size={12} strokeWidth={2} /> Sem Meta
                                    </button>
                                </div>
                            )}
                        </div>

                        {loading ? (
                            <p style={{ textAlign: 'center', padding: 32, color: 'var(--text-secondary)' }}>Carregando orçamentos do roteiro...</p>
                        ) : (
                            <div style={{ display: 'grid', gap: 16 }}>
                                {filteredCategories.map(cat => {
                                    const bgt = isEditing ? editState[cat.id] : budgets[cat.id];
                                    const limitAmt = bgt?.limit_percentage 
                                        ? (parseFloat(bgt.limit_percentage) / 100) * totalIncome 
                                        : (parseFloat(bgt?.limit_amount) || 0);
                                    
                                    const spent = spentByCategory[cat.id] || 0;
                                    const pctSpent = limitAmt > 0 ? (spent / limitAmt) * 100 : 0;
                                    
                                    const isOver = limitAmt > 0 && spent >= limitAmt;
                                    const isWarning = limitAmt > 0 && spent >= limitAmt * 0.75 && spent < limitAmt;
                                    const isOk = limitAmt > 0 && spent < limitAmt * 0.75;
                                    const isUnset = !limitAmt || limitAmt === 0;

                                    let badgeTag = null;
                                    if (isOver) {
                                        badgeTag = <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)' }} className="inline-icon-label"><AlertTriangle size={11} strokeWidth={2} /> ESTOURADO ({pctSpent.toFixed(0)}%)</span>;
                                    } else if (isWarning) {
                                        badgeTag = <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)' }} className="inline-icon-label"><AlertTriangle size={11} strokeWidth={2} /> ATENÇÃO ({pctSpent.toFixed(0)}%)</span>;
                                    } else if (isOk) {
                                        badgeTag = <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.4)' }} className="inline-icon-label"><Check size={11} strokeWidth={2.5} /> DENTRO DA META</span>;
                                    } else if (isUnset) {
                                        badgeTag = <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>SEM META DEFINIDA</span>;
                                    }

                                    return (
                                        <div
                                            key={cat.id}
                                            style={{
                                                padding: 20,
                                                borderRadius: 14,
                                                background: isOver ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                                                border: isOver
                                                    ? '1px solid rgba(239,68,68,0.4)'
                                                    : isWarning
                                                    ? '1px solid rgba(245,158,11,0.3)'
                                                    : '1px solid rgba(255,255,255,0.08)',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 12 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <div style={{ width: 40, height: 40, borderRadius: 12, background: cat.color + '22', color: cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                                        <CategoryIcon name={cat.iconName} size={20} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: 700, fontSize: 16 }}>{cat.label}</div>
                                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                            {badgeTag}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Editing Controls */}
                                                {isEditing ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>% Renda:</span>
                                                            <input
                                                                type="number"
                                                                placeholder="%"
                                                                min="0"
                                                                max="100"
                                                                value={bgt?.limit_percentage || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    setEditState(s => ({
                                                                        ...s,
                                                                        [cat.id]: { ...(s[cat.id] || {}), limit_percentage: val, limit_amount: '' }
                                                                    }));
                                                                }}
                                                                style={{ width: 70, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 14 }}
                                                            />
                                                        </div>

                                                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>ou</span>

                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Fixo R$:</span>
                                                            <input
                                                                type="number"
                                                                placeholder="R$ Limite"
                                                                min="0"
                                                                value={bgt?.limit_amount || ''}
                                                                onChange={e => {
                                                                    const val = e.target.value;
                                                                    setEditState(s => ({
                                                                        ...s,
                                                                        [cat.id]: { ...(s[cat.id] || {}), limit_amount: val, limit_percentage: '' }
                                                                    }));
                                                                }}
                                                                style={{ width: 110, padding: '8px 10px', borderRadius: 8, border: '1px solid var(--panel-border)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 14 }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    /* View Mode Numbers */
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                                            Meta: <strong style={{ color: 'white' }}>{limitAmt > 0 ? formatCurrency(limitAmt) : 'Não configurada'}</strong>
                                                            {bgt?.limit_percentage ? ` (${bgt.limit_percentage}% da renda)` : ''}
                                                        </div>
                                                        <div style={{ fontSize: 16, fontWeight: 800, color: isOver ? '#ef4444' : 'white', marginTop: 2 }}>
                                                            Gasto: {formatCurrency(spent)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Progress Bar & Details in View Mode */}
                                            {!isEditing && limitAmt > 0 && (
                                                <div>
                                                    <div style={{ width: '100%', height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden', margin: '10px 0 8px 0' }}>
                                                        <div
                                                            style={{
                                                                width: `${Math.min(100, pctSpent)}%`,
                                                                height: '100%',
                                                                background: isOver
                                                                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                                                                    : isWarning
                                                                    ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                                                                    : `linear-gradient(90deg, ${cat.color}, #10b981)`,
                                                                borderRadius: 4,
                                                                boxShadow: isOver ? '0 0 10px rgba(239,68,68,0.5)' : 'none',
                                                                transition: 'width 0.6s ease'
                                                            }}
                                                        />
                                                    </div>

                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)' }}>
                                                        <span>0%</span>
                                                        <span>
                                                            {isOver
                                                                ? `Estourou por ${formatCurrency(spent - limitAmt)}`
                                                                : `Restam ${formatCurrency(limitAmt - spent)} de limite`}
                                                        </span>
                                                        <span>100%</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
