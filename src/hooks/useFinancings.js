"use client";

import { useState, useEffect, useCallback } from 'react';

export function useFinancings(userEmail) {
    const [financings, setFinancings] = useState([]);

    useEffect(() => {
        if (!userEmail) return;
        const loadFinancings = () => {
            const saved = localStorage.getItem(`finance_financings_${userEmail}`);
            if (saved) {
                try {
                    setFinancings(JSON.parse(saved));
                } catch (e) {
                    console.error("Error loading financings", e);
                }
            } else {
                setFinancings([]);
            }
        };
        loadFinancings();

        window.addEventListener('storage', loadFinancings);
        window.addEventListener('financings_updated', loadFinancings);
        return () => {
            window.removeEventListener('storage', loadFinancings);
            window.removeEventListener('financings_updated', loadFinancings);
        };
    }, [userEmail]);

    const saveFinancings = useCallback((newList) => {
        if (!userEmail) return;
        setFinancings(newList);
        localStorage.setItem(`finance_financings_${userEmail}`, JSON.stringify(newList));
        window.dispatchEvent(new Event('financings_updated'));
        window.dispatchEvent(new Event('wallet_updated'));
    }, [userEmail]);

    const addFinancing = useCallback((item) => {
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

        saveFinancings([...financings, newItem]);
    }, [financings, saveFinancings]);

    const removeFinancing = useCallback((id) => {
        saveFinancings(financings.filter(f => f.id !== id));
    }, [financings, saveFinancings]);

    const payInstallment = useCallback((id, createTxCallback) => {
        const target = financings.find(f => f.id === id);
        if (!target) return;
        if (target.paidInstallments >= target.totalInstallments) {
            alert('Este financiamento já está 100% quitado!');
            return;
        }

        const nextInstallmentNum = target.paidInstallments + 1;
        const updatedList = financings.map(f => {
            if (f.id === id) {
                return {
                    ...f,
                    paidInstallments: nextInstallmentNum,
                    history: [
                        ...(f.history || []),
                        { installment: nextInstallmentNum, date: new Date().toISOString(), amount: f.monthlyPayment }
                    ]
                };
            }
            return f;
        });

        saveFinancings(updatedList);

        // Optionally create transaction expense entry
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
    }, [financings, saveFinancings]);

    return {
        financings,
        addFinancing,
        removeFinancing,
        payInstallment
    };
}
