"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '../../components/Sidebar';
import FinancialCalendar from '../../components/FinancialCalendar';
import { useSession } from '../../hooks/useSession';
import { useReceivables } from '../../hooks/useReceivablesData';
import { useTransactions } from '../../hooks/useTransactions';
import { formatCurrency } from '../../helpers';
import { HandCoins, Plus, CalendarDays, ClipboardList, Check, X } from 'lucide-react'

export default function ReceivablesPage() {
    const router = useRouter();
    const session = useSession();

    useEffect(() => {
        if (session === undefined) return;
        if (!session) {
            router.push('/login');
        }
    }, [session, router]);

    const { receivables, addReceivable, removeReceivable, markAsReceived, unmarkReceived } = useReceivables(session?.email);
    const { create: createTx } = useTransactions(session?.email);

    // Active View Tab: 'calendar' or 'list'
    const [activeTab, setActiveTab] = useState('calendar');

    // Add Form State
    const [isAdding, setIsAdding] = useState(false);
    const [newReceivable, setNewReceivable] = useState({
        name: '',
        amount: '',
        dueDay: '10',
        recurrenceType: 'indefinite',
        durationMonths: '12',
        account: 'checking',
        payer: '',
        category: 'freelance'
    });

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    const yearMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

    // Metrics for the current month
    const totalMonthReceivable = useMemo(() => {
        return receivables.reduce((sum, r) => sum + (r.active ? r.amount : 0), 0);
    }, [receivables]);

    const totalReceivedThisMonth = useMemo(() => {
        return receivables.reduce((sum, r) => {
            if (r.active && r.receivedMonths && r.receivedMonths[yearMonthStr]) {
                return sum + r.amount;
            }
            return sum;
        }, 0);
    }, [receivables, yearMonthStr]);

    const totalPendingThisMonth = Math.max(0, totalMonthReceivable - totalReceivedThisMonth);

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!newReceivable.name || !newReceivable.amount || !newReceivable.dueDay) {
            alert('Preencha os campos obrigatórios.');
            return;
        }

        addReceivable(newReceivable);
        setIsAdding(false);
        setNewReceivable({
            name: '',
            amount: '',
            dueDay: '10',
            recurrenceType: 'indefinite',
            durationMonths: '12',
            account: 'checking',
            payer: '',
            category: 'freelance'
        });
    };

    const handleConfirmReceive = (id, ym = yearMonthStr) => {
        const item = receivables.find(r => r.id === id || r.dbId === id);
        if (!item) return;

        const ok = confirm(`Confirmar o recebimento de ${formatCurrency(item.amount)} referente a "${item.name}"?\nIsso adicionará o valor à sua Conta Corrente.`);
        if (!ok) return;

        markAsReceived(id, ym, (txData) => {
            createTx(txData).catch(err => console.error("Erro ao registrar entrada de receita:", err));
        });
    };

    if (session === undefined) return null;

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />

                <main className="main-content">
                    {/* Top Bar Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 16 }}>
                        <header className="top-header fade-up" style={{ flex: 1, margin: 0 }}>
                            <div>
                                <h2 className="page-title"><HandCoins size={24} strokeWidth={2} /> Contas a Receber</h2>
                                <p className="page-subtitle">Gerencie receitas mensais, datas de recebimento e acompanhe o calendário.</p>
                            </div>
                        </header>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button className="btn-primary" onClick={() => setIsAdding(!isAdding)}>
                                <Plus size={16} strokeWidth={2} className="icon" /> {isAdding ? 'Cancelar' : '+ Nova Conta a Receber'}
                            </button>
                        </div>
                    </div>

                    {/* Stats Metrics Cards */}
                    <section className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 24 }}>
                        <div className="card glass-panel" style={{ padding: '20px 24px', border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Previsto no Mês</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981', margin: '4px 0' }}>{formatCurrency(totalMonthReceivable)}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{receivables.length} conta(s) a receber cadastrada(s)</div>
                        </div>

                        <div className="card glass-panel" style={{ padding: '20px 24px', border: '1px solid rgba(59,130,246,0.3)', background: 'linear-gradient(180deg, rgba(59,130,246,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Já Recebido Este Mês</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: '#60a5fa', margin: '4px 0' }}>{formatCurrency(totalReceivedThisMonth)}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{Math.round(totalMonthReceivable > 0 ? (totalReceivedThisMonth / totalMonthReceivable) * 100 : 0)}% do previsto</div>
                        </div>

                        <div className="card glass-panel" style={{ padding: '20px 24px', border: '1px solid rgba(245,158,11,0.3)', background: 'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, rgba(255,255,255,0.02) 100%)' }}>
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Pendente a Receber</div>
                            <div style={{ fontSize: 26, fontWeight: 800, color: '#f59e0b', margin: '4px 0' }}>{formatCurrency(totalPendingThisMonth)}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Aguardando confirmação</div>
                        </div>
                    </section>

                    {/* Inline Add Receivable Form */}
                    {isAdding && (
                        <div className="glass-panel fade-up" style={{ padding: 24, marginBottom: 24, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.03)' }}>
                            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Plus size={16} strokeWidth={2} /> Cadastrar Nova Conta a Receber
                            </h3>
                            <form onSubmit={handleFormSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
                                <div className="tx-field">
                                    <label>Descrição do Recebimento</label>
                                    <input type="text" placeholder="Ex: Aluguel Imóvel A, Freelance..." value={newReceivable.name} onChange={e => setNewReceivable({ ...newReceivable, name: e.target.value })} required />
                                </div>
                                <div className="tx-field">
                                    <label>Valor Mensal (R$)</label>
                                    <input type="number" step="0.01" min="0" placeholder="0,00" value={newReceivable.amount} onChange={e => setNewReceivable({ ...newReceivable, amount: e.target.value })} required />
                                </div>
                                <div className="tx-field">
                                    <label>Dia Fixo do Mês para Cobrar</label>
                                    <input type="number" min="1" max="31" value={newReceivable.dueDay} onChange={e => setNewReceivable({ ...newReceivable, dueDay: e.target.value })} required />
                                </div>
                                <div className="tx-field">
                                    <label>Tipo de Recorrência</label>
                                    <select value={newReceivable.recurrenceType} onChange={e => setNewReceivable({ ...newReceivable, recurrenceType: e.target.value })}>
                                        <option value="indefinite">Sem Prazo Determinado (Recorrente)</option>
                                        <option value="fixed_duration">⏳ Tempo Determinado (Meses)</option>
                                    </select>
                                </div>
                                {newReceivable.recurrenceType === 'fixed_duration' && (
                                    <div className="tx-field">
                                        <label>Duração em Meses</label>
                                        <input type="number" min="1" max="120" value={newReceivable.durationMonths} onChange={e => setNewReceivable({ ...newReceivable, durationMonths: e.target.value })} required />
                                    </div>
                                )}
                                <div className="tx-field">
                                    <label>Pagador / Origem (Opcional)</label>
                                    <input type="text" placeholder="Ex: Cliente João, Empresa X" value={newReceivable.payer} onChange={e => setNewReceivable({ ...newReceivable, payer: e.target.value })} />
                                </div>
                                <div className="tx-field">
                                    <label>Conta para Receber</label>
                                    <select value={newReceivable.account} onChange={e => setNewReceivable({ ...newReceivable, account: e.target.value })}>
                                        <option value="checking">Conta Corrente</option>
                                        <option value="savings">Poupança</option>
                                        <option value="cash">Dinheiro</option>
                                    </select>
                                </div>
                                <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                                    <button type="button" onClick={() => setIsAdding(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 10, cursor: 'pointer' }}>
                                        Cancelar
                                    </button>
                                    <button type="submit" className="btn-primary" style={{ padding: '10px 24px', background: '#10b981' }}>
                                        Salvar Conta a Receber
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* View Tabs Toggle */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 12 }}>
                        <button
                            onClick={() => setActiveTab('calendar')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 10,
                                border: 'none',
                                background: activeTab === 'calendar' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
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
                            <CalendarDays size={16} strokeWidth={2} /> Calendário Interativo
                        </button>
                        <button
                            onClick={() => setActiveTab('list')}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 10,
                                border: 'none',
                                background: activeTab === 'list' ? '#10b981' : 'rgba(255,255,255,0.05)',
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
                            <ClipboardList size={16} strokeWidth={2} /> Lista de Contas Cadastradas ({receivables.length})
                        </button>
                    </div>

                    {/* TAB 1: CALENDAR */}
                    {activeTab === 'calendar' && (
                        <FinancialCalendar
                            mode="receivables"
                            receivables={receivables}
                            onMarkReceived={handleConfirmReceive}
                        />
                    )}

                    {/* TAB 2: REGISTERED RECEIVABLES LIST */}
                    {activeTab === 'list' && (
                        <div className="glass-panel fade-up" style={{ padding: 24, borderRadius: 20 }}>
                            <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>Minhas Contas a Receber Cadastradas</h3>

                            {receivables.length === 0 ? (
                                <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
                                    <div style={{ marginBottom: 12 }}><HandCoins size={38} strokeWidth={1.5} /></div>
                                    Nenhuma conta a receber cadastrada ainda.<br />
                                    Clique em <strong>"+ Nova Conta a Receber"</strong> acima para registrar.
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                                    {receivables.map(r => {
                                        const isReceived = r.receivedMonths && r.receivedMonths[yearMonthStr];

                                        return (
                                            <div
                                                key={r.id}
                                                style={{
                                                    padding: 20,
                                                    borderRadius: 16,
                                                    background: 'rgba(255,255,255,0.03)',
                                                    border: `1px solid ${isReceived ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.1)'}`,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    justify: 'space-between',
                                                    position: 'relative'
                                                }}
                                            >
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                                                            Dia {r.dueDay} de cada mês
                                                        </span>
                                                        <button
                                                            onClick={() => { if (confirm(`Excluir conta a receber "${r.name}"?`)) removeReceivable(r.id); }}
                                                            style={{ background: 'none', border: 'none', color: '#ef4444', opacity: 0.6, cursor: 'pointer', fontSize: 14 }}
                                                            title="Excluir"
                                                        >
                                                            <X size={14} strokeWidth={2} />
                                                        </button>
                                                    </div>

                                                    <h4 style={{ fontSize: 18, margin: '4px 0', color: 'white' }}>{r.name}</h4>
                                                    {r.payer && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Origem: {r.payer}</div>}

                                                    <div style={{ fontSize: 22, fontWeight: 800, color: '#10b981', margin: '8px 0' }}>
                                                        + {formatCurrency(r.amount)}
                                                    </div>

                                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
                                                        Recorrência: {r.recurrenceType === 'fixed_duration' ? `Duração de ${r.durationMonths} meses` : 'Sem prazo / Contínuo'}
                                                    </div>
                                                </div>

                                                {/* Action Bar */}
                                                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    {isReceived ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                            <span style={{ color: '#10b981', fontWeight: 700, fontSize: 13 }} className="inline-icon-label"><Check size={13} strokeWidth={2.5} /> Recebido este mês</span>
                                                            <button
                                                                onClick={() => unmarkReceived(r.id, yearMonthStr)}
                                                                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', textDecoration: 'underline', fontSize: 11, cursor: 'pointer' }}
                                                            >
                                                                Desfazer
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleConfirmReceive(r.id)}
                                                            style={{
                                                                width: '100%',
                                                                padding: '8px 14px',
                                                                borderRadius: 8,
                                                                background: '#10b981',
                                                                color: 'white',
                                                                border: 'none',
                                                                fontWeight: 700,
                                                                fontSize: 12,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <Check size={13} strokeWidth={2.5} /> Confirmar Recebimento do Mês
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
