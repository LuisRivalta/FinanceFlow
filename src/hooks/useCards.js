"use client";

import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useCreditCards(userEmail) {
    const [cards, setCards] = useState([])
    const [loading, setLoading] = useState(false)

    const load = useCallback(async () => {
        if (!userEmail) return
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('credit_cards')
                .select('*')
                .eq('user_email', userEmail)
                .order('name')

            if (!error && data) {
                setCards(data)
            }
        } finally {
            setLoading(false)
        }
    }, [userEmail])

    useEffect(() => {
        load()
    }, [load])

    const create = useCallback(async (payload) => {
        const row = {
            user_email: userEmail,
            name: payload.name,
            brand: payload.brand || 'outros',
            credit_limit: payload.limit,
            closing_day: payload.closingDay,
            due_day: payload.dueDay,
            color: payload.color || '#3b82f6'
        }
        const { data, error } = await supabase.from('credit_cards').insert([row]).select().single()
        if (error) throw error
        setCards(prev => [...prev, data])
        return data
    }, [userEmail])

    const update = useCallback(async (id, payload) => {
        const row = {
            name: payload.name,
            brand: payload.brand || 'outros',
            credit_limit: payload.limit,
            closing_day: payload.closingDay,
            due_day: payload.dueDay,
            color: payload.color || '#3b82f6'
        }
        const { data, error } = await supabase.from('credit_cards').update(row).eq('id', id).select().single()
        if (error) throw error
        setCards(prev => prev.map(c => c.id === id ? data : c))
        return data
    }, [])

    const remove = useCallback(async (id) => {
        if (!confirm('Excluir este cartão?')) return
        setCards(prev => prev.filter(c => c.id !== id))
        await supabase.from('credit_cards').delete().eq('id', id)
    }, [])

    return { cards, loading, load, create, update, remove }
}
