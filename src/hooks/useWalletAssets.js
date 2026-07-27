"use client";

import { useState, useEffect, useCallback } from 'react';

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

export function useWalletAssets(userEmail) {
    const [assets, setAssets] = useState([]);
    const [livePrices, setLivePrices] = useState({});
    const [loadingPrices, setLoadingPrices] = useState(false);

    useEffect(() => {
        if (!userEmail) return;
        const loadAssets = () => {
            const saved = localStorage.getItem(`finance_assets_${userEmail}`);
            if (saved) {
                try {
                    setAssets(JSON.parse(saved));
                } catch (e) {
                    console.error("Error loading assets", e);
                }
            } else {
                setAssets([]);
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
        const fetchTargets = assets.filter(a => a.type === 'crypto' || a.type === 'currency')
            .map(a => TICKER_MAP[a.ticker?.toUpperCase()] || `${a.ticker?.toUpperCase()}-BRL`);
        if (fetchTargets.length === 0) return;

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
    }, [assets]);

    useEffect(() => {
        fetchPrices();
        const interval = setInterval(fetchPrices, 60000);
        return () => clearInterval(interval);
    }, [fetchPrices]);

    const calculateCurrentValue = useCallback((asset) => {
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
            const targetKey = TICKER_MAP[asset.ticker?.toUpperCase()] || `${asset.ticker?.toUpperCase()}-BRL`;
            const price = livePrices[targetKey] || 0;
            return price > 0 ? asset.amount * price : asset.amount;
        }
    }, [livePrices]);

    const totalNetWorth = assets.reduce((sum, asset) => sum + calculateCurrentValue(asset), 0);

    return { assets, setAssets, livePrices, loadingPrices, totalNetWorth, calculateCurrentValue, fetchPrices };
}
