"use client";

import { useState, useEffect, useMemo } from 'react';
import { generateFinancialNotifications, requestNotificationPermission, sendBrowserNotification } from '../lib/notificationsEngine';

export default function NotificationCenter({
    receivables = [],
    financings = [],
    cards = [],
    transactions = [],
    onMarkReceived,
    onPayFinancing,
    onPayCardInvoice
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [readAlertIds, setReadAlertIds] = useState(() => {
        if (typeof window !== 'undefined') {
            try {
                return JSON.parse(localStorage.getItem('finance_read_alerts') || '[]');
            } catch (e) {
                return [];
            }
        }
        return [];
    });

    const [pushEnabled, setPushEnabled] = useState(false);
    const [showExternalConfig, setShowExternalConfig] = useState(false);
    const [targetEmail, setTargetEmail] = useState('');
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [emailStatusMsg, setEmailStatusMsg] = useState('');

    useEffect(() => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
            setPushEnabled(Notification.permission === 'granted');
        }
    }, []);

    // Generate active notifications
    const allAlerts = useMemo(() => {
        return generateFinancialNotifications({ receivables, financings, cards, transactions }, { daysAhead: 5 });
    }, [receivables, financings, cards, transactions]);

    // Unread count
    const unreadAlerts = useMemo(() => {
        return allAlerts.filter(a => !readAlertIds.includes(a.id));
    }, [allAlerts, readAlertIds]);

    const markAsRead = (id) => {
        const next = [...readAlertIds, id];
        setReadAlertIds(next);
        if (typeof window !== 'undefined') {
            localStorage.setItem('finance_read_alerts', JSON.stringify(next));
        }
    };

    const markAllAsRead = () => {
        const allIds = allAlerts.map(a => a.id);
        setReadAlertIds(allIds);
        if (typeof window !== 'undefined') {
            localStorage.setItem('finance_read_alerts', JSON.stringify(allIds));
        }
    };

    const handleEnableBrowserPush = async () => {
        const res = await requestNotificationPermission();
        if (res.granted) {
            setPushEnabled(true);
            sendBrowserNotification('🎉 Notificações Ativadas!', {
                body: 'Você receberá alertas automáticos de contas a pagar e receber sem custo algum.'
            });
        } else {
            alert('Permissão de notificações não concedida. Verifique as configurações do seu navegador.');
        }
    };

    const handleSendTestEmail = async () => {
        if (!targetEmail) {
            alert('Digite um endereço de e-mail válido.');
            return;
        }

        setIsSendingEmail(true);
        setEmailStatusMsg('');
        try {
            const res = await fetch('/api/notifications/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    toEmail: targetEmail,
                    isTest: true,
                    alerts: allAlerts
                })
            });
            const data = await res.json();
            if (data.success) {
                setEmailStatusMsg(data.message || '✅ E-mail enviado com sucesso (0 custo)!');
            } else {
                setEmailStatusMsg(`❌ Falha ao enviar: ${data.error || 'Erro desconhecido'}`);
            }
        } catch (err) {
            setEmailStatusMsg(`❌ Erro de conexão: ${err.message}`);
        } finally {
            setIsSendingEmail(false);
        }
    };

    return (
        <div style={{ display: 'inline-block' }}>
            {/* Bell Icon Button — estilo em globals.css (.notif-bell) */}
            <button
                className="notif-bell"
                onClick={() => setIsOpen(!isOpen)}
                title="Notificações & Lembretes"
                aria-label={unreadAlerts.length > 0 ? `${unreadAlerts.length} alertas não lidos` : 'Notificações'}
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadAlerts.length > 0 && (
                    <span className="notif-badge">{unreadAlerts.length}</span>
                )}
            </button>

            {/* Clique fora fecha o painel */}
            {isOpen && <div className="notif-backdrop" onClick={() => setIsOpen(false)} />}

            {/* Painel ancorado na viewport — o botão vive dentro da Sidebar, que
                tem overflow-y:auto e recortaria um dropdown posicionado nela */}
            {isOpen && (
                <div style={{
                    background: '#111827',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 18,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                    padding: 16,
                    backdropFilter: 'blur(16px)'
                }} className="fade-up notif-panel">
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>🔔 Lembretes Financeiros</span>
                            {unreadAlerts.length > 0 && (
                                <span style={{ fontSize: 11, background: 'rgba(239,68,68,0.2)', color: '#f87171', padding: '2px 6px', borderRadius: 6 }}>
                                    {unreadAlerts.length} novos
                                </span>
                            )}
                        </div>
                        {unreadAlerts.length > 0 && (
                            <button
                                onClick={markAllAsRead}
                                style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                            >
                                Limpar tudo
                            </button>
                        )}
                    </div>

                    {/* Browser Push Enable Bar */}
                    {!pushEnabled ? (
                        <div style={{ padding: 10, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontSize: 11, color: '#93c5fd' }}>
                                💡 Ative avisos no celular/PC de graça!
                            </div>
                            <button
                                onClick={handleEnableBrowserPush}
                                style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                            >
                                Ativar
                            </button>
                        </div>
                    ) : (
                        <div style={{ padding: '6px 10px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, marginBottom: 12, fontSize: 11, color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>✓ Notificações do Navegador Ativas</span>
                        </div>
                    )}

                    {/* Alert items list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                        {allAlerts.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                                🎉 Nenhuma conta a vencer nos próximos dias!
                            </div>
                        ) : (
                            allAlerts.map((alert) => {
                                const isUnread = !readAlertIds.includes(alert.id);
                                const bgMap = {
                                    danger: 'rgba(239,68,68,0.1)',
                                    warning: 'rgba(245,158,11,0.1)',
                                    success: 'rgba(16,185,129,0.1)',
                                    info: 'rgba(59,130,246,0.1)'
                                };
                                const borderMap = {
                                    danger: '#ef4444',
                                    warning: '#f59e0b',
                                    success: '#10b981',
                                    info: '#3b82f6'
                                };

                                return (
                                    <div
                                        key={alert.id}
                                        style={{
                                            padding: 12,
                                            borderRadius: 10,
                                            background: bgMap[alert.severity] || 'rgba(255,255,255,0.03)',
                                            borderLeft: `4px solid ${borderMap[alert.severity] || '#94a3b8'}`,
                                            opacity: isUnread ? 1 : 0.65,
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: 'white' }}>
                                                {alert.title}
                                            </div>
                                            {isUnread && (
                                                <button
                                                    onClick={() => markAsRead(alert.id)}
                                                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer' }}
                                                    title="Marcar como lida"
                                                >
                                                    ✓
                                                </button>
                                            )}
                                        </div>

                                        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                                            {alert.message}
                                        </p>

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                                            {alert.type === 'receivable' && (
                                                <button
                                                    onClick={() => {
                                                        if (onMarkReceived) onMarkReceived(alert.itemId, alert.yearMonth);
                                                        markAsRead(alert.id);
                                                    }}
                                                    style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    ✓ Recebido
                                                </button>
                                            )}
                                            {alert.type === 'financing' && (
                                                <button
                                                    onClick={() => {
                                                        if (onPayFinancing) onPayFinancing(financings.find(f => f.id === alert.financingId));
                                                        markAsRead(alert.id);
                                                    }}
                                                    style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    💳 Pagar Parcela
                                                </button>
                                            )}
                                            {alert.type === 'card' && (
                                                <button
                                                    onClick={() => {
                                                        if (onPayCardInvoice) onPayCardInvoice(cards.find(c => c.id === alert.cardId), alert.amount);
                                                        markAsRead(alert.id);
                                                    }}
                                                    style={{ background: '#8b5cf6', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    🧾 Pagar Fatura
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Footer option for External Notifications Setup */}
                    <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
                        <button
                            onClick={() => setShowExternalConfig(true)}
                            style={{ background: 'none', border: 'none', color: '#a78bfa', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                        >
                            ⚙️ Configurar Notificações Externas Grátis (E-mail / Telegram)
                        </button>
                    </div>
                </div>
            )}

            {/* Modal for External Notification Info & Setup */}
            {showExternalConfig && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    background: 'rgba(0,0,0,0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20
                }}>
                    <div className="glass-panel fade-up" style={{ width: '100%', maxWidth: 540, padding: 28, borderRadius: 20, background: '#111827', border: '1px solid rgba(139,92,246,0.3)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'white' }}>
                                📩 Sistema de Notificações Externas (100% Grátis)
                            </h3>
                            <button onClick={() => setShowExternalConfig(false)} style={{ background: 'none', border: 'none', color: 'white', fontSize: 20, cursor: 'pointer' }}>
                                ✕
                            </button>
                        </div>

                        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 16 }}>
                            Como definimos, <strong>não podemos gastar dinheiro</strong> com SMS ou APIs pagas. Abaixo estão as melhores opções gratuitas recomendadas para receber alertas no seu celular e e-mail:
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Push Browser */}
                            <div style={{ padding: 14, background: 'rgba(59,130,246,0.1)', borderRadius: 12, border: '1px solid rgba(59,130,246,0.3)' }}>
                                <div style={{ fontWeight: 700, color: '#60a5fa', marginBottom: 4 }}>
                                    📱 1. Push Native do Navegador (Sem Custo)
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                                    Funciona no Android, Windows, Mac e iOS (Safari PWA). Envia notificações diretamente para a tela do seu celular ou PC.
                                </div>
                            </div>

                            {/* Email Free & Test Trigger */}
                            <div style={{ padding: 14, background: 'rgba(16,185,129,0.1)', borderRadius: 12, border: '1px solid rgba(16,185,129,0.3)' }}>
                                <div style={{ fontWeight: 700, color: '#34d399', marginBottom: 4 }}>
                                    ✉️ 2. E-mail Gratuito (Resend / EmailJS / Gmail SMTP)
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginBottom: 10 }}>
                                    O serviço <strong>Resend</strong> fornece 3.000 e-mails/mês totalmente grátis. Teste o disparo de e-mail agora:
                                </div>

                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <input
                                        type="email"
                                        placeholder="Seu e-mail (ex: voce@email.com)"
                                        value={targetEmail}
                                        onChange={e => setTargetEmail(e.target.value)}
                                        style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 12 }}
                                    />
                                    <button
                                        onClick={handleSendTestEmail}
                                        disabled={isSendingEmail}
                                        style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: isSendingEmail ? 'wait' : 'pointer' }}
                                    >
                                        {isSendingEmail ? 'Enviando...' : '✉️ Enviar E-mail de Teste'}
                                    </button>
                                </div>

                                {emailStatusMsg && (
                                    <div style={{ marginTop: 8, fontSize: 12, padding: 8, borderRadius: 6, background: 'rgba(0,0,0,0.4)', color: 'white' }}>
                                        {emailStatusMsg}
                                    </div>
                                )}
                            </div>

                            {/* Telegram Bot */}
                            <div style={{ padding: 14, background: 'rgba(168,85,247,0.1)', borderRadius: 12, border: '1px solid rgba(168,85,247,0.3)' }}>
                                <div style={{ fontWeight: 700, color: '#c084fc', marginBottom: 4 }}>
                                    🤖 3. Bot do Telegram (100% Grátis & Instantâneo)
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>
                                    Criação de um bot próprio no Telegram em 1 minuto via BotFather. O bot envia mensagens automáticas no seu Telegram com os alertas de contas a receber e pagar.
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: 20, textAlign: 'right' }}>
                            <button
                                onClick={() => setShowExternalConfig(false)}
                                className="btn-primary"
                                style={{ padding: '8px 20px', fontSize: 13 }}
                            >
                                Entendido!
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
