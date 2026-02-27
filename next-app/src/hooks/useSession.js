export function useSession() {
    const raw = sessionStorage.getItem('finance_auth_session')
    try {
        return raw ? JSON.parse(raw) : null
    } catch {
        return null
    }
}

export function saveSession(session) {
    sessionStorage.setItem('finance_auth_session', JSON.stringify(session))
}

export function clearSession() {
    sessionStorage.removeItem('finance_auth_session')
}
