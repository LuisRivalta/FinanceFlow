"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, clearSession } from '../hooks/useSession'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function LogoIcon() {
    return (
        <div className="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        </div>
    )
}

export default function Sidebar() {
    const pathName = usePathname();
    const session = useSession()
    const router = useRouter()
    const [userName, setUserName] = useState('Usuário')
    const [avatarSrc, setAvatarSrc] = useState(null)
    const [initials, setInitials] = useState('--')

    useEffect(() => {
        const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}')
        const name = prefs.name || session?.name || 'Usuário'
        setUserName(name)
        setInitials(name.substring(0, 2).toUpperCase())

        // Load avatar per-user: local cache first, then sync from Supabase
        const userEmail = session?.email
        const cacheKey = userEmail ? `finance_avatar_${userEmail}` : null
        const cachedPhoto = cacheKey ? localStorage.getItem(cacheKey) : null
        if (cachedPhoto) setAvatarSrc(cachedPhoto)

        if (userEmail) {
            supabase.from('users').select('avatar_url').eq('email', userEmail).maybeSingle()
                .then(({ data }) => {
                    if (data?.avatar_url) {
                        setAvatarSrc(data.avatar_url)
                        if (cacheKey) localStorage.setItem(cacheKey, data.avatar_url)
                    }
                })
                .catch(() => { /* use cached */ })
        }
    }, [session])

    function handleLogout() {
        clearSession()
        router.push('/login')
    }

    const roleLabel = session?.role === 'admin'
        ? <span>👑 <strong>Administrador</strong></span>
        : 'Premium'

    return (
        <header className="sidebar glass-panel">
            <div className="logo">
                <LogoIcon />
                <h1>FinanceFlow</h1>
            </div>

            <nav className="nav-menu">
                <Link href="/" className={`nav-item ${pathName === '/' ? 'active' : ''}`}>
                    <span className="icon">📊</span> Dashboard
                </Link>
                <Link href="/charts" className={`nav-item ${pathName === '/charts' ? 'active' : ''}`}>
                    <span className="icon">📈</span> Gráficos
                </Link>
                <Link href="/profile" className={`nav-item ${pathName === '/profile' ? 'active' : ''}`}>
                    <span className="icon">👤</span> Perfil
                </Link>
                {session?.role === 'admin' && (
                    <Link href="/admin" className={`nav-item ${pathName === '/admin' ? 'active' : ''}`}>
                        <span className="icon">🛡️</span> Admin
                    </Link>
                )}
            </nav>

            <div className="user-profile" style={{ position: 'relative', flexDirection: 'column', alignItems: 'stretch', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, position: 'relative' }}>
                    <div
                        className="avatar"
                        style={avatarSrc ? {
                            backgroundImage: `url('${avatarSrc}')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        } : {}}
                    >
                        {!avatarSrc && initials}
                    </div>
                    <div className="user-info">
                        <span className="user-name">{userName}</span>
                        <span className="user-role">{roleLabel}</span>
                    </div>
                </div>

                <Link
                    href="/profile"
                    style={{ textDecoration: 'none', padding: 10, fontSize: 14, borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', textAlign: 'center', border: '1px solid var(--panel-border)', transition: 'all 0.2s ease' }}
                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                >
                    👤 Meu Perfil
                </Link>
            </div>
        </header>
    )
}
