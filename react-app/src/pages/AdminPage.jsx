import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import { useSession } from '../hooks/useSession'
import { supabase } from '../lib/supabase'

export default function AdminPage() {
    const session = useSession()
    const navigate = useNavigate()
    const [users, setUsers] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!session) return
        if (session.role !== 'admin') {
            alert('⛔ Acesso Restrito. Você não possui privilégios de Administrador.')
            navigate('/')
            return
        }
        loadUsers()
    }, [session])

    async function loadUsers() {
        setLoading(true)
        setError('')
        const { data, error } = await supabase.from('users').select('*').order('name')
        if (error) {
            setError('Erro ao carregar usuários: ' + error.message)
        } else {
            setUsers(data || [])
        }
        setLoading(false)
    }

    async function toggleRole(userId, currentRole) {
        const newRole = currentRole === 'admin' ? 'user' : 'admin'
        await supabase.from('users').update({ role: newRole }).eq('id', userId)
        loadUsers()
    }

    async function toggleStatus(userId, currentStatus) {
        const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked'
        await supabase.from('users').update({ status: newStatus }).eq('id', userId)
        loadUsers()
    }

    async function deleteUser(userId, userEmail) {
        if (!confirm(`ATENÇÃO: Deseja apagar o perfil e o histórico de ${userEmail}?\nIsso apagará todas as transações desse usuário!`)) return
        await supabase.from('users').delete().eq('id', userId)
        await supabase.from('transactions').delete().eq('user_email', userEmail)
        loadUsers()
    }

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />

                <main className="main-content">
                    <header className="top-header fade-up">
                        <div>
                            <h2 className="page-title">🛡️ Painel Admin</h2>
                            <p className="page-subtitle">Gerencie usuários, cargos e acessos da plataforma.</p>
                        </div>
                        <button className="btn-primary" onClick={() => navigate('/profile')}>
                            ← Voltar ao Perfil
                        </button>
                    </header>

                    <section className="glass-panel fade-up delay-1" style={{ padding: 32 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                            <h3 style={{ fontSize: 20, fontWeight: 600 }}>Usuários Registrados</h3>
                            <button onClick={loadUsers} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px 16px', borderRadius: 8, fontFamily: 'inherit', fontSize: 13 }}>
                                🔄 Atualizar
                            </button>
                        </div>

                        {error && (
                            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger-color)', padding: 16, borderRadius: 10, marginBottom: 16 }}>
                                {error}
                            </div>
                        )}

                        {loading ? (
                            <div style={{ textAlign: 'center', padding: 40 }}>
                                <div className="spinner" style={{ margin: '0 auto' }} />
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'inherit' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                                            {['Nome', 'E-mail', 'Cargo', 'Status', 'Ações'].map(h => (
                                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>
                                                    Nenhum usuário encontrado.
                                                </td>
                                            </tr>
                                        ) : users.map(u => {
                                            const isMe = u.email === session?.email
                                            return (
                                                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                                                    onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                    <td style={{ padding: '14px 16px', fontWeight: 500, color: 'white', fontSize: 14 }}>
                                                        {u.name} {isMe && <i style={{ color: 'var(--text-secondary)', fontSize: 12 }}>(Você)</i>}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: 14 }}>{u.email}</td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: u.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.06)', color: u.role === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)', border: `1px solid ${u.role === 'admin' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)'}` }}>
                                                            {u.role === 'admin' ? '👑 Administrador' : 'Membro'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: u.status === 'blocked' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)', color: u.status === 'blocked' ? 'var(--danger-color)' : 'var(--success-color)', border: `1px solid ${u.status === 'blocked' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}` }}>
                                                            {u.status === 'blocked' ? '🚫 Bloqueado' : '✅ Ativo'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        {isMe ? (
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Seu Próprio Usuário</span>
                                                        ) : (
                                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                                <ActionBtn onClick={() => toggleRole(u.id, u.role)}>
                                                                    🔑 {u.role === 'admin' ? 'Remover Admin' : 'Dar Admin'}
                                                                </ActionBtn>
                                                                <ActionBtn onClick={() => toggleStatus(u.id, u.status)}>
                                                                    {u.status === 'blocked' ? '✅ Desbloquear' : '🚫 Bloquear'}
                                                                </ActionBtn>
                                                                <ActionBtn danger onClick={() => deleteUser(u.id, u.email)}>
                                                                    🗑️ Excluir
                                                                </ActionBtn>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    )
}

function ActionBtn({ children, onClick, danger }) {
    return (
        <button
            onClick={onClick}
            style={{ background: danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)', border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`, color: danger ? 'var(--danger-color)' : 'var(--text-secondary)', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', fontWeight: 600, transition: 'all 0.15s', whiteSpace: 'nowrap' }}
            onMouseOver={e => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = danger ? 'var(--danger-color)' : 'white' }}
            onMouseOut={e => { e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = danger ? 'var(--danger-color)' : 'var(--text-secondary)' }}
        >
            {children}
        </button>
    )
}
