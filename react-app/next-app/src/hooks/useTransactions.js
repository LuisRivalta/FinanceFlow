"use client";

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { mapFromDB } from '../lib/utils'

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
                setTransactions(data.map(mapFromDB))
            }
        } finally {
            setLoading(false)
        }
    }, [userEmail])

    const create = useCallback(async (payload) => {
        const row = {
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
            parent_id: payload.parentId || null
        }

        let { data, error } = await supabase.from('transactions').insert([row]).select().single()

        // Fallback sem campos novos caso schema antigo
        if (error && error.message && (error.message.includes('account') || error.message.includes('note'))) {
            const fallback = { ...row }
            delete fallback.account
            delete fallback.note
            const res = await supabase.from('transactions').insert([fallback]).select().single()
            if (res.error) throw res.error
            data = res.data
        } else if (error) {
            throw error
        }

        const newTx = mapFromDB(data)
        setTransactions(prev => [newTx, ...prev])
        return newTx
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
            recurring_duration: payload.recurringDuration || null
        }

        const { data, error } = await supabase.from('transactions').update(row).eq('id', id).select().single()
        if (error) throw error

        const updated = mapFromDB(data)
        setTransactions(prev => prev.map(t => t.id === id ? updated : t))
        return updated
    }, [])

    const remove = useCallback(async (id) => {
        if (!confirm('Excluir esta transação definitivamente?')) return
        setTransactions(prev => prev.filter(t => t.id !== id))
        await supabase.from('transactions').delete().eq('id', id)
    }, [])

    return { transactions, loading, load, create, update, remove }
}
