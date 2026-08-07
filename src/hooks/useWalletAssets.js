"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const cleanTicker = (ticker) => {
    if (!ticker) return 'BTC';
    const upper = String(ticker).toUpperCase().trim();
    if (upper === 'BITCOIN') return 'BTC';
    if (upper === 'ETHEREUM') return 'ETH';
    if (upper === 'DOLAR' || upper === 'DÓLAR') return 'USD';
    if (upper === 'EURO') return 'EUR';
    return upper;
};

export function useWalletAssets(userEmail) {
    const [assets, setAssets] = useState([]);
    const [livePrices, setLivePrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(false);

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

                const localSaved = localStorage.getItem(`finance_assets_${userEmail}`);
                if (localSaved) {
                    try {
                        const localItems = JSON.parse(localSaved);
                        if (Array.isArray(localItems) && localItems.length > 0) {
                            for (const item of localItems) {
                                const exists = cloudAssets.some(c => String(c.id) === String(item.id));
                                if (!exists) {
                                    cloudAssets.push(item);
                                }
                            }
                        }
                    } catch (e) {}
                }

                setAssets(cloudAssets);
            } catch (err) {
                console.error("Error loading assets in hook", err);
            }
        };

        loadAssets();

        window.addEventListener('storage', loadAssets);
        window.addEventListener('wallet_updated', loadAssets);
        return () => {
            window.removeEventListener('storage', loadAssets);
            window.removeEventListener('wallet_updated', loadAssets);
        };
    }, [userEmail]);

    const fetchPrices = useCallback(async () => {
        const liveAssets = (assets || []).filter(a => a && (a.type === 'crypto' || a.type === 'currency'));
        
        // Always include BTC-BRL, ETH-BRL, USD-BRL in fetch targets
        const fetchTargets = ['BTC-BRL', 'ETH-BRL', 'USD-BRL', 'USDT-BRL'];
        liveAssets.forEach(a => {
            const symbol = cleanTicker(a.ticker);
            if (symbol) {
                fetchTargets.push(`${symbol}-BRL`);
                if (symbol !== 'USD' && symbol !== 'BRL') {
                    fetchTargets.push(`${symbol}-USD`);
                }
            }
        });

        const uniqueTargets = [...new Set(fetchTargets)];
        const url = `https://economia.awesomeapi.com.br/last/${uniqueTargets.join(',')}`;

        try {
            setLoadingPrices(true);
            const newPrices = {};

            // 1. Fetch from AwesomeAPI
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const data = await res.json();
                    uniqueTargets.forEach(target => {
                        const key = target.replace('-', '');
                        if (data && data[key] && data[key].ask) {
                            newPrices[target] = parseFloat(data[key].ask);
                        }
                    });
                }
            } catch (e) {
                console.error("AwesomeAPI fetch error", e);
            }

            // 2. Fetch live BTC-BRL price from Binance for real-time market accuracy
            try {
                const btcRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=BTCBRL');
                if (btcRes.ok) {
                    const btcData = await btcRes.json();
                    if (btcData && btcData.price) {
                        const btcPrice = parseFloat(btcData.price);
                        if (Number.isFinite(btcPrice) && btcPrice > 0) {
                            newPrices['BTC-BRL'] = btcPrice;
                            newPrices['BITCOIN-BRL'] = btcPrice;
                        }
                    }
                }
            } catch (e) {
                // Binance fallback silent fail
            }

            setLivePrices(prev => ({ ...prev, ...newPrices }));
        } catch (error) {
            console.error("Failed to fetch live prices", error);
        } finally {
            setLoadingPrices(false);
        }
    }, [assets]);

    useEffect(() => {
        fetchPrices();
        const interval = setInterval(fetchPrices, 15000);
        return () => clearInterval(interval);
    }, [fetchPrices]);

    const calculateCurrentValue = useCallback((asset) => {
        if (!asset) return 0;
        if (asset.manualBalance !== undefined && asset.manualBalance !== null && asset.manualBalance !== '') {
            return parseFloat(asset.manualBalance) || 0;
        }
        if (asset.type === 'fixed') {
            const start = new Date(asset.date || new Date());
            const now = new Date();
            const daysElapsed = Math.max(0, (now - start) / (1000 * 60 * 60 * 24));
            const yearsElapsed = daysElapsed / 365;
            return (asset.amount || 0) * Math.pow(1 + ((asset.rate || 0) / 100), yearsElapsed);
        } else {
            const symbol = cleanTicker(asset.ticker);
            const price = livePrices[`${symbol}-BRL`] || (asset.type === 'crypto' ? livePrices['BTC-BRL'] : 0);
            return price > 0 ? (asset.amount || 0) * price : (asset.amount || 0);
        }
    }, [livePrices]);

    const safeAssets = Array.isArray(assets) ? assets : [];
    const totalNetWorth = safeAssets.reduce((sum, asset) => sum + calculateCurrentValue(asset), 0);

    return { assets: safeAssets, setAssets, livePrices, loadingPrices, totalNetWorth, calculateCurrentValue, fetchPrices };
}
