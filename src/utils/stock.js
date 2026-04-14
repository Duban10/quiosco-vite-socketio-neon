export function getStockState(stock = 0) {
    if (stock <= 0) return 'out';
    if (stock < 3) return 'low';
    if (stock < 8) return 'medium';
    return 'high';
}

export function getStockConfig(stock = 0) {
    const state = getStockState(stock);

    if (state === 'out') {
        return {
            state,
            label: 'Sin stock',
            shortLabel: 'Agotado',
            color: '#ef4444',
            background: 'rgba(239,68,68,0.14)',
            border: '1px solid rgba(239,68,68,0.28)'
        };
    }

    if (state === 'low') {
        return {
            state,
            label: 'Stock bajo',
            shortLabel: 'Bajo',
            color: '#ef4444',
            background: 'rgba(239,68,68,0.14)',
            border: '1px solid rgba(239,68,68,0.28)'
        };
    }

    if (state === 'medium') {
        return {
            state,
            label: 'Stock medio',
            shortLabel: 'Medio',
            color: '#f97316',
            background: 'rgba(249,115,22,0.14)',
            border: '1px solid rgba(249,115,22,0.28)'
        };
    }

    return {
        state,
        label: 'Stock alto',
        shortLabel: 'Alto',
        color: '#22c55e',
        background: 'rgba(34,197,94,0.14)',
        border: '1px solid rgba(34,197,94,0.28)'
    };
}
