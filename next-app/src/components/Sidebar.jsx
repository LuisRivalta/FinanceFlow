"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, clearSession } from '../hooks/useSession'
import { useEffect, useState } from 'react'

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
    const navigate = useRouter()
    const [userName, setUserName] = useState('Usuário')
    const [avatarSrc, setAvatarSrc] = useState(null)
    const [initials, setInitials] = useState('--')

    useEffect(() => {
        const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}')
        const name = prefs.name || session?.name || 'Usuário'
        setUserName(name)
        setInitials(name.substring(0, 2).toUpperCase())

        const savedPhoto = localStorage.getItem('finance_avatar')
        if (savedPhoto) setAvatarSrc(savedPhoto)
    }, [session])

    function handleLogout() {
        clearSession()
        navigate('/login')
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
                <Link href="/" end className={`nav-item ${pathName === '$1' ? 'active' : ''}`}>
                    <span className="icon">📊</span> Dashboard
                </Link>
                <Link href="/charts" className={`nav-item ${pathName === '$1' ? 'active' : ''}`}>
                    <span className="icon">📈</span> Gráficos
                </Link>
                <Link href="/profile" className={`nav-item ${pathName === '$1' ? 'active' : ''}`}>
                    <span className="icon">👤</span> Perfil
                </Link>
                {session?.role === 'admin' && (
                    <Link href="/admin" className={`nav-item ${pathName === '$1' ? 'active' : ''}`}>
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
                    <button
                        onClick={handleLogout}
                        title="Sair / Logout"
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', position: 'absolute', right: 0, fontSize: 20, transition: 'color 0.3s ease' }}
                    >
                        🚪
                    </button>
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
