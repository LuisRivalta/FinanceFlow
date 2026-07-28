"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useFinancings(userEmail) {
    const [financings, setFinancings] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadFinancings = useCallback(async () => {
        if (!userEmail) return;
        setLoading(true);
        try {
            // Load from Supabase
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_email', userEmail)
                .eq('category', 'system_financing');

            let cloudItems = [];
            if (!error && data) {
                cloudItems = data.map(row => {
                    try {
                        const parsed = JSON.parse(row.note);
                        return { ...parsed, dbId: row.id };
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);
            }

            // Check if local storage has existing items to migrate to Supabase
            const localSaved = localStorage.getItem(`finance_financings_${userEmail}`);
            if (localSaved) {
                try {
                    const localItems = JSON.parse(localSaved);
                    if (Array.isArray(localItems) && localItems.length > 0) {
                        for (const item of localItems) {
                            const exists = cloudItems.some(c => String(c.id) === String(item.id));
                            if (!exists) {
                                const { data: inserted } = await supabase.from('transactions').insert({
                                    user_email: userEmail,
                                    description: `Financiamento: ${item.name}`,
                                    amount: item.monthlyPayment || 0,
                                    type: 'expense',
                                    category: 'system_financing',
                                    date: new Date().toISOString().split('T')[0],
                                    note: JSON.stringify(item)
                                }).select().single();

                                if (inserted) {
                                    cloudItems.push({ ...item, dbId: inserted.id });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error migrating local financings", e);
                }
            }

            setFinancings(cloudItems);
            localStorage.setItem(`finance_financings_${userEmail}`, JSON.stringify(cloudItems));
        } finally {
            setLoading(false);
        }
    }, [userEmail]);

    useEffect(() => {
        loadFinancings();
        window.addEventListener('financings_updated', loadFinancings);
        return () => {
            window.removeEventListener('financings_updated', loadFinancings);
        };
    }, [loadFinancings]);

    const addFinancing = useCallback(async (item) => {
        if (!userEmail) return;
        const newItem = {
            id: Date.now().toString(),
            name: item.name.trim(),
            type: item.type || 'car', // car, housing, loan, other
            monthlyPayment: parseFloat(item.monthlyPayment),
            totalInstallments: parseInt(item.totalInstallments),
            paidInstallments: parseInt(item.paidInstallments) || 0,
            dueDay: parseInt(item.dueDay) || 10,
            account: item.account || 'checking',
            startDate: item.startDate || new Date().toISOString(),
            history: []
        };

        try {
            const { data: inserted } = await supabase.from('transactions').insert({
                user_email: userEmail,
                description: `Financiamento: ${newItem.name}`,
                amount: newItem.monthlyPayment,
                type: 'expense',
                category: 'system_financing',
                date: new Date().toISOString().split('T')[0],
                note: JSON.stringify(newItem)
            }).select().single();

            const withDbId = { ...newItem, dbId: inserted?.id };
            const newList = [...financings, withDbId];
            setFinancings(newList);
            localStorage.setItem(`finance_financings_${userEmail}`, JSON.stringify(newList));
            window.dispatchEvent(new Event('financings_updated'));
            window.dispatchEvent(new Event('wallet_updated'));
        } catch (err) {
            console.error("Erro ao salvar financiamento no Supabase", err);
        }
    }, [userEmail, financings]);

    const removeFinancing = useCallback(async (id) => {
        const target = financings.find(f => f.id === id || f.dbId === id);
        if (!target) return;

        const newList = financings.filter(f => f.id !== id && f.dbId !== id);
        setFinancings(newList);
        localStorage.setItem(`finance_financings_${userEmail}`, JSON.stringify(newList));

        if (target.dbId) {
            await supabase.from('transactions').delete().eq('id', target.dbId);
        }
        window.dispatchEvent(new Event('financings_updated'));
        window.dispatchEvent(new Event('wallet_updated'));
    }, [userEmail, financings]);

    const payInstallment = useCallback(async (id, createTxCallback) => {
        const target = financings.find(f => f.id === id || f.dbId === id);
        if (!target) return;
        if (target.paidInstallments >= target.totalInstallments) {
            alert('Este financiamento já está 100% quitado!');
            return;
        }

        const nextInstallmentNum = target.paidInstallments + 1;
        const updatedTarget = {
            ...target,
            paidInstallments: nextInstallmentNum,
            history: [
                ...(target.history || []),
                { installment: nextInstallmentNum, date: new Date().toISOString(), amount: target.monthlyPayment }
            ]
        };

        const updatedList = financings.map(f => (f.id === id || f.dbId === id) ? updatedTarget : f);
        setFinancings(updatedList);
        localStorage.setItem(`finance_financings_${userEmail}`, JSON.stringify(updatedList));

        if (target.dbId) {
            await supabase.from('transactions').update({
                note: JSON.stringify(updatedTarget)
            }).eq('id', target.dbId);
        }

        window.dispatchEvent(new Event('financings_updated'));
        window.dispatchEvent(new Event('wallet_updated'));

        if (typeof createTxCallback === 'function') {
            createTxCallback({
                desc: `Parcela (${nextInstallmentNum}/${target.totalInstallments}) - ${target.name}`,
                amount: target.monthlyPayment,
                type: 'expense',
                category: 'housing',
                account: target.account || 'checking',
                date: new Date().toISOString().split('T')[0]
            });
        }
    }, [userEmail, financings]);

    return {
        financings,
        loading,
        addFinancing,
        removeFinancing,
        payInstallment
    };
}
