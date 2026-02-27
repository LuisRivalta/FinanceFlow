// Constantes de categorias
export const CATEGORY_MAP = {
    expense: [
        { id: 'food', label: 'Alimentação', icon: '🍔', color: '#f59e0b' },
        { id: 'transport', label: 'Transporte', icon: '🚗', color: '#3b82f6' },
        { id: 'housing', label: 'Moradia', icon: '🏠', color: '#8b5cf6' },
        { id: 'health', label: 'Saúde', icon: '💊', color: '#ef4444' },
        { id: 'leisure', label: 'Lazer', icon: '🎭', color: '#ec4899' },
        { id: 'education', label: 'Educação', icon: '📚', color: '#06b6d4' },
        { id: 'other_expense', label: 'Outros', icon: '🛍️', color: '#94a3b8' }
    ],
    income: [
        { id: 'salary', label: 'Salário', icon: '💼', color: '#10b981' },
        { id: 'freelance', label: 'Freelance', icon: '💻', color: '#3b82f6' },
        { id: 'gift', label: 'Presente/Bônus', icon: '🎁', color: '#f59e0b' },
        { id: 'other_income', label: 'Outros', icon: '💰', color: '#94a3b8' }
    ],
    investment: [
        { id: 'stocks', label: 'Ações/Bolsa', icon: '📈', color: '#8b5cf6' },
        { id: 'crypto', label: 'Criptomoedas', icon: '₿', color: '#f59e0b' },
        { id: 'fixed', label: 'Renda Fixa', icon: '🏦', color: '#10b981' },
        { id: 'other_inv', label: 'Outros', icon: '🚀', color: '#94a3b8' }
    ]
}

export const ACCOUNTS = [
    { id: 'cash', label: 'Dinheiro', icon: '💵' },
    { id: 'checking', label: 'Conta Corrente', icon: '🏦' },
    { id: 'savings', label: 'Poupança', icon: '💰' },
    { id: 'credit', label: 'Cartão de Crédito', icon: '💳' },
    { id: 'investment', label: 'Investimentos', icon: '📈' },
    { id: 'outros', label: 'Outros', icon: '📁' }
]

export function getCategoryDetails(type, catId) {
    const defaultCat = { label: 'Indefinido', icon: '📌', color: '#94a3b8' }
    const cats = CATEGORY_MAP[type]
    if (!cats) return defaultCat
    return cats.find(c => c.id === catId) || defaultCat
}

export function getAccountLabel(id) {
    return ACCOUNTS.find(a => a.id === id) || { label: id, icon: '📁' }
}

export function formatCurrency(amount) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
}

export function formatDate(dateString) {
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    })
}

export function formatCurrencyWithSign(amount, type) {
    const sign = type === 'expense' ? '-' : type === 'income' ? '+' : ''
    return `${sign} ${formatCurrency(Math.abs(amount))}`
}

export function calcBalance(txList) {
    return txList.reduce((acc, t) => {
        if (t.type === 'income') return acc + t.amount
        if (t.type === 'expense') return acc - t.amount
        return acc
    }, 0)
}

export function calcIncome(txList) {
    return txList.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
}

export function calcExpense(txList) {
    return txList.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
}

export function calcInvestment(txList) {
    return txList.filter(t => t.type === 'investment').reduce((s, t) => s + t.amount, 0)
}

export function mapFromDB(t) {
    return {
        id: t.id,
        desc: t.description,
        amount: Number(t.amount),
        type: t.type,
        category: t.category,
        account: t.account || 'outros',
        date: t.date,
        note: t.note || '',
        isRecurring: t.is_recurring,
        parentId: t.parent_id,
        recurringDuration: t.recurring_duration
    }
}
