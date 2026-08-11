"use client";

// NOTA: este arquivo deveria se chamar useReceivables.js — o Bitdefender da
// máquina de dev bloqueia a criação desse caminho exato. O hook exportado
// continua sendo useReceivables. Ver docs/contas-a-receber-e-notificacoes.md

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Contas a receber ficam na tabela transactions com type 'system' + category
// 'system_receivable'. Esses registros são apenas o "cadastro" da conta e são
// filtrados de useTransactions/calcBalance/calcIncome, então não contam como
// receita. A receita real só entra quando o recebimento é confirmado e uma
// transação normal de income é criada.
const CATEGORY = 'system_receivable';

// Uma conta de duração determinada deixa de ser ativa quando os meses acabam
function isStillActive(item) {
    if (item.recurrenceType !== 'fixed_duration') return true;
    const total = parseInt(item.durationMonths) || 0;
    if (!total) return true;

    const start = new Date(item.startDate || Date.now());
    const now = new Date();
    const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    return monthsElapsed < total;
}

function withActive(item) {
    return { ...item, active: isStillActive(item) };
}

export function useReceivables(userEmail) {
    const [receivables, setReceivables] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadReceivables = useCallback(async () => {
        if (!userEmail) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_email', userEmail)
                .eq('category', CATEGORY);

            let cloudItems = [];
            if (!error && data) {
                cloudItems = data.map(row => {
                    try {
                        const parsed = JSON.parse(row.note);
                        return withActive({ ...parsed, dbId: row.id });
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);
            }

            // Migra itens salvos apenas em local storage para o Supabase
            const localSaved = localStorage.getItem(`finance_receivables_${userEmail}`);
            if (localSaved) {
                try {
                    const localItems = JSON.parse(localSaved);
                    if (Array.isArray(localItems) && localItems.length > 0) {
                        for (const item of localItems) {
                            const exists = cloudItems.some(c => String(c.id) === String(item.id));
                            if (!exists) {
                                const { data: inserted } = await supabase.from('transactions').insert({
                                    user_email: userEmail,
                                    description: `A Receber: ${item.name}`,
                                    amount: item.amount || 0,
                                    type: 'system',
                                    category: CATEGORY,
                                    date: new Date().toISOString().split('T')[0],
                                    note: JSON.stringify(item)
                                }).select().single();

                                if (inserted) {
                                    cloudItems.push(withActive({ ...item, dbId: inserted.id }));
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error migrating local receivables", e);
                }
            }

            setReceivables(cloudItems);
            localStorage.setItem(`finance_receivables_${userEmail}`, JSON.stringify(cloudItems));
        } finally {
            setLoading(false);
        }
    }, [userEmail]);

    useEffect(() => {
        loadReceivables();
        window.addEventListener('receivables_updated', loadReceivables);
        return () => {
            window.removeEventListener('receivables_updated', loadReceivables);
        };
    }, [loadReceivables]);

    // Persiste a lista inteira no state + local storage e avisa a aplicação
    const persist = useCallback((list) => {
        setReceivables(list);
        localStorage.setItem(`finance_receivables_${userEmail}`, JSON.stringify(list));
        window.dispatchEvent(new Event('receivables_updated'));
    }, [userEmail]);

    const addReceivable = useCallback(async (item) => {
        if (!userEmail) return;
        const newItem = {
            id: Date.now().toString(),
            name: (item.name || '').trim(),
            amount: parseFloat(item.amount) || 0,
            dueDay: parseInt(item.dueDay) || 10,
            recurrenceType: item.recurrenceType || 'indefinite', // indefinite | fixed_duration
            durationMonths: parseInt(item.durationMonths) || 0,
            account: item.account || 'checking',
            payer: (item.payer || '').trim(),
            category: item.category || 'other_income',
            startDate: new Date().toISOString(),
            active: true,
            receivedMonths: {}
        };

        try {
            const { data: inserted } = await supabase.from('transactions').insert({
                user_email: userEmail,
                description: `A Receber: ${newItem.name}`,
                amount: newItem.amount,
                type: 'system',
                category: CATEGORY,
                date: new Date().toISOString().split('T')[0],
                note: JSON.stringify(newItem)
            }).select().single();

            persist([...receivables, { ...newItem, dbId: inserted?.id }]);
        } catch (err) {
            console.error("Erro ao salvar conta a receber no Supabase", err);
        }
    }, [userEmail, receivables, persist]);

    const removeReceivable = useCallback(async (id) => {
        const target = receivables.find(r => r.id === id || r.dbId === id);
        if (!target) return;

        persist(receivables.filter(r => r.id !== id && r.dbId !== id));

        if (target.dbId) {
            await supabase.from('transactions').delete().eq('id', target.dbId);
        }
    }, [receivables, persist]);

    // Atualiza um item no state/cloud a partir de uma função de transformação
    const updateItem = useCallback(async (id, transform) => {
        const target = receivables.find(r => r.id === id || r.dbId === id);
        if (!target) return null;

        const updated = transform(target);
        if (!updated) return null;

        persist(receivables.map(r => (r.id === id || r.dbId === id) ? updated : r));

        if (target.dbId) {
            await supabase.from('transactions').update({
                amount: updated.amount,
                note: JSON.stringify(updated)
            }).eq('id', target.dbId);
        }
        return updated;
    }, [receivables, persist]);

    const markAsReceived = useCallback(async (id, yearMonth, createTxCallback) => {
        const target = receivables.find(r => r.id === id || r.dbId === id);
        if (!target) return;

        const ym = yearMonth || new Date().toISOString().slice(0, 7);
        if (target.receivedMonths && target.receivedMonths[ym]) return; // já recebido

        await updateItem(id, (item) => ({
            ...item,
            receivedMonths: {
                ...(item.receivedMonths || {}),
                [ym]: { date: new Date().toISOString(), amount: item.amount }
            }
        }));

        window.dispatchEvent(new Event('wallet_updated'));

        if (typeof createTxCallback === 'function') {
            const [y, m] = ym.split('-');
            const daysInMonth = new Date(Number(y), Number(m), 0).getDate();
            const day = String(Math.min(target.dueDay || 10, daysInMonth)).padStart(2, '0');

            createTxCallback({
                desc: `Recebimento: ${target.name}${target.payer ? ` (${target.payer})` : ''}`,
                amount: target.amount,
                type: 'income',
                category: target.category || 'other_income',
                account: target.account || 'checking',
                date: `${y}-${m}-${day}`
            });
        }
    }, [receivables, updateItem]);

    const unmarkReceived = useCallback(async (id, yearMonth) => {
        const ym = yearMonth || new Date().toISOString().slice(0, 7);

        await updateItem(id, (item) => {
            const next = { ...(item.receivedMonths || {}) };
            delete next[ym];
            return { ...item, receivedMonths: next };
        });

        window.dispatchEvent(new Event('wallet_updated'));
    }, [updateItem]);

    return {
        receivables,
        loading,
        addReceivable,
        removeReceivable,
        markAsReceived,
        unmarkReceived
    };
}
