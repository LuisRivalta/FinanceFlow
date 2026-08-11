// Constantes de categorias
export const CATEGORY_MAP = {
    expense: [
        { id: 'food', label: 'Alimentação', iconName: 'Utensils', color: '#f59e0b' },
        { id: 'transport', label: 'Transporte', iconName: 'Car', color: '#3b82f6' },
        { id: 'housing', label: 'Moradia', iconName: 'Home', color: '#8b5cf6' },
        { id: 'health', label: 'Saúde', iconName: 'Pill', color: '#ef4444' },
        { id: 'leisure', label: 'Lazer', iconName: 'Theater', color: '#ec4899' },
        { id: 'education', label: 'Educação', iconName: 'BookOpen', color: '#06b6d4' },
        { id: 'invoice_payment', label: 'Pagamento de Fatura', iconName: 'Receipt', color: '#3b82f6' },
        { id: 'other_expense', label: 'Outros', iconName: 'ShoppingBag', color: '#94a3b8' }
    ],
    income: [
        { id: 'salary', label: 'Salário', iconName: 'Briefcase', color: '#10b981' },
        { id: 'freelance', label: 'Freelance', iconName: 'Laptop', color: '#3b82f6' },
        { id: 'gift', label: 'Presente/Bônus', iconName: 'Gift', color: '#f59e0b' },
        { id: 'other_income', label: 'Outros', iconName: 'Coins', color: '#94a3b8' }
    ],
    investment: [
        { id: 'stocks', label: 'Ações/Bolsa', iconName: 'TrendingUp', color: '#8b5cf6' },
        { id: 'crypto', label: 'Criptomoedas', iconName: 'Bitcoin', color: '#f59e0b' },
        { id: 'fixed', label: 'Renda Fixa', iconName: 'Landmark', color: '#10b981' },
        { id: 'other_inv', label: 'Outros', iconName: 'Rocket', color: '#94a3b8' }
    ]
}

export const ACCOUNTS = [
    { id: 'cash', label: 'Dinheiro', iconName: 'Banknote' },
    { id: 'checking', label: 'Conta Corrente', iconName: 'Landmark' },
    { id: 'savings', label: 'Poupança', iconName: 'PiggyBank' },
    { id: 'credit', label: 'Cartão de Crédito', iconName: 'CreditCard' },
    { id: 'investment', label: 'Investimentos', iconName: 'TrendingUp' },
    { id: 'outros', label: 'Outros', iconName: 'Folder' }
]

export function getCategoryDetails(type, catId) {
    const defaultCat = { label: 'Indefinido', iconName: 'Pin', color: '#94a3b8' }
    const cats = CATEGORY_MAP[type]
    if (!cats) return defaultCat
    return cats.find(c => c.id === catId) || defaultCat
}

export function getAccountLabel(id) {
    return ACCOUNTS.find(a => a.id === id) || { label: id, iconName: 'Folder' }
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

// Linhas de sistema (cadastro de financiamento, ativos da carteira, contas a
// receber) moram na mesma tabela das transações, mas não são movimentações do
// usuário — algumas até gravam type 'expense'/'income'. Quem lê `transactions`
// direto do Supabase precisa aplicar este filtro; o useTransactions já aplica.
export function isUserTransaction(t) {
    if (!t) return false
    return t.type !== 'system'
        && t.category !== 'system_asset'
        && t.category !== 'system_financing'
        && t.category !== 'system_receivable'
}

// Saída de dinheiro de verdade: o pagamento de fatura não é um gasto novo,
// as compras que formaram a fatura já foram contadas uma vez.
export function isSpending(t) {
    return !!t && t.type === 'expense' && t.category !== 'invoice_payment'
}

export function calcBalance(txList) {
    return (txList || []).reduce((acc, t) => {
        if (!t || t.category === 'system_asset' || t.category === 'system_financing' || t.type === 'system' || t.type === 'investment') return acc;
        if (t.type === 'income') return acc + t.amount;
        // Despesas de cartão de crédito não afetam o saldo da conta corrente (só o pagamento da fatura)
        if (t.type === 'expense' && t.account !== 'credit') return acc - t.amount;
        return acc;
    }, 0);
}

export function calcIncome(txList) {
    return (txList || []).filter(t => t && t.type === 'income' && t.type !== 'investment' && t.type !== 'system' && t.category !== 'system_asset' && t.category !== 'system_financing').reduce((s, t) => s + t.amount, 0);
}

export function calcExpense(txList) {
    // Pagamento de fatura não entra como despesa dupla, pois os gastos do cartão já foram contabilizados nas categorias
    return (txList || []).filter(isSpending).reduce((s, t) => s + t.amount, 0)
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
        recurringDuration: t.recurring_duration,
        creditCardId: t.credit_card_id,
        isSubscription: t.is_subscription,
        installmentNumber: t.installment_number,
        installmentTotal: t.installment_total
    }
}

export function formatPercent(value, decimals = 2) {
    if (!Number.isFinite(value)) return '—'
    return `${value.toFixed(decimals).replace('.', ',')}%`
}
