"use client";

import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../helpers';

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

export default function Wallet({ userEmail }) {
    const [assets, setAssets] = useState([]);
    const [livePrices, setLivePrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    
    // Form state
    const [addType, setAddType] = useState('crypto'); // crypto, currency, fixed
    const [addName, setAddName] = useState('');
    const [addAmount, setAddAmount] = useState('');
    const [addRate, setAddRate] = useState('');
    const [addManualBalance, setAddManualBalance] = useState('');

    // Editing manual balance inline state
    const [editingAssetId, setEditingAssetId] = useState(null);
    const [editBalanceVal, setEditBalanceVal] = useState('');

    // Load assets from localStorage on mount
    useEffect(() => {
        if (!userEmail) return;
        const saved = localStorage.getItem(`finance_assets_${userEmail}`);
        if (saved) {
            try {
                setAssets(JSON.parse(saved));
            } catch (e) {
                console.error("Error loading assets", e);
            }
        }
    }, [userEmail]);

    // Save to localStorage when assets change
    useEffect(() => {
        if (!userEmail) return;
        localStorage.setItem(`finance_assets_${userEmail}`, JSON.stringify(assets));
        window.dispatchEvent(new Event('wallet_updated'));
    }, [assets, userEmail]);

    // Fetch live prices
    const fetchPrices = async () => {
        const fetchTargets = assets.filter(a => a.type === 'crypto' || a.type === 'currency').map(a => TICKER_MAP[a.ticker?.toUpperCase()] || `${a.ticker?.toUpperCase()}-BRL`);
        if (fetchTargets.length === 0) return;

        // Deduplicate
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

    // Fetch prices when assets change or on mount
    useEffect(() => {
        fetchPrices();
        const interval = setInterval(fetchPrices, 60000); // refresh every minute
        return () => clearInterval(interval);
    }, [assets]);

    const handleAddAsset = (e) => {
        e.preventDefault();
        const newAsset = {
            id: Date.now().toString(),
            type: addType,
            amount: parseFloat(addAmount),
            date: new Date().toISOString(),
            manualBalance: addManualBalance ? parseFloat(addManualBalance) : null
        };

        if (addType === 'fixed') {
            newAsset.name = addName;
            newAsset.rate = parseFloat(addRate);
        } else {
            newAsset.ticker = addName.toUpperCase();
            newAsset.name = addName.toUpperCase();
        }

        setAssets([...assets, newAsset]);
        setIsAdding(false);
        setAddName('');
        setAddAmount('');
        setAddRate('');
        setAddManualBalance('');
    };

    const removeAsset = (id) => {
        setAssets(assets.filter(a => a.id !== id));
    };

    const handleSaveManualBalance = (assetId, valueStr) => {
        const val = valueStr !== '' && !isNaN(valueStr) ? parseFloat(valueStr) : null;
        setAssets(assets.map(a => a.id === assetId ? { ...a, manualBalance: val } : a));
        setEditingAssetId(null);
        setEditBalanceVal('');
    };

    const handleResetToAutomatic = (assetId) => {
        setAssets(assets.map(a => a.id === assetId ? { ...a, manualBalance: null } : a));
        setEditingAssetId(null);
        setEditBalanceVal('');
    };

    // Calculate current values
    const calculateCurrentValue = (asset) => {
        if (asset.manualBalance !== undefined && asset.manualBalance !== null && asset.manualBalance !== '') {
            return parseFloat(asset.manualBalance);
        }
        if (asset.type === 'fixed') {
            // Compound interest based on days elapsed
            const start = new Date(asset.date);
            const now = new Date();
            const daysElapsed = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
            const yearsElapsed = daysElapsed / 365;
            return asset.amount * Math.pow(1 + ((asset.rate || 0) / 100), yearsElapsed);
        } else {
            // Live price from API
            const targetKey = TICKER_MAP[asset.ticker] || `${asset.ticker}-BRL`;
            const price = livePrices[targetKey] || 0;
            return price > 0 ? asset.amount * price : asset.amount;
        }
    };

    const totalNetWorth = assets.reduce((sum, asset) => sum + calculateCurrentValue(asset), 0);

    return (
        <div style={{ marginTop: 40, marginBottom: 40 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
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
                        <div className="tx-field" style={{ flex: 1, minWidth: 150 }}>
                            <label>Tipo de Ativo</label>
                            <select value={addType} onChange={e => setAddType(e.target.value)}>
                                <option value="crypto">Criptomoeda</option>
                                <option value="currency">Moeda Estrangeira</option>
                                <option value="fixed">Renda Fixa / CDI</option>
                            </select>
                        </div>
                        
                        <div className="tx-field" style={{ flex: 1, minWidth: 150 }}>
                            <label>{addType === 'fixed' ? 'Nome (ex: Poupança, CDB)' : 'Sigla (ex: BTC, USD)'}</label>
                            <input 
                                required
                                type="text" 
                                value={addName} 
                                onChange={e => setAddName(e.target.value)} 
                                placeholder={addType === 'fixed' ? 'Tesouro Direto / CDB' : 'BTC'}
                            />
                        </div>

                        <div className="tx-field" style={{ flex: 1, minWidth: 150 }}>
                            <label>{addType === 'fixed' ? 'Valor Investido (R$)' : 'Quantidade'}</label>
                            <input 
                                required
                                type="number" 
                                step="any"
                                min="0"
                                value={addAmount} 
                                onChange={e => setAddAmount(e.target.value)} 
                                placeholder={addType === 'fixed' ? '10000' : '0.5'}
                            />
                        </div>

                        {addType === 'fixed' && (
                            <div className="tx-field" style={{ flex: 1, minWidth: 150 }}>
                                <label>Taxa Anual (%)</label>
                                <input 
                                    required
                                    type="number" 
                                    step="0.1"
                                    min="0"
                                    value={addRate} 
                                    onChange={e => setAddRate(e.target.value)} 
                                    placeholder="10.4"
                                />
                            </div>
                        )}

                        <div className="tx-field" style={{ flex: 1, minWidth: 150 }}>
                            <label>Saldo Atual (R$) (opcional)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                min="0"
                                value={addManualBalance} 
                                onChange={e => setAddManualBalance(e.target.value)} 
                                placeholder="Deixe em branco para auto"
                            />
                        </div>

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
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

                        // Calculation of profit for fixed income or overall
                        const initialCost = asset.type === 'fixed' ? asset.amount : 0;
                        const profit = initialCost > 0 ? currentValue - initialCost : 0;
                        const profitPct = initialCost > 0 ? (profit / initialCost) * 100 : 0;
                        
                        return (
                            <div key={asset.id} className="card glass-panel fade-up" style={{ padding: 20, animationDelay: `${(idx + 2) * 0.1}s`, position: 'relative' }}>
                                <button 
                                    onClick={() => removeAsset(asset.id)}
                                    style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.5 }}
                                    title="Remover"
                                >
                                    ✖
                                </button>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                                        {asset.type === 'crypto' ? '₿' : asset.type === 'currency' ? '💵' : '🏦'}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 16, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{asset.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {asset.type === 'fixed' ? `Taxa base ${asset.rate}% a.a.` : `${asset.amount} unidades`}
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
                                                placeholder="Digite o saldo atual exato..."
                                                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #3b82f6', background: '#111827', color: 'white', fontSize: 14 }}
                                                autoFocus
                                            />
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <button 
                                                    type="button" 
                                                    onClick={() => handleSaveManualBalance(asset.id, editBalanceVal)}
                                                    style={{ flex: 1, padding: '6px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    Salvar Saldo
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

                                            {isLive && (
                                                <div style={{ fontSize: 12, color: '#eab308', marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>Cotação:</span>
                                                    <span>
                                                        {livePrices[TICKER_MAP[asset.ticker] || `${asset.ticker}-BRL`] 
                                                            ? formatCurrency(livePrices[TICKER_MAP[asset.ticker] || `${asset.ticker}-BRL`]) 
                                                            : 'Buscando...'}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
