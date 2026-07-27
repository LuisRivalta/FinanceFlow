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
    }, [assets, userEmail]);

    // Fetch live prices
    const fetchPrices = async () => {
        const fetchTargets = assets.filter(a => a.type === 'crypto' || a.type === 'currency').map(a => TICKER_MAP[a.ticker.toUpperCase()] || `${a.ticker.toUpperCase()}-BRL`);
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
            date: new Date().toISOString()
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
    };

    const removeAsset = (id) => {
        setAssets(assets.filter(a => a.id !== id));
    };

    // Calculate current values
    const calculateCurrentValue = (asset) => {
        if (asset.type === 'fixed') {
            // Compound interest based on days elapsed
            const start = new Date(asset.date);
            const now = new Date();
            const daysElapsed = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
            const yearsElapsed = daysElapsed / 365;
            return asset.amount * Math.pow(1 + (asset.rate / 100), yearsElapsed);
        } else {
            // Live price from API
            const targetKey = TICKER_MAP[asset.ticker] || `${asset.ticker}-BRL`;
            const price = livePrices[targetKey] || 0;
            return asset.amount * price;
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
                            <label>{addType === 'fixed' ? 'Nome (ex: Poupança)' : 'Sigla (ex: BTC, USD)'}</label>
                            <input 
                                required
                                type="text" 
                                value={addName} 
                                onChange={e => setAddName(e.target.value)} 
                                placeholder={addType === 'fixed' ? 'Tesouro Direto' : 'BTC'}
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
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
                        
                        return (
                            <div key={asset.id} className="card glass-panel fade-up clickable-card" style={{ padding: 20, animationDelay: `${(idx + 2) * 0.1}s`, position: 'relative' }}>
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
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 16 }}>{asset.name}</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                                            {asset.type === 'fixed' ? `Rendendo ${asset.rate}% a.a.` : `${asset.amount} unidades`}
                                        </div>
                                    </div>
                                </div>
                                
                                <div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>Valor Atual</div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>
                                        {formatCurrency(currentValue)}
                                    </div>
                                    
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
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    );
}
