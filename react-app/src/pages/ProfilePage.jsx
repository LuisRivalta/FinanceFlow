import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useSession, saveSession } from '../hooks/useSession'
import { supabase } from '../lib/supabase'

export default function ProfilePage() {
    const session = useSession()
    const navigate = useNavigate()

    const [displayName, setDisplayName] = useState('')
    const [editMode, setEditMode] = useState(false)
    const [nameInput, setNameInput] = useState('')
    const [saving, setSaving] = useState(false)
    const [avatarSrc, setAvatarSrc] = useState(null)
    const [initials, setInitials] = useState('--')
    const [pwdSent, setPwdSent] = useState(false)
    const [pwdLoading, setPwdLoading] = useState(false)
    const fileInputRef = useRef(null)

    useEffect(() => {
        const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}')
        const name = prefs.name || session?.name || 'Usuário'
        setDisplayName(name)
        setInitials(name.substring(0, 2).toUpperCase())

        const savedPhoto = localStorage.getItem('finance_avatar')
        if (savedPhoto) setAvatarSrc(savedPhoto)
    }, [session])

    function handleAvatarClick() {
        fileInputRef.current?.click()
    }

    function handleFileChange(e) {
        const file = e.target.files[0]
        if (!file) return
        if (file.size > 2 * 1024 * 1024) { alert('⚠️ Imagem muito grande! Max 2MB.'); return }
        const reader = new FileReader()
        reader.onload = ev => {
            const base64 = ev.target.result
            localStorage.setItem('finance_avatar', base64)
            setAvatarSrc(base64)
        }
        reader.readAsDataURL(file)
    }

    async function handleSaveName() {
        const newName = nameInput.trim()
        if (!newName) { alert('O nome não pode ficar vazio!'); return }
        setSaving(true)

        const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}')
        prefs.name = newName
        localStorage.setItem('finance_settings', JSON.stringify(prefs))

        const sess = JSON.parse(sessionStorage.getItem('finance_auth_session') || '{}')
        sess.name = newName
        saveSession(sess)

        try {
            await supabase.from('users').update({ name: newName }).eq('email', session?.email)
        } catch (e) { console.warn('Name update error', e) }

        setDisplayName(newName)
        setInitials(newName.substring(0, 2).toUpperCase())
        setEditMode(false)
        setSaving(false)
    }

    async function handleResetPwd() {
        setPwdLoading(true)
        setPwdSent(false)
        const { error } = await supabase.auth.resetPasswordForEmail(session?.email)
        if (error) alert('Erro: ' + error.message)
        else setPwdSent(true)
        setPwdLoading(false)
    }

    function handleLogout() {
        sessionStorage.removeItem('finance_auth_session')
        navigate('/login')
    }

    const isAdmin = session?.role === 'admin'
    const roleBadge = isAdmin ? '👑 Administrador ✦' : 'Nível Premium ✶'

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />

                <main className="main-content">
                    <header className="top-header fade-up">
                        <div>
                            <h2 className="page-title">Meu Perfil</h2>
                            <p className="page-subtitle">Gerencie suas credenciais e configurações de conta.</p>
                        </div>
                        <button className="btn-primary" onClick={() => navigate('/')} style={{ textDecoration: 'none' }}>
                            ← Voltar ao App
                        </button>
                    </header>

                    <section className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24 }}>
                        {/* Left: Avatar card */}
                        <div className="glass-panel" style={{ padding: 40, textAlign: 'center', height: 'fit-content' }}>
                            <input type="file" ref={fileInputRef} accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

                            {/* Avatar */}
                            <div
                                onClick={handleAvatarClick}
                                style={{ width: 120, height: 120, borderRadius: '50%', background: avatarSrc ? 'none' : 'linear-gradient(135deg, var(--accent-primary), #ec4899)', color: 'white', fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, margin: '0 auto 24px', boxShadow: '0 10px 25px var(--accent-glow)', position: 'relative', overflow: 'hidden', cursor: 'pointer', backgroundImage: avatarSrc ? `url('${avatarSrc}')` : 'none', backgroundSize: 'cover', backgroundPosition: 'center' }}
                            >
                                {!avatarSrc && initials}
                                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s', fontSize: 22, gap: 4 }}
                                    onMouseOver={e => e.currentTarget.style.opacity = '1'}
                                    onMouseOut={e => e.currentTarget.style.opacity = '0'}>
                                    📷<span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Alterar</span>
                                </div>
                            </div>

                            {/* Name edit */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 8 }}>
                                {editMode ? (
                                    <>
                                        <input
                                            type="text"
                                            value={nameInput}
                                            onChange={e => setNameInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditMode(false) }}
                                            style={{ fontSize: 22, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid var(--panel-border)', borderRadius: 10, color: 'white', padding: '6px 14px', textAlign: 'center', fontFamily: 'inherit', width: '100%' }}
                                            autoFocus
                                        />
                                        <button onClick={handleSaveName} disabled={saving} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--panel-border)', borderRadius: 8, color: 'var(--success-color)', cursor: 'pointer', padding: '6px 10px', fontSize: 16 }}>
                                            {saving ? '⏳' : '✓'}
                                        </button>
                                        <button onClick={() => setEditMode(false)} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--panel-border)', borderRadius: 8, color: 'var(--danger-color)', cursor: 'pointer', padding: '6px 10px', fontSize: 16 }}>✕</button>
                                    </>
                                ) : (
                                    <>
                                        <h2 style={{ fontSize: 28, margin: 0 }}>{displayName}</h2>
                                        <button onClick={() => { setNameInput(displayName); setEditMode(true) }} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--panel-border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px 10px', fontSize: 16 }}>✏️</button>
                                    </>
                                )}
                            </div>

                            <p style={{ color: 'var(--text-secondary)', fontSize: 16, marginBottom: 24, marginTop: 4 }}>{session?.email}</p>

                            <div style={{ display: 'inline-block', background: isAdmin ? 'rgba(99,102,241,0.1)' : 'rgba(16,185,129,0.1)', color: isAdmin ? 'var(--accent-primary)' : 'var(--success-color)', padding: '8px 16px', borderRadius: 20, fontWeight: 600, border: `1px solid ${isAdmin ? 'rgba(99,102,241,0.3)' : 'rgba(16,185,129,0.3)'}`, fontSize: 14 }}>
                                {roleBadge}
                            </div>
                        </div>

                        {/* Right cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            {/* Password Reset */}
                            <div className="glass-panel" style={{ padding: 32 }}>
                                <h3>Segurança de Acesso</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15, marginTop: 8 }}>
                                    Solicite um link de segurança para alterar a sua senha de acesso na nuvem.
                                </p>
                                <button className="btn-primary" onClick={handleResetPwd} disabled={pwdLoading}>
                                    <span className="icon">{pwdLoading ? '⏳' : '✉️'}</span>
                                    {pwdLoading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                                </button>
                                {pwdSent && (
                                    <p style={{ color: 'var(--success-color)', marginTop: 16, background: 'rgba(16,185,129,0.1)', padding: 12, borderRadius: 8, border: '1px solid rgba(16,185,129,0.3)', fontSize: 14 }}>
                                        E-mail de redefinição enviado com sucesso! Verifique sua caixa de entrada.
                                    </p>
                                )}
                            </div>

                            {/* Admin card */}
                            {isAdmin && (
                                <div className="glass-panel" style={{ padding: 32, borderColor: 'rgba(99,102,241,0.3)' }}>
                                    <h3 style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: 10 }}>
                                        🛡️ Painel de Administração
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15, marginTop: 8 }}>
                                        Gerencie usuários, atribua cargos e controle acessos da plataforma.
                                    </p>
                                    <button className="btn-primary" onClick={() => navigate('/admin')}>
                                        <span>🛡️</span> Acessar Painel Admin
                                    </button>
                                </div>
                            )}

                            {/* Logout */}
                            <div className="glass-panel" style={{ padding: 32, borderColor: 'rgba(239,68,68,0.2)' }}>
                                <h3 style={{ color: 'var(--danger-color)' }}>Encerrar Sessão Ativa</h3>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15, marginTop: 8 }}>
                                    Desconectar da sua conta com segurança no dispositivo atual.
                                </p>
                                <button className="btn-outline-danger" style={{ width: '100%' }} onClick={handleLogout}>
                                    Sair do Aplicativo
                                </button>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    )
}
