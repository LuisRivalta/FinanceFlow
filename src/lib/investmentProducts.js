// Catálogo dos produtos de renda fixa que o simulador oferece.
//
// `multiplierKind` decide como a taxa sai do índice:
//   percent_of → índice × multiplicador / 100   (CDB 100% do CDI)
//   spread     → índice + multiplicador         (Tesouro IPCA+ 6%)
//   none       → o índice puro, sem campo de multiplicador
//
// Os multiplicadores default são convenções comuns de mercado, não recomendação.
// `taxExempt` só controla um selo informativo — o simulador trabalha com valor
// bruto e não calcula IR.
export const INVESTMENT_PRODUCTS = [
    {
        id: 'poupanca',
        label: 'Poupança',
        iconName: 'PiggyBank',
        index: 'poupanca',
        indexLabel: 'Poupança',
        multiplierKind: 'none',
        defaultMultiplier: null,
        taxExempt: true,
        hint: null,
    },
    {
        id: 'cdb',
        label: 'CDB / RDB',
        iconName: 'Landmark',
        index: 'cdi',
        indexLabel: 'CDI',
        multiplierKind: 'percent_of',
        defaultMultiplier: 100,
        taxExempt: false,
        hint: null,
    },
    {
        id: 'lci_lca',
        label: 'LCI / LCA',
        iconName: 'HardHat',
        index: 'cdi',
        indexLabel: 'CDI',
        multiplierKind: 'percent_of',
        defaultMultiplier: 95,
        taxExempt: true,
        hint: null,
    },
    {
        id: 'tesouro_selic',
        label: 'Tesouro Selic',
        iconName: 'Building2',
        index: 'selic',
        indexLabel: 'Selic',
        multiplierKind: 'spread',
        defaultMultiplier: 0,
        taxExempt: false,
        hint: null,
    },
    {
        id: 'tesouro_ipca',
        label: 'Tesouro IPCA+',
        iconName: 'BarChart3',
        index: 'ipca12',
        indexLabel: 'IPCA',
        multiplierKind: 'spread',
        defaultMultiplier: 6,
        taxExempt: false,
        hint: null,
    },
    {
        id: 'tesouro_pre',
        label: 'Tesouro Prefixado',
        iconName: 'Pin',
        index: 'selic',
        indexLabel: 'Selic',
        multiplierKind: 'spread',
        defaultMultiplier: 0,
        taxExempt: false,
        hint: 'A taxa do prefixado é definida por leilão e não tem fonte pública ao vivo. Usamos a Selic como referência — ajuste conforme o seu título.',
    },
    {
        id: 'fundo_di',
        label: 'Fundo DI',
        iconName: 'Package',
        index: 'cdi',
        indexLabel: 'CDI',
        multiplierKind: 'percent_of',
        defaultMultiplier: 98,
        taxExempt: false,
        hint: null,
    },
    {
        id: 'custom',
        label: 'Personalizado',
        iconName: 'Pencil',
        index: null,
        indexLabel: null,
        multiplierKind: 'none',
        defaultMultiplier: null,
        taxExempt: false,
        hint: null,
    },
]

export const DEFAULT_PRODUCT_ID = 'cdb'

export function getProduct(id) {
    return INVESTMENT_PRODUCTS.find(p => p.id === id) || null
}

// Devolve null quando não há taxa derivável — produto sem índice (Personalizado),
// índice ausente nas taxas, ou multiplicador inválido. Quem consome usa esse null
// para NÃO sobrescrever a taxa que o usuário digitou à mão.
export function deriveRate(product, rates, multiplier) {
    if (!product || !product.index) return null

    const base = rates?.[product.index]?.value
    if (!Number.isFinite(base)) return null

    let rate
    if (product.multiplierKind === 'percent_of') {
        if (!Number.isFinite(multiplier)) return null
        rate = base * (multiplier / 100)
    } else if (product.multiplierKind === 'spread') {
        if (!Number.isFinite(multiplier)) return null
        rate = base + multiplier
    } else {
        rate = base
    }

    // Arredondar não é cosmético: 14,15 × 0,95 dá 13.442499999999999 em IEEE 754,
    // e esse número cru vazaria pro campo de taxa.
    return Math.round(rate * 100) / 100
}

export function multiplierLabel(product) {
    if (!product || product.multiplierKind === 'none') return null
    if (product.multiplierKind === 'percent_of') return `% do ${product.indexLabel}`
    return `${product.indexLabel} + (%)`
}
