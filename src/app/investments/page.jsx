"use client";

import { useEffect, useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '../../components/Sidebar'
import Wallet from '../../components/Wallet'
import NumberField from '../../components/NumberField'
import { useSession } from '../../hooks/useSession'
import { useTransactions } from '../../hooks/useTransactions'
import { useRates } from '../../hooks/useRates'
import { useWalletAssets } from '../../hooks/useWalletAssets'
import { INVESTMENT_PRODUCTS, DEFAULT_PRODUCT_ID, getProduct, deriveRate, multiplierLabel } from '../../lib/investmentProducts'
import { supabase } from '../../lib/supabase'
import { formatCurrency, formatPercent, calcInvestment, CATEGORY_MAP, ACCOUNTS } from '../../helpers'
import { Chart, ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler } from 'chart.js'


Chart.register(ArcElement, DoughnutController, LineElement, LineController, BarElement, BarController, PieController, PointElement, CategoryScale, LinearScale, Legend, Tooltip, Filler)

export default function InvestmentsPage() {
    const session = useSession()
    const router = useRouter()
    const { transactions, loading: txLoading } = useTransactions(session?.email)
    const { totalNetWorth: walletTotalNetWorth, calculateCurrentValue, assets: walletAssets, livePrices } = useWalletAssets(session?.email)

    // Saque / Resgate State
    const [saqueAssetId, setSaqueAssetId] = useState('')
    const [saqueVal, setSaqueVal] = useState('')
    const [saqueMode, setSaqueMode] = useState('brl') // 'brl' or 'units'
    const [saqueAccount, setSaqueAccount] = useState('checking')
    const [saqueDate, setSaqueDate] = useState(() => new Date().toISOString().split('T')[0])
    const [isSubmittingSaque, setIsSubmittingSaque] = useState(false)
    const [saqueMessage, setSaqueMessage] = useState(null)

    const selectedSaqueAsset = useMemo(() => {
        if (!Array.isArray(walletAssets) || walletAssets.length === 0) return null
        if (saqueAssetId) {
            const found = walletAssets.find(a => String(a.id) === String(saqueAssetId) || String(a.dbId) === String(saqueAssetId))
            if (found) return found
        }
        return walletAssets[0]
    }, [walletAssets, saqueAssetId])

    const handleSelectWithdrawAsset = (asset) => {
        if (!asset) return
        setSaqueAssetId(asset.id || asset.dbId)
        setSaqueMode(asset.type === 'crypto' || asset.type === 'currency' ? 'units' : 'brl')
        setSaqueVal('')
        setSaqueMessage(null)
        setTimeout(() => {
            const el = document.getElementById('saque-section')
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }, 50)
    }

    const saqueCalc = useMemo(() => {
        if (!selectedSaqueAsset) return null

        const currentVal = typeof calculateCurrentValue === 'function' ? calculateCurrentValue(selectedSaqueAsset) : 0
        const isCryptoOrCurr = selectedSaqueAsset.type === 'crypto' || selectedSaqueAsset.type === 'currency'

        const cleanT = (ticker) => {
            if (!ticker) return 'BTC'
            const upper = String(ticker).toUpperCase().trim()
            if (upper === 'BITCOIN') return 'BTC'
            if (upper === 'ETHEREUM') return 'ETH'
            if (upper === 'DOLAR' || upper === 'DÓLAR') return 'USD'
            if (upper === 'EURO') return 'EUR'
            return upper
        }

        const symbol = cleanT(selectedSaqueAsset.ticker)
        const priceBrl = livePrices?.[`${symbol}-BRL`] || (currentVal > 0 && selectedSaqueAsset.amount > 0 ? currentVal / selectedSaqueAsset.amount : 0)

        const typedNum = parseFloat(saqueVal) || 0
        let brlToWithdraw = 0
        let unitsToWithdraw = 0

        if (isCryptoOrCurr) {
            if (saqueMode === 'units') {
                unitsToWithdraw = typedNum
                brlToWithdraw = typedNum * priceBrl
            } else {
                brlToWithdraw = typedNum
                unitsToWithdraw = priceBrl > 0 ? typedNum / priceBrl : 0
            }
        } else {
            brlToWithdraw = typedNum
            unitsToWithdraw = null
        }

        const remainingVal = Math.max(0, currentVal - brlToWithdraw)
        const remainingUnits = isCryptoOrCurr ? Math.max(0, (selectedSaqueAsset.amount || 0) - unitsToWithdraw) : null

        return {
            currentVal,
            isCryptoOrCurr,
            priceBrl,
            brlToWithdraw,
            unitsToWithdraw,
            remainingVal,
            remainingUnits
        }
    }, [selectedSaqueAsset, saqueVal, saqueMode, calculateCurrentValue, livePrices])

    const handleExecuteSaque = async (e) => {
        e.preventDefault()
        if (!selectedSaqueAsset || !saqueCalc) return

        if (saqueCalc.brlToWithdraw <= 0) {
            setSaqueMessage({ type: 'error', text: 'Informe uma quantia ou valor válido para o saque.' })
            return
        }

        if (saqueCalc.brlToWithdraw > saqueCalc.currentVal + 0.01) {
            setSaqueMessage({
                type: 'error',
                text: `O valor do saque (${formatCurrency(saqueCalc.brlToWithdraw)}) excede o saldo atual do investimento (${formatCurrency(saqueCalc.currentVal)}).`
            })
            return
        }

        try {
            setIsSubmittingSaque(true)
            setSaqueMessage(null)

            let updatedAsset
            if (saqueCalc.isCryptoOrCurr) {
                const finalUnits = Math.max(0, Math.round(((selectedSaqueAsset.amount || 0) - saqueCalc.unitsToWithdraw) * 1e8) / 1e8)
                const finalManual = (selectedSaqueAsset.manualBalance !== undefined && selectedSaqueAsset.manualBalance !== null)
                    ? Math.max(0, Math.round((selectedSaqueAsset.manualBalance - saqueCalc.brlToWithdraw) * 100) / 100)
                    : null

                updatedAsset = {
                    ...selectedSaqueAsset,
                    amount: finalUnits,
                    manualBalance: finalManual
                }
            } else {
                const finalAmount = Math.max(0, Math.round(((selectedSaqueAsset.amount || 0) - saqueCalc.brlToWithdraw) * 100) / 100)
                const finalManual = (selectedSaqueAsset.manualBalance !== undefined && selectedSaqueAsset.manualBalance !== null)
                    ? Math.max(0, Math.round((selectedSaqueAsset.manualBalance - saqueCalc.brlToWithdraw) * 100) / 100)
                    : null

                updatedAsset = {
                    ...selectedSaqueAsset,
                    amount: finalAmount,
                    manualBalance: finalManual
                }
            }

            const currentList = Array.isArray(walletAssets) ? walletAssets : []
            const newList = currentList.map(a => 
                (a.id === selectedSaqueAsset.id || (a.dbId && a.dbId === selectedSaqueAsset.dbId)) ? updatedAsset : a
            )

            localStorage.setItem(`finance_assets_${session.email}`, JSON.stringify(newList))

            if (selectedSaqueAsset.dbId) {
                await supabase.from('transactions').update({
                    note: JSON.stringify(updatedAsset)
                }).eq('id', selectedSaqueAsset.dbId)
            }

            const targetAccObj = ACCOUNTS.find(a => a.id === saqueAccount) || { label: 'Conta Corrente' }
            const descStr = `Saque: ${selectedSaqueAsset.name || selectedSaqueAsset.ticker}`
            const noteStr = saqueCalc.unitsToWithdraw 
                ? `Resgate de ${saqueCalc.unitsToWithdraw.toFixed(6)} ${selectedSaqueAsset.ticker || ''} (${formatCurrency(saqueCalc.brlToWithdraw)}) para ${targetAccObj.label}`
                : `Resgate de ${formatCurrency(saqueCalc.brlToWithdraw)} do ativo ${selectedSaqueAsset.name} para ${targetAccObj.label}`

            await supabase.from('transactions').insert({
                user_email: session.email,
                description: descStr,
                amount: saqueCalc.brlToWithdraw,
                type: 'income',
                category: 'other_income',
                account: saqueAccount,
                date: saqueDate || new Date().toISOString().split('T')[0],
                note: noteStr
            })

            window.dispatchEvent(new Event('wallet_updated'))
            window.dispatchEvent(new Event('transaction_created'))

            setSaqueMessage({
                type: 'success',
                text: `🎉 Saque de ${formatCurrency(saqueCalc.brlToWithdraw)} realizado com sucesso! O valor foi transferido do investimento para a sua ${targetAccObj.label}.`
            })
            setSaqueVal('')
        } catch (err) {
            console.error("Erro ao efetuar saque no formulário principal:", err)
            setSaqueMessage({ type: 'error', text: 'Ocorreu um erro ao processar a operação de saque. Tente novamente.' })
        } finally {
            setIsSubmittingSaque(false)
        }
    }

    // Simulator State
    const { rates, degraded, loading: ratesLoading } = useRates()

    const [productId, setProductId] = useState(DEFAULT_PRODUCT_ID)
    const [multiplier, setMultiplier] = useState(() => getProduct(DEFAULT_PRODUCT_ID).defaultMultiplier)

    // Consts comuns, não hooks — a ordem das chamadas de hook não é afetada.
    // Precisam vir antes do useState de simRate, que os consome no initializer.
    const product = getProduct(productId) || getProduct(DEFAULT_PRODUCT_ID)
    const multiplierFieldLabel = multiplierLabel(product)

    const [simInitial, setSimInitial] = useState('')
    const [simMonthly, setSimMonthly] = useState('')
    const [simPeriodValue, setSimPeriodValue] = useState('')
    const [simPeriodType, setSimPeriodType] = useState('anos')
    // No primeiro render `rates` já é FALLBACK_RATES, então a taxa inicial sai da
    // mesma derivação que o effect usa depois — sem número mágico duplicado.
    const [simRate, setSimRate] = useState(() => deriveRate(product, rates, multiplier))

    const chartRef = useRef(null)
    const chartInstance = useRef(null)
    const [layoutReady, setLayoutReady] = useState(false)

    useEffect(() => {
        if (session === undefined) return
        if (!session) {
            router.push('/login')
        }
    }, [session, router])

    // Wait for fade-up animations to complete before drawing chart
    useEffect(() => {
        const t = setTimeout(() => setLayoutReady(true), 600)
        return () => clearTimeout(t)
    }, [])

    // Read URL query parameters to pre-fill simulator when coming from Wallet asset simulation
    useEffect(() => {
        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        const initParam = params.get('initial')
        const rateParam = params.get('rate')
        const prodParam = params.get('product')

        if (initParam) setSimInitial(initParam)
        if (rateParam && !isNaN(rateParam)) {
            setSimRate(Number(rateParam))
        }
        if (prodParam && getProduct(prodParam)) {
            const p = getProduct(prodParam)
            setProductId(p.id)
            if (p.defaultMultiplier !== null) setMultiplier(p.defaultMultiplier)
        }
    }, [])

    // Escreve a taxa derivada em simRate quando produto, multiplicador ou taxas
    // mudam. deriveRate devolve null para o Personalizado, e é isso que impede o
    // effect de atropelar a taxa digitada à mão — sem comparar id nenhum.
    useEffect(() => {
        const derived = deriveRate(product, rates, multiplier)
        if (derived === null) return
        setSimRate(derived)
    }, [product, rates, multiplier])

    const handleProductChange = e => {
        const next = getProduct(e.target.value)
        if (!next) return
        setProductId(next.id)
        if (next.defaultMultiplier !== null) setMultiplier(next.defaultMultiplier)
    }

    // Digitar uma taxa própria muda o produto para Personalizado, o que faz
    // deriveRate devolver null e o effect acima parar de sobrescrever.
    const handleRateChange = rate => {
        // Guarda redundante com o `dirty` do NumberField, de propósito: trocar o
        // produto é destrutivo (desliga a taxa automática), então não depende de
        // um único ponto de controle.
        if (rate === simRate) return
        setSimRate(rate)
        setProductId('custom')
    }

    // Linha embaixo do campo de taxa, substituindo a dica hardcoded
    // "Ex: 10.4 para CDI/Selic atual", que estava desatualizada.
    const rateStatus = useMemo(() => {
        const muted = 'rgba(255,255,255,0.3)'

        if (!product.index) {
            return { text: 'taxa definida por você', tone: muted }
        }
        if (ratesLoading) {
            return { text: 'buscando taxas no Banco Central…', tone: muted }
        }
        const indexRate = rates?.[product.index]

        // `degraded` cobre série que o BCB não entregou. Esta segunda guarda cobre
        // chave ausente do objeto inteiro: sem ela, `indexRate.value` lançaria
        // TypeError dentro do useMemo, durante o render, e como não há error
        // boundary em src/app/ a página de investimentos ficaria em branco.
        if (degraded.includes(product.index) || !indexRate || !Number.isFinite(indexRate.value)) {
            return { text: '⚠ não deu pra atualizar; usando último valor conhecido', tone: '#f59e0b' }
        }

        return {
            text: `${product.indexLabel} ${formatPercent(indexRate.value)} a.a. · Banco Central, ${indexRate.date}`,
            tone: muted,
        }
    }, [product, rates, degraded, ratesLoading])

    const invTransactions = useMemo(() => Array.isArray(transactions) ? transactions.filter(t => t && t.type === 'investment') : [], [transactions])
    
    // Stats
    const totalInvested = useMemo(() => (walletTotalNetWorth || 0) + calcInvestment(invTransactions), [walletTotalNetWorth, invTransactions])
    
    const catTotals = useMemo(() => {
        const totals = { stocks: 0, crypto: 0, fixed: 0, other_inv: 0 }
        if (Array.isArray(invTransactions)) {
            invTransactions.forEach(t => {
                if (!t) return
                if (totals[t.category] !== undefined) totals[t.category] += (t.amount || 0)
                else totals.other_inv += (t.amount || 0)
            })
        }

        if (Array.isArray(walletAssets)) {
            walletAssets.forEach(a => {
                if (!a) return
                const val = typeof calculateCurrentValue === 'function' ? calculateCurrentValue(a) : 0
                if (a.type === 'crypto') totals.crypto += val
                else if (a.type === 'currency') totals.other_inv += val
                else if (a.type === 'fixed') totals.fixed += val
                else totals.other_inv += val
            })
        }

        return totals
    }, [invTransactions, walletAssets, calculateCurrentValue])

    // Simulator Calculation
    const simData = useMemo(() => {
        const initial = Number(simInitial) || 0
        const monthly = Number(simMonthly) || 0
        const period = Number(simPeriodValue) || 0
        const isTaxExempt = !!product?.taxExempt
        
        if (period === 0 && initial === 0 && monthly === 0) {
            return {
                labels: ['Hoje', '1 Ano', '2 Anos', '3 Anos', '4 Anos', '5 Anos'],
                dataGross: [0, 1000, 2200, 3600, 5200, 7000], // Placeholder curve
                dataInvested: [0, 800, 1600, 2400, 3200, 4000],
                finalGross: 0,
                finalInvested: 0,
                grossProfit: 0,
                irDeduction: 0,
                finalNet: 0,
                netProfit: 0,
                irRatePct: 0,
                isTaxExempt,
                months: 0,
                isPlaceholder: true
            }
        }

        const months = simPeriodType === 'anos' ? period * 12 : period
        const rate = Number(simRate) || 0
        const monthlyRate = Math.pow(1 + (rate / 100), 1/12) - 1
        
        let currentGross = initial
        let currentInvested = initial
        
        const labels = []
        const dataGross = []
        const dataInvested = []

        labels.push('Hoje')
        dataGross.push(currentGross)
        dataInvested.push(currentInvested)

        for (let m = 1; m <= months; m++) {
            currentGross = currentGross * (1 + monthlyRate) + monthly
            currentInvested += monthly
            
            const step = months <= 12 ? 1 : months <= 24 ? 2 : 12;

            if (m % step === 0 || m === months) {
                let lbl = '';
                if (m % 12 === 0) {
                    const y = m / 12;
                    lbl = `${y} ${y === 1 ? 'Ano' : 'Anos'}`
                } else {
                    lbl = `${m} ${m === 1 ? 'Mês' : 'Meses'}`
                }
                
                // Avoid duplicating the last label if it coincidentally hits the modulo
                if (labels.length > 0 && labels[labels.length - 1] === lbl) continue;

                labels.push(lbl)
                dataGross.push(currentGross)
                dataInvested.push(currentInvested)
            }
        }

        // Regressive IR calculation
        let irRatePct = 0
        if (!isTaxExempt) {
            if (months <= 6) irRatePct = 22.5
            else if (months <= 12) irRatePct = 20.0
            else if (months <= 24) irRatePct = 17.5
            else irRatePct = 15.0
        }

        const grossProfit = Math.max(0, currentGross - currentInvested)
        const irDeduction = isTaxExempt ? 0 : grossProfit * (irRatePct / 100)
        const finalNet = currentGross - irDeduction
        const netProfit = Math.max(0, finalNet - currentInvested)

        return { 
            labels, dataGross, dataInvested, 
            finalGross: currentGross, 
            finalInvested: currentInvested,
            grossProfit,
            irDeduction,
            finalNet,
            netProfit,
            irRatePct,
            isTaxExempt,
            months
        }
    }, [simInitial, simMonthly, simPeriodValue, simPeriodType, simRate, product])

    useEffect(() => {
        if (!layoutReady || !chartRef.current) return
        
        if (chartInstance.current) {
            chartInstance.current.destroy()
        }

        const ctx = chartRef.current.getContext('2d')
        
        const gradGross = ctx.createLinearGradient(0, 0, 0, 400)
        gradGross.addColorStop(0, 'rgba(234, 179, 8, 0.4)')
        gradGross.addColorStop(1, 'rgba(234, 179, 8, 0.0)')

        const gradInvested = ctx.createLinearGradient(0, 0, 0, 400)
        gradInvested.addColorStop(0, 'rgba(96, 165, 250, 0.15)')
        gradInvested.addColorStop(1, 'rgba(96, 165, 250, 0.0)')

        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: simData.labels,
                datasets: [
                    {
                        label: simData.isPlaceholder ? 'Simulação (Exemplo)' : 'Valor Total Bruto',
                        data: simData.dataGross,
                        borderColor: simData.isPlaceholder ? 'rgba(255,255,255,0.2)' : '#eab308',
                        backgroundColor: simData.isPlaceholder ? 'transparent' : gradGross,
                        borderWidth: simData.isPlaceholder ? 2 : 3,
                        borderDash: simData.isPlaceholder ? [5, 5] : [],
                        pointBackgroundColor: simData.isPlaceholder ? 'transparent' : '#eab308',
                        pointBorderColor: simData.isPlaceholder ? 'transparent' : '#fff',
                        pointRadius: simData.isPlaceholder ? 0 : 4,
                        fill: !simData.isPlaceholder,
                        tension: 0.4
                    },
                    {
                        label: simData.isPlaceholder ? 'Aportes (Exemplo)' : 'Total Investido',
                        data: simData.dataInvested,
                        borderColor: simData.isPlaceholder ? 'rgba(255,255,255,0.05)' : '#60a5fa',
                        backgroundColor: simData.isPlaceholder ? 'transparent' : gradInvested,
                        borderWidth: 2,
                        pointRadius: 0,
                        borderDash: simData.isPlaceholder ? [5, 5] : [5, 5],
                        fill: !simData.isPlaceholder,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                animation: {
                    duration: 500
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: 'rgba(255,255,255,0.7)', usePointStyle: true, padding: 20 }
                    },
                    tooltip: {
                        enabled: !simData.isPlaceholder,
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        titleColor: 'rgba(255,255,255,0.9)',
                        bodyColor: '#eab308',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: (ctx) => {
                                return ctx.dataset.label + ': ' + formatCurrency(ctx.raw)
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                        ticks: { color: 'rgba(255,255,255,0.4)' }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
                        suggestedMax: 1000,
                        suggestedMin: 0,
                        ticks: {
                            color: 'rgba(255,255,255,0.4)',
                            callback: (val) => new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(val)
                        }
                    }
                }
            }
        })
    }, [simData, layoutReady])

    const handleSimulateAsset = (params) => {
        if (!params) return;
        const { initial, rate, presetId, cdiPercent } = params;

        if (initial !== undefined && initial !== null && !isNaN(initial)) {
            setSimInitial(Number(initial));
        }
        if (!simPeriodValue || Number(simPeriodValue) <= 0 || isNaN(simPeriodValue)) {
            setSimPeriodValue(2);
        }
        if (presetId && getProduct(presetId)) {
            const p = getProduct(presetId);
            setProductId(p.id);
            if (cdiPercent && p.multiplierKind === 'percent_of' && !isNaN(cdiPercent)) {
                setMultiplier(Number(cdiPercent));
            } else if (p.defaultMultiplier !== null) {
                setMultiplier(p.defaultMultiplier);
            }
        }
        if (rate !== undefined && rate !== null && !isNaN(rate)) {
            setSimRate(Number(rate));
        }

        setTimeout(() => {
            const el = document.getElementById('simulador-section');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 50);
    }

    if (!session) return null

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            <div className="bg-grid" />
            <div className="app-container">
                <Sidebar />
                <main className="main-content">
                <header className="fade-up" style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 32, fontWeight: 700, margin: 0 }}>🏦 Meus Investimentos</h2>
                    <p style={{ color: 'var(--text-secondary)', marginTop: 6 }}>Gerencie seu patrimônio e simule seus rendimentos.</p>
                </header>

                <div className="fade-up delay-1" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24, marginBottom: 20 }}>
                    <div className="card glass-panel" style={{ padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, rgba(234,179,8,0.1) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(234,179,8,0.3)', position: 'relative', overflow: 'hidden' }}>
                        <svg style={{ position: 'absolute', right: -20, top: -20, width: 250, height: 250, opacity: 0.05, color: '#eab308' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
                        </svg>
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <div style={{ fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>Total Investido</div>
                            <div style={{ fontSize: 'clamp(28px, 7vw, 44px)', fontWeight: 800, color: '#eab308' }}>
                                {txLoading ? '...' : formatCurrency(totalInvested)}
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: 24, position: 'relative', zIndex: 1 }}>
                            {CATEGORY_MAP.investment.map(cat => (
                                <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
                                        <span style={{ color: cat.color }}>{cat.icon}</span> {cat.label}
                                    </div>
                                    <div style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>
                                        {formatCurrency(catTotals[cat.id] || 0)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Wallet Section */}
                <Wallet userEmail={session?.email} onSimulate={handleSimulateAsset} onSelectWithdraw={handleSelectWithdrawAsset} />

                {/* Área de Saque Section */}
                <div id="saque-section" className="fade-up delay-2" style={{ marginBottom: 36 }}>
                    <h3 style={{ fontSize: 24, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span>💸</span> Área de Saque & Resgate de Investimentos
                    </h3>

                    {(!walletAssets || walletAssets.length === 0) ? (
                        <div className="card glass-panel" style={{ padding: 28, textAlign: 'center', color: 'var(--text-secondary)' }}>
                            Você ainda não possui investimentos em sua carteira para realizar saques. Adicione um ativo na seção "Minha Carteira" acima!
                        </div>
                    ) : (
                        <div className="card glass-panel" style={{ padding: 28, border: '1px solid rgba(16,185,129,0.3)', background: 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(0,0,0,0.2) 100%)' }}>
                            <form onSubmit={handleExecuteSaque} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                                {/* Form Controls */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    {/* Asset Selector */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>
                                            Investimento de Origem
                                        </label>
                                        <div className="tx-field" style={{ margin: 0 }}>
                                            <select 
                                                value={selectedSaqueAsset ? (selectedSaqueAsset.id || selectedSaqueAsset.dbId) : ''}
                                                onChange={e => {
                                                    setSaqueAssetId(e.target.value);
                                                    setSaqueVal('');
                                                    setSaqueMessage(null);
                                                }}
                                            >
                                                {walletAssets.map(a => {
                                                    const val = calculateCurrentValue(a);
                                                    return (
                                                        <option key={a.id || a.dbId} value={a.id || a.dbId}>
                                                            {a.type === 'crypto' ? '₿' : a.type === 'currency' ? '💵' : '🏦'} {a.name || a.ticker} ({formatCurrency(val)})
                                                        </option>
                                                    );
                                                })}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Target Account Selector */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>
                                            Conta de Destino (para onde vai o saldo)
                                        </label>
                                        <div className="tx-field" style={{ margin: 0 }}>
                                            <select value={saqueAccount} onChange={e => setSaqueAccount(e.target.value)}>
                                                {ACCOUNTS.filter(a => a.id !== 'credit' && a.id !== 'investment').map(acc => (
                                                    <option key={acc.id} value={acc.id}>
                                                        {acc.icon} {acc.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Crypto/Currency Mode Toggle */}
                                    {saqueCalc?.isCryptoOrCurr && (
                                        <div>
                                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                                Modo do Saque
                                            </label>
                                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12, gap: 4 }}>
                                                <button
                                                    type="button"
                                                    onClick={() => { setSaqueMode('units'); setSaqueVal(''); }}
                                                    style={{
                                                        flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none',
                                                        background: saqueMode === 'units' ? '#10b981' : 'transparent',
                                                        color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer'
                                                    }}
                                                >
                                                    Unidades ({selectedSaqueAsset?.ticker})
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setSaqueMode('brl'); setSaqueVal(''); }}
                                                    style={{
                                                        flex: 1, padding: '9px 12px', borderRadius: 8, border: 'none',
                                                        background: saqueMode === 'brl' ? '#10b981' : 'transparent',
                                                        color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer'
                                                    }}
                                                >
                                                    Valor em Reais (R$)
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Amount Input */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>
                                            {saqueCalc?.isCryptoOrCurr 
                                                ? (saqueMode === 'units' ? `Quantidade de ${selectedSaqueAsset?.ticker} a sacar` : 'Valor em Reais (R$) a sacar')
                                                : 'Valor em Reais (R$) a sacar'}
                                        </label>
                                        <NumberField
                                            value={saqueVal}
                                            onChange={setSaqueVal}
                                            min={0}
                                            max={1000000000}
                                            decimals={saqueCalc?.isCryptoOrCurr && saqueMode === 'units' ? 8 : 2}
                                            icon="💸"
                                            ariaLabel="Valor a sacar"
                                        />
                                    </div>

                                    {/* Percentage Pills */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        {[
                                            { label: '25%', pct: 0.25 },
                                            { label: '50%', pct: 0.5 },
                                            { label: '75%', pct: 0.75 },
                                            { label: '100% (Tudo)', pct: 1.0 }
                                        ].map((p, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                onClick={() => {
                                                    if (!saqueCalc) return;
                                                    if (saqueCalc.isCryptoOrCurr && saqueMode === 'units') {
                                                        setSaqueVal(((selectedSaqueAsset.amount || 0) * p.pct).toString());
                                                    } else {
                                                        setSaqueVal((saqueCalc.currentVal * p.pct).toFixed(2));
                                                    }
                                                }}
                                                style={{
                                                    flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                                                    background: 'rgba(255,255,255,0.05)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                                                }}
                                            >
                                                {p.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Date */}
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>
                                            Data do Saque
                                        </label>
                                        <input
                                            type="date"
                                            value={saqueDate}
                                            onChange={e => setSaqueDate(e.target.value)}
                                            style={{ width: '100%', padding: '12px 14px', borderRadius: 12, background: '#111827', color: 'white', border: '1px solid rgba(255,255,255,0.1)' }}
                                        />
                                    </div>
                                </div>

                                {/* Live Preview Card & Submit */}
                                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: 24, borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
                                    <div>
                                        <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 16 }}>
                                            Resumo da Operação
                                        </div>

                                        {selectedSaqueAsset && saqueCalc && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>Saldo Atual do Investimento:</span>
                                                    <strong style={{ color: 'white' }}>{formatCurrency(saqueCalc.currentVal)}</strong>
                                                </div>

                                                {saqueCalc.isCryptoOrCurr && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                                                        <span>Cotação de Referência:</span>
                                                        <span>1 {selectedSaqueAsset.ticker} = {formatCurrency(saqueCalc.priceBrl)}</span>
                                                    </div>
                                                )}

                                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
                                                        <span style={{ color: '#ef4444' }}>Dedução no Investimento:</span>
                                                        <span style={{ color: '#ef4444' }}>- {formatCurrency(saqueCalc.brlToWithdraw)}</span>
                                                    </div>
                                                    {saqueCalc.unitsToWithdraw > 0 && saqueCalc.isCryptoOrCurr && (
                                                        <div style={{ fontSize: 12, color: 'rgba(239,68,68,0.8)', textAlign: 'right', marginTop: 2 }}>
                                                            ({saqueCalc.unitsToWithdraw.toFixed(6)} {selectedSaqueAsset.ticker})
                                                        </div>
                                                    )}
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800 }}>
                                                    <span style={{ color: '#10b981' }}>Crédito na Conta Saldo:</span>
                                                    <span style={{ color: '#10b981' }}>+ {formatCurrency(saqueCalc.brlToWithdraw)}</span>
                                                </div>

                                                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                                                    <span style={{ color: 'var(--text-secondary)' }}>Novo Saldo do Investimento:</span>
                                                    <strong style={{ color: '#60a5fa' }}>{formatCurrency(saqueCalc.remainingVal)}</strong>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ marginTop: 24 }}>
                                        {saqueMessage && (
                                            <div style={{
                                                padding: 12, borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
                                                background: saqueMessage.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                color: saqueMessage.type === 'success' ? '#10b981' : '#ef4444',
                                                border: saqueMessage.type === 'success' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)'
                                            }}>
                                                {saqueMessage.text}
                                            </div>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={isSubmittingSaque || !saqueCalc || saqueCalc.brlToWithdraw <= 0}
                                            className="btn-primary"
                                            style={{ width: '100%', padding: '14px', fontSize: 16, background: '#10b981', borderColor: '#10b981', boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}
                                        >
                                            {isSubmittingSaque ? 'Processando Saque...' : '💸 Confirmar Saque e Creditar na Conta'}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    )}
                </div>

                {/* Simulador Section */}
                <h3 id="simulador-section" className="fade-up delay-2" style={{ fontSize: 24, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>🧮</span> Simulador de Juros Compostos
                </h3>
                <div className="fade-up delay-2 sim-grid">

                    {/* Controles do Simulador */}
                    <div className="card glass-panel" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Tipo de Investimento</label>
                            <div className="tx-field" style={{ margin: 0 }}>
                                <select value={productId} onChange={handleProductChange} aria-label="Tipo de investimento">
                                    {INVESTMENT_PRODUCTS.map(p => (
                                        <option key={p.id} value={p.id}>{p.icon} {p.label}</option>
                                    ))}
                                </select>
                            </div>
                            {product.hint && (
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8, lineHeight: 1.5 }}>
                                    {product.hint}
                                </div>
                            )}
                        </div>

                        {multiplierFieldLabel && (
                            <div>
                                <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>{multiplierFieldLabel}</label>
                                <NumberField
                                    value={multiplier}
                                    onChange={setMultiplier}
                                    min={0}
                                    max={product.multiplierKind === 'percent_of' ? 300 : 50}
                                    decimals={2}
                                    icon={product.multiplierKind === 'percent_of' ? '✖️' : '➕'}
                                    ariaLabel={multiplierFieldLabel}
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Valor Inicial</label>
                            <NumberField
                                value={simInitial}
                                onChange={setSimInitial}
                                min={0}
                                max={1000000000}
                                decimals={2}
                                icon="💰"
                                ariaLabel="Valor inicial"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Aporte Mensal</label>
                            <NumberField
                                value={simMonthly}
                                onChange={setSimMonthly}
                                min={0}
                                max={1000000000}
                                decimals={2}
                                icon="📅"
                                ariaLabel="Aporte mensal"
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>Taxa de Rendimento Anual (%)</label>
                            <NumberField
                                value={simRate}
                                onChange={handleRateChange}
                                min={0}
                                max={100}
                                decimals={2}
                                icon="📈"
                                suffix="%"
                                ariaLabel="Taxa de rendimento anual"
                            />
                            <div style={{ fontSize: 12, marginTop: 8, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                <span style={{ color: rateStatus.tone }}>{rateStatus.text}</span>
                                {product.taxExempt && (
                                    <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 6, padding: '2px 6px' }}>
                                        isento de IR
                                    </span>
                                )}
                            </div>
                        </div>

                        <div>
                            <label style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, color: 'var(--text-secondary)', fontSize: 14 }}>
                                <span>Período</span>
                                <select value={simPeriodType} onChange={e => setSimPeriodType(e.target.value)} style={{ background: 'transparent', border: 'none', color: '#60a5fa', outline: 'none', cursor: 'pointer', fontSize: 14, padding: 0, textAlign: 'right' }}>
                                    <option value="anos" style={{ color: 'black' }}>Anos</option>
                                    <option value="meses" style={{ color: 'black' }}>Meses</option>
                                </select>
                            </label>
                            <NumberField
                                value={simPeriodValue}
                                onChange={setSimPeriodValue}
                                min={1}
                                max={simPeriodType === 'anos' ? 50 : 600}
                                decimals={0}
                                icon="⏳"
                                ariaLabel={`Período em ${simPeriodType}`}
                            />
                        </div>

                        <div style={{ marginTop: 'auto', paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Total Investido:</span>
                                <span style={{ color: '#60a5fa', fontWeight: 600 }}>{formatCurrency(simData.finalInvested)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Rendimento Bruto:</span>
                                <span style={{ color: '#eab308', fontWeight: 600 }}>+ {formatCurrency(simData.grossProfit)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>
                                    Desconto IR ({simData.isTaxExempt ? 'Isento' : `${simData.irRatePct}%`}):
                                </span>
                                <span style={{ color: simData.isTaxExempt ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                    {simData.isTaxExempt ? 'Isento (R$ 0,00)' : `- ${formatCurrency(simData.irDeduction)}`}
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Rendimento Líquido:</span>
                                <span style={{ color: '#10b981', fontWeight: 600 }}>+ {formatCurrency(simData.netProfit)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 600, marginTop: 12, color: 'rgba(255,255,255,0.7)' }}>
                                <span>Valor Final Bruto:</span>
                                <span>{formatCurrency(simData.finalGross)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, marginTop: 6, color: '#10b981' }}>
                                <span>Valor Final Líquido:</span>
                                <span>{formatCurrency(simData.finalNet)}</span>
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 16, lineHeight: 1.5 }}>
                                {simData.isTaxExempt 
                                    ? '✓ Produto isento de Imposto de Renda (IR) para pessoa física.' 
                                    : `* Desconto de IR calculado pela tabela regressiva de renda fixa (${simData.irRatePct}% para ${simData.months} meses).`}
                            </div>
                        </div>
                    </div>

                    {/* Gráfico do Simulador */}
                    <div className="card glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: 'white' }}>
                            Projeção de Crescimento do Patrimônio
                        </div>
                        <div className="sim-chart-box">
                            <canvas ref={chartRef} style={{ display: 'block' }} />
                        </div>
                    </div>
                </div>

            </main>
            </div>
        </div>
    )
}
