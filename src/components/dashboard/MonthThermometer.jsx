import React from 'react'

export default function MonthThermometer({
    income = 0,
    expense = 0,
    directExpense = 0,
    creditExpense = 0,
    formatCurrency
}) {
    const spendPct = income > 0 ? (expense / income) * 100 : expense > 0 ? 100 : 0
    let statusMsg = "Tudo tranquilo! Você não gastou quase nada ainda."
    let statusColor = "#10b981" // green

    if (spendPct > 85) {
        statusMsg = "Cuidado! Seus gastos estão altíssimos em relação à renda do mês."
        statusColor = "#ef4444" // red
    } else if (spendPct > 60) {
        statusMsg = "Atenção. Os gastos já ultrapassaram a metade da sua receita."
        statusColor = "#f59e0b" // yellow
    } else if (spendPct > 0) {
        statusMsg = "Saudável! Seus gastos estão sob controle."
        statusColor = "#3b82f6" // blue
    } else if (income === 0 && expense === 0) {
        statusMsg = "Sem lançamentos neste mês."
        statusColor = "#94a3b8" // gray
    }

    return (
        <section className="fade-up delay-1" style={{ marginBottom: 24 }}>
            <div
                className="card glass-panel"
                style={{
                    padding: '24px 32px',
                    display: 'flex',
                    flexDirection: 'column',
                    border: `1px solid ${statusColor}44`,
                    background: `linear-gradient(90deg, ${statusColor}11 0%, rgba(255,255,255,0.02) 100%)`
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                            Termômetro do Mês
                        </div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>
                            {statusMsg}
                        </div>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: statusColor }}>
                        {Math.min(100, Math.round(spendPct))}%
                    </div>
                </div>

                <div style={{ width: '100%', height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 10, overflow: 'hidden' }}>
                    <div
                        style={{
                            height: '100%',
                            width: `${Math.min(100, spendPct)}%`,
                            background: statusColor,
                            borderRadius: 10,
                            transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                    <span>R$ 0</span>
                    <span>{formatCurrency(income)} (Receita)</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    Gasto total do mês: <strong style={{ color: 'white' }}>{formatCurrency(expense)}</strong>
                    {' — '}débito {formatCurrency(directExpense)} + crédito {formatCurrency(creditExpense)}
                </div>
            </div>
        </section>
    )
}
