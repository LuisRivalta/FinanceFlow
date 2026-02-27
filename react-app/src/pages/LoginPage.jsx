import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { saveSession } from '../hooks/useSession'
import { useSession } from '../hooks/useSession'
import { useEffect } from 'react'

function LogoIcon({ size = 24 }) {
    return (
        <div className="logo-icon" style={{ width: size * 2, height: size * 2 }}>
            <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
        </div>
    )
}

export default function LoginPage() {
    const navigate = useNavigate()
    const session = useSession()

    useEffect(() => {
        if (session) navigate('/')
    }, [session, navigate])

    const [activeTab, setActiveTab] = useState('login')
    const [loading, setLoading] = useState(false)
    const [loginError, setLoginError] = useState('')
    const [registerError, setRegisterError] = useState('')
    const [otpStep, setOtpStep] = useState(false)
    const [otpEmail, setOtpEmail] = useState('')
    const [otpName, setOtpName] = useState('')
    const [otpCode, setOtpCode] = useState('')
    const [otpError, setOtpError] = useState('')

    // ---- LOGIN ----
    async function handleLogin(e) {
        e.preventDefault()
        setLoginError('')
        setLoading(true)
        const email = e.target['login-email'].value
        const password = e.target['login-password'].value

        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })

            let role = 'user'
            let name = 'Usuário'

            if (authError) {
                // Fallback para tabela users manual
                const { data: usersData, error } = await supabase.from('users').select('*').eq('email', email).eq('password', password)

                if (error || !usersData || usersData.length === 0) {
                    let msg = 'Credenciais inválidas ou e-mail não confirmado.'
                    if (authError.message?.includes('Email not confirmed')) msg = 'E-mail ainda não confirmado! Verifique sua caixa de entrada.'
                    setLoginError(msg)
                    setLoading(false)
                    return
                }

                const validUser = usersData[0]
                if (validUser.status === 'blocked') { setLoginError('Conta bloqueada pelo Administrador.'); setLoading(false); return }

                role = validUser.role || 'user'
                name = validUser.name
                const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}')
                prefs.name = name
                localStorage.setItem('finance_settings', JSON.stringify(prefs))
                saveSession({ email, name, role })
                navigate('/')
                return
            }

            const user = authData.user
            name = user.user_metadata?.name || 'Usuário'

            const { data: dbUser } = await supabase.from('users').select('*').eq('email', user.email).maybeSingle()

            if (dbUser) {
                if (dbUser.status === 'blocked') { setLoginError('Conta bloqueada pelo Administrador.'); setLoading(false); return }
                role = dbUser.role || 'user'
                name = dbUser.name || name
            } else {
                await supabase.from('users').insert([{ email: user.email, name, password: 'OAUTH', role: 'user', status: 'active' }])
            }

            const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}')
            prefs.name = name
            localStorage.setItem('finance_settings', JSON.stringify(prefs))
            saveSession({ email: user.email, name, role })
            navigate('/')
        } catch (err) {
            setLoginError('Falha crítica: ' + String(err))
        }
        setLoading(false)
    }

    // ---- REGISTRO ----
    async function handleRegister(e) {
        e.preventDefault()
        setRegisterError('')
        setLoading(true)
        const name = e.target['reg-name'].value
        const email = e.target['reg-email'].value
        const password = e.target['reg-password'].value

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) { setRegisterError('E-mail inválido.'); setLoading(false); return }

        const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*()_\-+=~`<>,.?/{}[\]|\\:;"']).{8,}$/
        if (!passwordRegex.test(password)) {
            setRegisterError('A senha deve ter no mínimo 8 caracteres, incluindo 1 número e 1 caractere especial.')
            setLoading(false)
            return
        }

        try {
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email, password, options: { data: { name } }
            })

            if (authError) { setRegisterError('Erro: ' + authError.message); setLoading(false); return }

            if (authData.session) {
                const user = authData.user
                await supabase.from('users').upsert([{ email: user.email, name, password: 'OAUTH', role: 'user', status: 'active' }], { onConflict: 'email' })
                const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}')
                prefs.name = name
                localStorage.setItem('finance_settings', JSON.stringify(prefs))
                saveSession({ email: user.email, name, role: 'user' })
                navigate('/')
            } else {
                setOtpEmail(email)
                setOtpName(name)
                setOtpStep(true)
            }
        } catch (err) {
            setRegisterError('Erro crítico: ' + String(err))
        }
        setLoading(false)
    }

    // ---- OTP ----
    async function handleOtp(e) {
        e.preventDefault()
        setOtpError('')
        setLoading(true)

        try {
            const { data, error } = await supabase.auth.verifyOtp({ email: otpEmail, token: otpCode, type: 'signup' })
            if (error) { setOtpError('Código inválido ou expirado.'); setLoading(false); return }

            let role = 'user'
            const { data: dbUser } = await supabase.from('users').select('*').eq('email', otpEmail).maybeSingle()
            if (dbUser) {
                if (dbUser.status === 'blocked') { setOtpError('Conta bloqueada.'); setLoading(false); return }
                role = dbUser.role || 'user'
            } else {
                await supabase.from('users').insert([{ email: otpEmail, name: otpName, password: 'OAUTH', role: 'user', status: 'active' }])
            }

            const prefs = JSON.parse(localStorage.getItem('finance_settings') || '{}')
            prefs.name = otpName
            localStorage.setItem('finance_settings', JSON.stringify(prefs))
            saveSession({ email: otpEmail, name: otpName, role })
            navigate('/')
        } catch (err) {
            setOtpError('Erro: ' + String(err))
        }
        setLoading(false)
    }

    if (otpStep) {
        return (
            <div className="auth-container">
                <div className="bg-grid" />
                <div className="glass-panel auth-box">
                    <div className="auth-logo">
                        <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #6366f1, #818cf8)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                <polyline points="22,6 12,13 2,6" />
                            </svg>
                        </div>
                        <h1>Quase lá!</h1>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
                        Enviamos um código para:<br />
                        <strong style={{ color: 'white' }}>{otpEmail}</strong>
                    </p>
                    <form className="auth-form" onSubmit={handleOtp}>
                        {otpError && <div className="error-message">{otpError}</div>}
                        <div className="form-group">
                            <label>Código de Verificação</label>
                            <input
                                type="text"
                                placeholder="Ex: 12345678"
                                maxLength={8}
                                required
                                value={otpCode}
                                onChange={e => setOtpCode(e.target.value)}
                                style={{ fontSize: 24, textAlign: 'center', letterSpacing: 4 }}
                            />
                        </div>
                        <button type="submit" className="btn-primary full-width" disabled={loading} style={{ padding: 16, fontSize: 16 }}>
                            {loading ? 'Verificando...' : 'Confirmar E-mail'}
                        </button>
                    </form>
                    <button onClick={() => { setOtpStep(false); setOtpCode('') }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginTop: 8 }}>
                        ← Voltar
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="auth-container">
            <div className="bg-grid" />
            <div className="glass-panel auth-box">
                <div className="auth-logo">
                    <div style={{ width: 48, height: 48, background: 'linear-gradient(135deg, #6366f1, #818cf8)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(99,102,241,0.4)' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                        </svg>
                    </div>
                    <h1>FinanceFlow</h1>
                </div>

                <div className="auth-tabs">
                    <div className={'auth-tab' + (activeTab === 'login' ? ' active' : '')} onClick={() => { setActiveTab('login'); setLoginError('') }}>Entrar</div>
                    <div className={'auth-tab' + (activeTab === 'register' ? ' active' : '')} onClick={() => { setActiveTab('register'); setRegisterError('') }}>Cadastrar</div>
                </div>

                {/* Login */}
                <form className={'auth-form' + (activeTab !== 'login' ? ' hidden' : '')} onSubmit={handleLogin}>
                    {loginError && <div className="error-message">{loginError}</div>}
                    <div className="form-group">
                        <label>Endereço de E-mail</label>
                        <input type="email" name="login-email" placeholder="seu@email.com" required />
                    </div>
                    <div className="form-group">
                        <label>Senha</label>
                        <input type="password" name="login-password" placeholder="••••••••" required />
                    </div>
                    <button type="submit" className="btn-primary full-width" disabled={loading} style={{ padding: 16, fontSize: 16 }}>
                        {loading ? 'Conectando...' : 'Acessar Dashboard'}
                    </button>
                </form>

                {/* Register */}
                <form className={'auth-form' + (activeTab !== 'register' ? ' hidden' : '')} onSubmit={handleRegister}>
                    {registerError && <div className="error-message">{registerError}</div>}
                    <div className="form-group">
                        <label>Como devemos te chamar?</label>
                        <input type="text" name="reg-name" placeholder="Seu nome completo" required />
                    </div>
                    <div className="form-group">
                        <label>Endereço de E-mail</label>
                        <input type="email" name="reg-email" placeholder="seu@email.com" required />
                    </div>
                    <div className="form-group">
                        <label>Crie uma Senha seguríssima</label>
                        <input type="password" name="reg-password" placeholder="Mínimo de 8 caracteres (A-Z, 1 num, 1 esp)" required minLength={8} />
                    </div>
                    <button type="submit" className="btn-primary full-width" disabled={loading} style={{ padding: 16, fontSize: 16 }}>
                        {loading ? 'Criando...' : 'Criar Minha Conta'}
                    </button>
                </form>
            </div>
        </div>
    )
}
