import { useState, useEffect } from 'react'

export function useSession() {
    const [session, setSession] = useState(undefined)

    useEffect(() => {
        const raw = sessionStorage.getItem('finance_auth_session')
        try {
            setSession(raw ? JSON.parse(raw) : null)
        } catch {
            setSession(null)
        }
    }, [])

    return session
}

export function saveSession(session) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('finance_auth_session', JSON.stringify(session))
}

export function clearSession() {
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem('finance_auth_session')
    }
}
