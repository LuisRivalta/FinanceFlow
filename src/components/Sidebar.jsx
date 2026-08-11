"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '../hooks/useSession';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function LogoIcon() {
    return (
        <div className="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        </div>
    );
}

export default function Sidebar() {
    const pathName = usePathname();
    const session = useSession();
    const router = useRouter();

    const [userName, setUserName] = useState('Usuário');
    const [avatarSrc, setAvatarSrc] = useState(null);
    const [initials, setInitials] = useState('--');

    // Sidebar collapsed (desktop) & mobile open states
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    useEffect(() => {
        const savedCollapsed = localStorage.getItem('finance_sidebar_collapsed') === 'true';
        setIsCollapsed(savedCollapsed);
        if (savedCollapsed) {
            document.body.classList.add('sidebar-collapsed');
        } else {
            document.body.classList.remove('sidebar-collapsed');
        }
    }, []);

    useEffect(() => {
        const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}');
        const name = prefs.name || session?.name || 'Usuário';
        setUserName(name);
        setInitials(name.substring(0, 2).toUpperCase());

        const userEmail = session?.email;
        const cacheKey = userEmail ? `finance_avatar_${userEmail}` : null;
        const cachedPhoto = cacheKey ? localStorage.getItem(cacheKey) : null;
        if (cachedPhoto) setAvatarSrc(cachedPhoto);

        if (userEmail) {
            supabase.from('users').select('avatar_url').eq('email', userEmail).maybeSingle()
                .then(({ data }) => {
                    if (data?.avatar_url) {
                        setAvatarSrc(data.avatar_url);
                        if (cacheKey) localStorage.setItem(cacheKey, data.avatar_url);
                    }
                })
                .catch(() => {});
        }
    }, [session]);

    // Close mobile menu when page changes
    useEffect(() => {
        setIsMobileOpen(false);
    }, [pathName]);

    const toggleCollapse = () => {
        const next = !isCollapsed;
        setIsCollapsed(next);
        localStorage.setItem('finance_sidebar_collapsed', String(next));
        if (next) {
            document.body.classList.add('sidebar-collapsed');
        } else {
            document.body.classList.remove('sidebar-collapsed');
        }
    };

    const roleLabel = session?.role === 'admin'
        ? <span>👑 <strong>Admin</strong></span>
        : 'Premium';

    return (
        <>
            {/* Mobile Sticky Top Header */}
            <header className="mobile-header">
                <button
                    type="button"
                    className="mobile-hamburger-btn"
                    onClick={() => setIsMobileOpen(!isMobileOpen)}
                    aria-label="Abrir menu"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <div className="mobile-logo">
                    <LogoIcon />
                    <span className="mobile-logo-text">Blumii</span>
                </div>
                <Link href="/profile" className="mobile-avatar-link">
                    <div
                        className="avatar avatar-sm"
                        style={avatarSrc ? {
                            backgroundImage: `url('${avatarSrc}')`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center'
                        } : {}}
                    >
                        {!avatarSrc && initials}
                    </div>
                </Link>
            </header>

            {/* Mobile Backdrop Overlay */}
            {isMobileOpen && (
                <div
                    className="sidebar-overlay"
                    onClick={() => setIsMobileOpen(false)}
                />
            )}

            {/* Main Sidebar (Desktop Collapsible & Mobile Slide-over Drawer) */}
            <header className={`sidebar glass-panel ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
                {/* Logo & Retract Toggle Button */}
                <div className="logo">
                    <LogoIcon />
                    <h1 className="logo-text">Blumii</h1>

                    {/* Toggle Button for Desktop */}
                    <button
                        type="button"
                        className="sidebar-collapse-btn"
                        onClick={toggleCollapse}
                        title={isCollapsed ? "Expandir menu" : "Recolher menu"}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}>
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>

                    {/* Close Button for Mobile Drawer */}
                    <button
                        type="button"
                        className="sidebar-mobile-close"
                        onClick={() => setIsMobileOpen(false)}
                        aria-label="Fechar menu"
                    >
                        ✕
                    </button>
                </div>

                {/* Navigation Links */}
                <nav className="nav-menu">
                    <Link href="/" className={`nav-item ${pathName === '/' ? 'active' : ''}`} title="Visão Geral">
                        <span className="icon">📊</span>
                        <span className="nav-text">Visão Geral</span>
                    </Link>
                    <Link href="/charts" className={`nav-item ${pathName === '/charts' ? 'active' : ''}`} title="Dashboard">
                        <span className="icon">📈</span>
                        <span className="nav-text">Dashboard</span>
                    </Link>
                    <Link href="/roadmap" className={`nav-item ${pathName === '/roadmap' ? 'active' : ''}`} title="Roteiro">
                        <span className="icon">🗺️</span>
                        <span className="nav-text">Roteiro</span>
                    </Link>
                    <Link href="/investments" className={`nav-item ${pathName === '/investments' ? 'active' : ''}`} title="Investimentos">
                        <span className="icon">🏦</span>
                        <span className="nav-text">Investimentos</span>
                    </Link>
                    <Link href="/receivables" className={`nav-item ${pathName === '/receivables' ? 'active' : ''}`} title="Contas a Receber">
                        <span className="icon">💰</span>
                        <span className="nav-text">Contas a Receber</span>
                    </Link>
                    <Link href="/cards" className={`nav-item ${pathName === '/cards' ? 'active' : ''}`} title="Crédito & Dívidas">
                        <span className="icon">💳</span>
                        <span className="nav-text">Crédito & Dívidas</span>
                    </Link>
                    <Link href="/profile" className={`nav-item ${pathName === '/profile' ? 'active' : ''}`} title="Perfil">
                        <span className="icon">👤</span>
                        <span className="nav-text">Perfil</span>
                    </Link>
                    {session?.role === 'admin' && (
                        <Link href="/admin" className={`nav-item ${pathName === '/admin' ? 'active' : ''}`} title="Admin">
                            <span className="icon">🛡️</span>
                            <span className="nav-text">Admin</span>
                        </Link>
                    )}
                </nav>

                {/* User Profile Section */}
                <div className="user-profile">
                    <div className="user-profile-row">
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
                        className="profile-shortcut-btn"
                        title="Meu Perfil"
                    >
                        <span>👤</span>
                        <span className="profile-btn-text">Meu Perfil</span>
                    </Link>
                </div>
            </header>
        </>
    );
}
