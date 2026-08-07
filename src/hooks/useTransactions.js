"use client";

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { mapFromDB } from '../helpers'

export function useTransactions(userEmail) {
    const [transactions, setTransactions] = useState([])
    const [loading, setLoading] = useState(false)

    const load = useCallback(async () => {
        if (!userEmail) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('user_email', userEmail)
                .order('date', { ascending: false })

            if (!error && data) {
                const userOnlyTxs = data
                    .map(mapFromDB)
                    .filter(t => t.category !== 'system_asset' && t.category !== 'system_financing' && t.type !== 'system');
                setTransactions(userOnlyTxs);
            }
        } finally {
            setLoading(false)
        }
    }, [userEmail])

    useEffect(() => {
        if (!userEmail) return
        load()
        const handleRefresh = () => load()
        window.addEventListener('transaction_created', handleRefresh)
        window.addEventListener('wallet_updated', handleRefresh)
        return () => {
            window.removeEventListener('transaction_created', handleRefresh)
            window.removeEventListener('wallet_updated', handleRefresh)
        }
    }, [userEmail, load])

    const create = useCallback(async (payload) => {
        let rows = []
        if (payload.installmentTotal > 1 && !payload.installmentNumber) {
            // Gera parcelas
            for (let i = 1; i <= payload.installmentTotal; i++) {
                const dateObj = new Date(payload.date + 'T00:00:00')
                dateObj.setMonth(dateObj.getMonth() + (i - 1))
                const y = dateObj.getFullYear()
                const m = String(dateObj.getMonth() + 1).padStart(2, '0')
                const d = String(dateObj.getDate()).padStart(2, '0')

                rows.push({
                    user_email: userEmail,
                    description: `${payload.desc} (${i}/${payload.installmentTotal})`,
                    amount: payload.amount,
                    type: payload.type,
                    category: payload.category,
                    account: payload.account || null,
                    date: `${y}-${m}-${d}`,
                    note: payload.note || null,
                    is_recurring: false,
                    recurring_duration: null,
                    parent_id: payload.parentId || null,
                    credit_card_id: payload.creditCardId || null,
                    is_subscription: false,
                    installment_number: i,
                    installment_total: payload.installmentTotal
                })
            }
        } else {
            rows.push({
                user_email: userEmail,
                description: payload.desc,
                amount: payload.amount,
                type: payload.type,
                category: payload.category,
                account: payload.account || null,
                date: payload.date,
                note: payload.note || null,
                is_recurring: payload.isRecurring || false,
                recurring_duration: payload.recurringDuration || null,
                parent_id: payload.parentId || null,
                credit_card_id: payload.creditCardId || null,
                is_subscription: payload.isSubscription || false,
                installment_number: payload.installmentNumber || null,
                installment_total: payload.installmentTotal || null
            })
        }

        const { data, error } = await supabase.from('transactions').insert(rows).select()
        if (error) throw error

        const newTxs = data.map(mapFromDB)
        setTransactions(prev => [...newTxs, ...prev])
        return newTxs[0]
    }, [userEmail])

    const update = useCallback(async (id, payload) => {
        const row = {
            description: payload.desc,
            amount: payload.amount,
            type: payload.type,
            category: payload.category,
            account: payload.account || null,
            date: payload.date,
            note: payload.note || null,
            is_recurring: payload.isRecurring || false,
            recurring_duration: payload.recurringDuration || null,
            credit_card_id: payload.creditCardId || null,
            is_subscription: payload.isSubscription || false
        }

        const { data, error } = await supabase.from('transactions').update(row).eq('id', id).select().single()
        if (error) throw error

        const updated = mapFromDB(data)
        setTransactions(prev => prev.map(t => t.id === id ? updated : t))
        return updated
    }, [])

    const remove = useCallback(async (id, options = {}) => {
        if (!options.skipConfirm && !confirm('Excluir esta transação definitivamente?')) return
        setTransactions(prev => prev.filter(t => t.id !== id))
        await supabase.from('transactions').delete().eq('id', id)
    }, [])

    return { transactions, loading, load, create, update, remove }
}
