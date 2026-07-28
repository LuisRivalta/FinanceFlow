"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '../helpers';
import { useRates } from '../hooks/useRates';
import { getProduct, deriveRate } from '../lib/investmentProducts';
import { supabase } from '../lib/supabase';

// Map common user inputs to AwesomeAPI tickers
const TICKER_MAP = {
    'BTC': 'BTC-BRL',
    'BITCOIN': 'BTC-BRL',
    'ETH': 'ETH-BRL',
    'ETHEREUM': 'ETH-BRL',
    'USD': 'USD-BRL',
    'DOLAR': 'USD-BRL',
    'DÓLAR': 'USD-BRL',
    'EUR': 'EUR-BRL',
    'EURO': 'EUR-BRL'
};

const cleanTicker = (ticker) => {
    if (!ticker) return 'BTC';
    const upper = String(ticker).toUpperCase().trim();
    if (upper === 'BITCOIN') return 'BTC';
    if (upper === 'ETHEREUM') return 'ETH';
    if (upper === 'DOLAR' || upper === 'DÓLAR') return 'USD';
    if (upper === 'EURO') return 'EUR';
    return upper;
};

const ASSET_TYPES = [
    { id: 'cdb', label: 'CDB / RDB / CDI', category: 'fixed', defaultMultiplier: 100, hasCdiPercent: true },
    { id: 'lci_lca', label: 'LCI / LCA (Isento IR)', category: 'fixed', defaultMultiplier: 95, hasCdiPercent: true },
    { id: 'tesouro_selic', label: 'Tesouro Selic', category: 'fixed', defaultMultiplier: 0, hasCdiPercent: false },
    { id: 'poupanca', label: 'Poupança (Isento IR)', category: 'fixed', defaultMultiplier: null, hasCdiPercent: false },
    { id: 'tesouro_ipca', label: 'Tesouro IPCA+', category: 'fixed', defaultMultiplier: 6, hasCdiPercent: false },
    { id: 'crypto', label: 'Criptomoeda (BTC, ETH...)', category: 'crypto', defaultMultiplier: null, hasCdiPercent: false },
    { id: 'currency', label: 'Moeda Estrangeira (USD, EUR...)', category: 'currency', defaultMultiplier: null, hasCdiPercent: false },
    { id: 'fixed', label: 'Outros Renda Fixa', category: 'fixed', defaultMultiplier: null, hasCdiPercent: false }
];

export default function Wallet({ userEmail, onSimulate }) {
    const router = useRouter();
    const [assets, setAssets] = useState([]);
    const [livePrices, setLivePrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [isAdding, setIsAdding] = useState(false);

    const { rates } = useRates();
    
    // Form state
    const [addType, setAddType] = useState('cdb');
    const [addName, setAddName] = useState('');
    const [addAmount, setAddAmount] = useState('');
    const [addRate, setAddRate] = useState('');
    const [addCdiPercent, setAddCdiPercent] = useState('100');

    // Inline edit manual balance state
    const [editingAssetId, setEditingAssetId] = useState(null);
    const [editBalanceVal, setEditBalanceVal] = useState('');

    // Crypto / Currency simulation modal state
    const [simulatingAsset, setSimulatingAsset] = useState(null);
    const [simTargetPrice, setSimTargetPrice] = useState('');

    // Load and sync assets with Supabase Cloud DB
    useEffect(() => {
        if (!userEmail) return;
        const loadAssets = async () => {
            try {
                const { data, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('user_email', userEmail)
                    .eq('category', 'system_asset');

                let cloudAssets = [];
                if (!error && data) {
                    cloudAssets = data.map(row => {
                        try {
                            const parsed = JSON.parse(row.note);
                            return { ...parsed, dbId: row.id };
                        } catch (e) {
                            return null;
                        }
                    }).filter(Boolean);
                }

                // Check if local storage has items to migrate to Supabase
                const localSaved = localStorage.getItem(`finance_assets_${userEmail}`);
                if (localSaved) {
                    try {
                        const localItems = JSON.parse(localSaved);
                        if (Array.isArray(localItems) && localItems.length > 0) {
                            for (const item of localItems) {
                                const exists = cloudAssets.some(c => String(c.id) === String(item.id));
                                if (!exists) {
                                    const { data: inserted } = await supabase.from('transactions').insert({
                                        user_email: userEmail,
                                        description: `Investimento: ${item.name || item.ticker}`,
                                        amount: item.amount || 0,
                                        type: 'income',
                                        category: 'system_asset',
                                        date: new Date().toISOString().split('T')[0],
                                        note: JSON.stringify(item)
                                    }).select().single();

                                    if (inserted) {
                                        cloudAssets.push({ ...item, dbId: inserted.id });
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error("Error migrating local assets", e);
                    }
                }

                setAssets(cloudAssets);
                localStorage.setItem(`finance_assets_${userEmail}`, JSON.stringify(cloudAssets));
            } catch (err) {
                console.error("Erro ao carregar ativos no Supabase", err);
            }
        };

        loadAssets();
    }, [userEmail]);

    const saveAssetsToCloud = async (newList) => {
        setAssets(newList);
        localStorage.setItem(`finance_assets_${userEmail}`, JSON.stringify(newList));
        window.dispatchEvent(new Event('wallet_updated'));
    };

    // Auto populate rate when addType, addCdiPercent, or rates change
    useEffect(() => {
        const selectedPreset = ASSET_TYPES.find(t => t.id === addType);
        if (selectedPreset && selectedPreset.category === 'fixed') {
            const product = getProduct(selectedPreset.id);
            if (product) {
                const multiplier = selectedPreset.hasCdiPercent ? (parseFloat(addCdiPercent) || 100) : selectedPreset.defaultMultiplier;
                const derived = deriveRate(product, rates, multiplier);
                if (derived !== null) {
                    setAddRate(String(derived));
                    return;
                }
            }
        }
        if (addType === 'fixed' && !addRate) {
            setAddRate('10.4');
        }
    }, [addType, addCdiPercent, rates]);

    const handleTypeChange = (e) => {
        const newT = e.target.value;
        setAddType(newT);
        if (newT === 'lci_lca') setAddCdiPercent('95');
        else if (newT === 'cdb') setAddCdiPercent('100');
    };

    // Fetch live prices for crypto / currency directly in BRL and USD from API
    const fetchPrices = async () => {
        const liveAssets = assets.filter(a => a.type === 'crypto' || a.type === 'currency');
        if (liveAssets.length === 0) return;

        const fetchTargets = [];
        liveAssets.forEach(a => {
            const symbol = cleanTicker(a.ticker);
            fetchTargets.push(`${symbol}-BRL`);
            if (symbol !== 'USD' && symbol !== 'BRL') {
                fetchTargets.push(`${symbol}-USD`);
            }
        });

        const uniqueTargets = [...new Set(fetchTargets)];
        const url = `https://economia.awesomeapi.com.br/last/${uniqueTargets.join(',')}`;
        
        try {
            setLoadingPrices(true);
            const res = await fetch(url);
            const data = await res.json();
            
            const newPrices = {};
            uniqueTargets.forEach(target => {
                const key = target.replace('-', '');
                if (data[key]) {
                    newPrices[target] = parseFloat(data[key].ask);
                }
            });
            setLivePrices(newPrices);
        } catch (error) {
            console.error("Failed to fetch live prices", error);
        } finally {
            setLoadingPrices(false);
        }
    };

    useEffect(() => {
        fetchPrices();
        const interval = setInterval(fetchPrices, 60000);
        return () => clearInterval(interval);
    }, [assets]);

    const handleAddAsset = async (e) => {
        e.preventDefault();
        const selectedPreset = ASSET_TYPES.find(t => t.id === addType) || ASSET_TYPES[0];
        const categoryType = selectedPreset.category;

        const newAsset = {
            id: Date.now().toString(),
            type: categoryType,
            presetId: selectedPreset.id,
            amount: parseFloat(addAmount),
            date: new Date().toISOString()
        };

        if (categoryType === 'fixed') {
            newAsset.name = addName || selectedPreset.label;
            newAsset.rate = parseFloat(addRate) || 10.4;
            if (selectedPreset.hasCdiPercent) {
                newAsset.cdiPercent = parseFloat(addCdiPercent) || 100;
            }
        } else {
            newAsset.ticker = cleanTicker(addName);
            newAsset.name = cleanTicker(addName);
        }

        try {
            const { data: inserted } = await supabase.from('transactions').insert({
                user_email: userEmail,
                description: `Investimento: ${newAsset.name}`,
                amount: newAsset.amount,
                type: 'income',
                category: 'system_asset',
                date: new Date().toISOString().split('T')[0],
                note: JSON.stringify(newAsset)
            }).select().single();

            const withDbId = { ...newAsset, dbId: inserted?.id };
            saveAssetsToCloud([...assets, withDbId]);
            setIsAdding(false);
            setAddName('');
            setAddAmount('');
            setAddRate('');
            setAddCdiPercent('100');
        } catch (err) {
            console.error("Erro ao salvar ativo no Supabase", err);
        }
    };

    const removeAsset = async (id) => {
        const target = assets.find(a => a.id === id || a.dbId === id);
        const newList = assets.filter(a => a.id !== id && a.dbId !== id);
        saveAssetsToCloud(newList);

        if (target?.dbId) {
            await supabase.from('transactions').delete().eq('id', target.dbId);
        }
    };

    const handleSaveManualBalance = async (assetId, valueStr) => {
        const val = valueStr !== '' && !isNaN(valueStr) ? parseFloat(valueStr) : null;
        const updatedList = assets.map(a => {
            if (a.id === assetId || a.dbId === assetId) {
                const updated = { ...a, manualBalance: val };
                if (a.dbId) {
                    supabase.from('transactions').update({
                        note: JSON.stringify(updated)
                    }).eq('id', a.dbId).then();
                }
                return updated;
            }
            return a;
        });

        saveAssetsToCloud(updatedList);
        setEditingAssetId(null);
        setEditBalanceVal('');
    };

    const handleResetToAutomatic = async (assetId) => {
        const updatedList = assets.map(a => {
            if (a.id === assetId || a.dbId === assetId) {
                const updated = { ...a, manualBalance: null };
                if (a.dbId) {
                    supabase.from('transactions').update({
                        note: JSON.stringify(updated)
                    }).eq('id', a.dbId).then();
                }
                return updated;
            }
            return a;
        });

        saveAssetsToCloud(updatedList);
        setEditingAssetId(null);
        setEditBalanceVal('');
    };

    // Calculate current values
    const calculateCurrentValue = (asset) => {
        if (asset.manualBalance !== undefined && asset.manualBalance !== null && asset.manualBalance !== '') {
            return parseFloat(asset.manualBalance);
        }
        if (asset.type === 'fixed') {
            const start = new Date(asset.date);
            const now = new Date();
            const daysElapsed = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
            const yearsElapsed = daysElapsed / 365;
            return asset.amount * Math.pow(1 + ((asset.rate || 0) / 100), yearsElapsed);
        } else {
            const symbol = cleanTicker(asset.ticker);
            const price = livePrices[`${symbol}-BRL`] || 0;
            return price > 0 ? asset.amount * price : asset.amount;
        }
    };

    const totalNetWorth = assets.reduce((sum, asset) => sum + calculateCurrentValue(asset), 0);
    const currentPreset = ASSET_TYPES.find(t => t.id === addType) || ASSET_TYPES[0];

    const openSimulationModal = (asset) => {
        const symbol = cleanTicker(asset.ticker);
        const currentP = livePrices[`${symbol}-BRL`] || asset.purchasePrice || 1;
        setSimulatingAsset(asset);
        setSimCurrency('BRL');
        setSimTargetPrice((currentP * 1.5).toFixed(2));
    };

    const handleToggleCurrency = (newCurrency) => {
        if (newCurrency === simCurrency || !simulatingAsset) return;
        const symbol = cleanTicker(simulatingAsset.ticker);
        const usdBrlRate = rates?.usdRate || livePrices['USDT-BRL'] || 5.65;
        const currentTarget = parseFloat(simTargetPrice) || 0;

        if (newCurrency === 'USD') {
            const directUsdPrice = livePrices[`${symbol}-USD`];
            const currentBrlPrice = livePrices[`${symbol}-BRL`] || 1;
            
            let targetInUsd;
            if (directUsdPrice && currentBrlPrice > 0) {
                const ratio = currentTarget / currentBrlPrice;
                targetInUsd = directUsdPrice * ratio;
            } else {
                targetInUsd = currentTarget / usdBrlRate;
            }

            setSimCurrency('USD');
            setSimTargetPrice(targetInUsd < 10 ? targetInUsd.toFixed(4) : targetInUsd.toFixed(2));
        } else {
            const directUsdPrice = livePrices[`${symbol}-USD`];
            const currentBrlPrice = livePrices[`${symbol}-BRL`] || 1;
            
            let targetInBrl;
            if (directUsdPrice && currentBrlPrice > 0 && directUsdPrice > 0) {
                const ratio = currentTarget / directUsdPrice;
                targetInBrl = currentBrlPrice * ratio;
            } else {
                targetInBrl = currentTarget * usdBrlRate;
            }

            setSimCurrency('BRL');
            setSimTargetPrice(targetInBrl.toFixed(2));
        }
    };
            const targetInBrl = currentTarget * usdBrlRate;
            setSimCurrency('BRL');
            setSimTargetPrice(targetInBrl.toFixed(2));
        }
    };

    return (
        <div style={{ marginTop: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 className="fade-up" style={{ fontSize: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span>💼</span> Minha Carteira
                </h3>
                <button 
                    onClick={() => setIsAdding(!isAdding)}
                    className="btn-primary" 
                    style={{ padding: '8px 16px', fontSize: 14 }}
                >
                    {isAdding ? 'Cancelar' : '+ Adicionar Ativo'}
                </button>
            </div>

            {isAdding && (
                <div className="card glass-panel fade-up" style={{ padding: 24, marginBottom: 24, border: '1px solid var(--accent-primary)' }}>
                    <form onSubmit={handleAddAsset} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="tx-field" style={{ flex: 1, minWidth: 180 }}>
                            <label>Tipo de Ativo</label>
                            <select value={addType} onChange={handleTypeChange}>
                                {ASSET_TYPES.map(t => (
                                    <option key={t.id} value={t.id}>{t.label}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="tx-field" style={{ flex: 1, minWidth: 160 }}>
                            <label>{currentPreset.category === 'fixed' ? 'Nome do Objetivo / Ativo' : 'Sigla (ex: BTC, USD)'}</label>
                            <input 
                                required
                                type="text" 
                                value={addName} 
                                onChange={e => setAddName(e.target.value)} 
                                placeholder={currentPreset.category === 'fixed' ? 'Ex: Viagem, Reserva...' : 'BTC'}
                            />
                        </div>

                        <div className="tx-field" style={{ flex: 1, minWidth: 150 }}>
                            <label>{currentPreset.category === 'fixed' ? 'Valor Investido (R$)' : 'Quantidade'}</label>
                            <input 
                                required
                                type="number" 
                                step="any"
                                min="0"
                                value={addAmount} 
                                onChange={e => setAddAmount(e.target.value)} 
                                placeholder={currentPreset.category === 'fixed' ? '1000,00' : '0.5'}
                            />
                        </div>

                        {currentPreset.hasCdiPercent && (
                            <div className="tx-field" style={{ flex: 1, minWidth: 120 }}>
                                <label>% do CDI</label>
                                <input 
                                    required
                                    type="number" 
                                    step="1"
                                    min="1"
                                    value={addCdiPercent} 
                                    onChange={e => setAddCdiPercent(e.target.value)} 
                                    placeholder="100"
                                />
                            </div>
                        )}

                        {currentPreset.category === 'fixed' && (
                            <div className="tx-field" style={{ flex: 1, minWidth: 130 }}>
                                <label>Taxa Anual (%)</label>
                                <input 
                                    required
                                    type="number" 
                                    step="0.01"
                                    min="0"
                                    value={addRate} 
                                    onChange={e => setAddRate(e.target.value)} 
                                    placeholder="10.4"
                                />
                            </div>
                        )}

                        <button type="submit" className="btn-primary" style={{ padding: '11px 24px' }}>
                            Salvar
                        </button>
                    </form>
                </div>
            )}

            {assets.length === 0 && !isAdding ? (
                <div className="card glass-panel fade-up delay-1" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: 'clamp(26px, 6vw, 40px)', marginBottom: 16 }}>📈</div>
                    <div>Sua carteira está vazia. Adicione ativos para começar a acompanhar o rendimento em tempo real!</div>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
                    {/* Total Card */}
                    {assets.length > 0 && (
                        <div className="card glass-panel fade-up delay-1" style={{ padding: 24, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <div style={{ fontSize: 14, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700, marginBottom: 8 }}>
                                Patrimônio Atual
                            </div>
                            <div style={{ fontSize: 'clamp(22px, 5vw, 32px)', fontWeight: 800, color: '#10b981' }}>
                                {loadingPrices && Object.keys(livePrices).length === 0 ? '...' : formatCurrency(totalNetWorth)}
                            </div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>
                                Atualizado em tempo real
                            </div>
                        </div>
                    )}

                    {/* Asset Cards */}
                    {assets.map((asset, idx) => {
                        const currentValue = calculateCurrentValue(asset);
                        const isLive = asset.type !== 'fixed';
                        const isManual = asset.manualBalance !== undefined && asset.manualBalance !== null && asset.manualBalance !== '';

                        // Calculation of profit
                        const initialCost = asset.type === 'fixed' ? asset.amount : 0;
                        const profit = initialCost > 0 ? currentValue - initialCost : 0;
                        const profitPct = initialCost > 0 ? (profit / initialCost) * 100 : 0;
                        
                        return (
                            <div key={asset.id} className="card glass-panel fade-up" style={{ padding: 22, animationDelay: `${(idx + 2) * 0.1}s`, position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <button 
                                    onClick={() => removeAsset(asset.id)}
                                    style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.5 }}
                                    title="Remover"
                                >
                                    ✖
                                </button>
                                
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                            {asset.type === 'crypto' ? '₿' : asset.type === 'currency' ? '💵' : '🏦'}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                                {asset.type === 'fixed' 
                                                    ? (asset.cdiPercent ? `${asset.cdiPercent}% do CDI (${asset.rate}% a.a.)` : `Taxa ${asset.rate}% a.a.`) 
                                                    : `${asset.amount} unidades`}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Valor Atual</span>
                                            <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, background: isManual ? 'rgba(59,130,246,0.15)' : 'rgba(16,185,129,0.15)', color: isManual ? '#60a5fa' : '#10b981' }}>
                                                {isManual ? '✏️ Saldo Manual' : asset.type === 'fixed' ? '⚡ Auto Rendimento' : '📈 Cotação Ao Vivo'}
                                            </span>
                                        </div>

                                        {editingAssetId === asset.id ? (
                                            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                <input 
                                                    type="number"
                                                    step="0.01"
                                                    value={editBalanceVal}
                                                    onChange={e => setEditBalanceVal(e.target.value)}
                                                    placeholder="Digite o saldo atual..."
                                                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #3b82f6', background: '#111827', color: 'white', fontSize: 14 }}
                                                    autoFocus
                                                />
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => handleSaveManualBalance(asset.id, editBalanceVal)}
                                                        style={{ flex: 1, padding: '6px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                                    >
                                                        Salvar
                                                    </button>
                                                    {isManual && (
                                                        <button 
                                                            type="button" 
                                                            onClick={() => handleResetToAutomatic(asset.id)}
                                                            style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                                                        >
                                                            🔄 Usar Auto
                                                        </button>
                                                    )}
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setEditingAssetId(null)}
                                                        style={{ padding: '6px 10px', background: 'transparent', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                                    <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>
                                                        {formatCurrency(currentValue)}
                                                    </div>
                                                    <button 
                                                        onClick={() => { setEditingAssetId(asset.id); setEditBalanceVal(currentValue.toFixed(2)); }}
                                                        style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
                                                    >
                                                        ✏️ Ajustar
                                                    </button>
                                                </div>

                                                {asset.type === 'fixed' && initialCost > 0 && (
                                                    <div style={{ fontSize: 12, marginTop: 6, color: profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                                                        {profit >= 0 ? '▲' : '▼'} {formatCurrency(profit)} ({profitPct.toFixed(2)}%)
                                                    </div>
                                                )}

                                                {isLive && (() => {
                                                    const targetKey = TICKER_MAP[asset.ticker?.toUpperCase()] || `${asset.ticker?.toUpperCase()}-BRL`;
                                                    const priceBrl = livePrices[targetKey];
                                                    const usdBrlRate = rates?.usdRate || livePrices['USDT-BRL'] || 5.65;
                                                    const priceUsd = priceBrl ? (priceBrl / usdBrlRate) : null;
                                                    const formatUsdStr = (val) => `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                                                    return (
                                                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,0.025)', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.05)' }}>
                                                            <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ color: 'var(--text-secondary)' }}>Cotação Hoje (R$):</span>
                                                                <span style={{ fontWeight: 700, color: '#eab308' }}>
                                                                    {priceBrl ? formatCurrency(priceBrl) : 'Buscando...'}
                                                                </span>
                                                            </div>
                                                            <div style={{ fontSize: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                <span style={{ color: 'var(--text-secondary)' }}>Cotação Hoje (USD $):</span>
                                                                <span style={{ fontWeight: 700, color: '#60a5fa' }}>
                                                                    {priceUsd ? formatUsdStr(priceUsd) : 'Buscando...'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Simulation Button */}
                                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 8 }}>
                                    {asset.type === 'fixed' ? (
                                        <button 
                                            onClick={() => {
                                                if (onSimulate) {
                                                    onSimulate({
                                                        initial: currentValue.toFixed(2),
                                                        rate: asset.rate,
                                                        presetId: asset.presetId || 'cdb',
                                                        cdiPercent: asset.cdiPercent
                                                    });
                                                } else {
                                                    router.push(`/investments?initial=${currentValue.toFixed(2)}&rate=${asset.rate}&product=${asset.presetId || 'cdb'}`);
                                                }
                                            }}
                                            style={{ flex: 1, padding: '8px 12px', background: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                        >
                                            🚀 Simular no Simulador
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => openSimulationModal(asset)}
                                            style={{ flex: 1, padding: '8px 12px', background: 'rgba(234,179,8,0.12)', color: '#eab308', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                        >
                                            🚀 Simular Cotação Futura
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Crypto / Currency Fictitious Price Simulation Modal */}
            {simulatingAsset && (
                <div 
                    style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={e => { if (e.target === e.currentTarget) setSimulatingAsset(null) }}
                >
                    <div style={{ background: '#111827', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 24, padding: 28, width: '100%', maxWidth: 500, color: 'white', boxShadow: '0 25px 60px rgba(0,0,0,0.85)', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h4 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                                <span>🚀</span> Simular Cotação: <span style={{ color: '#f59e0b' }}>{simulatingAsset.name}</span>
                            </h4>
                            <button onClick={() => setSimulatingAsset(null)} style={{ background: 'rgba(255,255,255,0.07)', border: 'none', borderRadius: 10, color: 'white', cursor: 'pointer', width: 34, height: 34, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                        </div>

                        {(() => {
                            const symbol = cleanTicker(simulatingAsset.ticker);
                            const usdBrlRate = rates?.usdRate || livePrices['USDT-BRL'] || 5.65;
                            const currentPriceBrl = livePrices[`${symbol}-BRL`] || simulatingAsset.purchasePrice || 1;
                            const currentPriceUsd = livePrices[`${symbol}-USD`] || (currentPriceBrl / usdBrlRate);

                            const baseCurrentPrice = simCurrency === 'USD' ? currentPriceUsd : currentPriceBrl;
                            const targetUnitP = parseFloat(simTargetPrice) || 0;

                            const targetValBase = targetUnitP * simulatingAsset.amount;

                            const targetValBrl = simCurrency === 'USD' ? targetValBase * usdBrlRate : targetValBase;
                            const targetValUsd = simCurrency === 'USD' ? targetValBase : targetValBase / usdBrlRate;

                            const currentValBrl = currentPriceBrl * simulatingAsset.amount;
                            const currentValUsd = currentPriceUsd * simulatingAsset.amount;

                            const profitValBrl = targetValBrl - currentValBrl;
                            const profitValUsd = targetValUsd - currentValUsd;
                            const profitPct = currentValBrl > 0 ? (profitValBrl / currentValBrl) * 100 : 0;
                            const multiplierVal = baseCurrentPrice > 0 ? (targetUnitP / baseCurrentPrice) : 0;

                            const formatUsd = (val) => `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                            const setPresetMultiplier = (mult) => {
                                const newTarget = baseCurrentPrice * mult;
                                setSimTargetPrice(newTarget < 10 ? newTarget.toFixed(4) : newTarget.toFixed(2));
                            };

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                                    {/* Position Info Card */}
                                    <div style={{ background: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Sua Posição Atual</div>
                                            <div style={{ fontSize: 11, background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 12, color: 'rgba(255,255,255,0.7)' }}>
                                                1 USD = R$ {usdBrlRate.toFixed(2)}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 17, fontWeight: 700, margin: '6px 0 2px' }}>
                                            {simulatingAsset.amount} {simulatingAsset.ticker} ({simulatingAsset.name})
                                        </div>
                                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                                            Cotação Atual: <strong>{formatCurrency(currentPriceBrl)}</strong> ({formatUsd(currentPriceUsd)})
                                        </div>
                                    </div>

                                    {/* Currency Selector Switch */}
                                    <div>
                                        <label style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, marginBottom: 8, display: 'block' }}>
                                            Moeda da Simulação
                                        </label>
                                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: 4, borderRadius: 12, gap: 4 }}>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleCurrency('BRL')}
                                                style={{
                                                    flex: 1,
                                                    padding: '9px 12px',
                                                    borderRadius: 8,
                                                    border: 'none',
                                                    background: simCurrency === 'BRL' ? '#10b981' : 'transparent',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: 13,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 6,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <span>🇧🇷</span> Real (R$)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleToggleCurrency('USD')}
                                                style={{
                                                    flex: 1,
                                                    padding: '9px 12px',
                                                    borderRadius: 8,
                                                    border: 'none',
                                                    background: simCurrency === 'USD' ? '#3b82f6' : 'transparent',
                                                    color: 'white',
                                                    fontWeight: 700,
                                                    fontSize: 13,
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 6,
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                <span>💵</span> Dólar (USD $)
                                            </button>
                                        </div>
                                    </div>

                                    {/* Target Price Input */}
                                    <div className="tx-field">
                                        <label>Preço Alvo por Unidade ({simCurrency === 'USD' ? 'USD $' : 'R$'})</label>
                                        <input 
                                            type="number"
                                            step="any"
                                            value={simTargetPrice}
                                            onChange={e => setSimTargetPrice(e.target.value)}
                                            style={{ fontSize: 18, fontWeight: 800, color: '#f59e0b', borderColor: 'rgba(245,158,11,0.4)', padding: 12 }}
                                        />
                                    </div>

                                    {/* Quick Multiplier Pills */}
                                    <div>
                                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Projeções Rápidas</div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {[
                                                { label: '+10%', mult: 1.1 },
                                                { label: '+25%', mult: 1.25 },
                                                { label: '+50%', mult: 1.5 },
                                                { label: '🚀 2x', mult: 2.0 },
                                                { label: '🌕 5x', mult: 5.0 },
                                                { label: '⚡ 10x', mult: 10.0 }
                                            ].map((p, idx) => (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    onClick={() => setPresetMultiplier(p.mult)}
                                                    style={{
                                                        padding: '6px 12px',
                                                        borderRadius: 8,
                                                        border: '1px solid rgba(255,255,255,0.1)',
                                                        background: 'rgba(255,255,255,0.04)',
                                                        color: 'white',
                                                        fontSize: 12,
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s'
                                                    }}
                                                >
                                                    {p.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Live Simulation Results */}
                                    <div style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(0,0,0,0.3) 100%)', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 16, padding: 20 }}>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>
                                            Patrimônio Simulado
                                        </div>
                                        <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b', margin: '4px 0 2px' }}>
                                            {simCurrency === 'USD' ? formatUsd(targetValUsd) : formatCurrency(targetValBrl)}
                                        </div>
                                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 12 }}>
                                            Equivale a: <strong style={{ color: 'white' }}>{simCurrency === 'USD' ? formatCurrency(targetValBrl) : formatUsd(targetValUsd)}</strong>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 6 }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Lucro / Valorização:</span>
                                            <span style={{ fontWeight: 700, color: profitValBrl >= 0 ? '#10b981' : '#ef4444' }}>
                                                {profitValBrl >= 0 ? '+' : ''}{simCurrency === 'USD' ? formatUsd(profitValUsd) : formatCurrency(profitValBrl)} ({profitPct >= 0 ? '+' : ''}{profitPct.toFixed(2)}%)
                                            </span>
                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 8 }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Multiplicador:</span>
                                            <span style={{ fontWeight: 700, color: '#60a5fa' }}>
                                                {multiplierVal.toFixed(2)}x ({(multiplierVal * 100 - 100) >= 0 ? '+' : ''}{(multiplierVal * 100 - 100).toFixed(0)}%)
                                            </span>
                                        </div>
                                    </div>

                                    <button 
                                        type="button" 
                                        onClick={() => setSimulatingAsset(null)}
                                        className="btn-primary"
                                        style={{ width: '100%', padding: 12, fontSize: 14 }}
                                    >
                                        Fechar Simulação
                                    </button>
                                </div>
                            )
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
}
