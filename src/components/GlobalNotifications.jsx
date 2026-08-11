"use client";

import NotificationCenter from './NotificationCenter';
import { useSession } from '../hooks/useSession';
import { useReceivables } from '../hooks/useReceivablesData';
import { useTransactions } from '../hooks/useTransactions';
import { useCreditCards } from '../hooks/useCards';
import { useFinancings } from '../hooks/useFinancings';
import { formatCurrency } from '../helpers';

// Sino de notificações disponível em todas as páginas. Fica montado dentro da
// Sidebar (que é global) e busca os próprios dados, então nenhuma página
// precisa passar nada. Ver docs/contas-a-receber-e-notificacoes.md
export default function GlobalNotifications() {
    const session = useSession();
    const email = session?.email;

    const { receivables, markAsReceived } = useReceivables(email);
    const { financings, payInstallment } = useFinancings(email);
    const { cards } = useCreditCards(email);
    const { transactions, create: createTx } = useTransactions(email);

    // O sino é sempre renderizado: a Sidebar só existe em páginas autenticadas,
    // e sumir silenciosamente enquanto a sessão resolve deixa a navbar
    // inconsistente. Sem e-mail os hooks simplesmente não consultam nada.

    const handleMarkReceived = (id, ym) => {
        const item = receivables.find(r => r.id === id || r.dbId === id);
        if (!item) return;

        const ok = confirm(`Confirmar o recebimento de ${formatCurrency(item.amount)} referente a "${item.name}"?\nIsso adicionará o valor à sua Conta Corrente.`);
        if (!ok) return;

        markAsReceived(id, ym, (txData) => {
            createTx(txData).catch(err => console.error("Erro ao registrar entrada de receita:", err));
        });
    };

    const handlePayFinancing = (f) => {
        if (!f) return;
        const remaining = f.totalInstallments - f.paidInstallments;
        if (remaining <= 0) {
            alert('Este financiamento já está 100% quitado!');
            return;
        }

        const nextNum = f.paidInstallments + 1;
        const ok = confirm(`Confirmar o pagamento da parcela ${nextNum}/${f.totalInstallments} no valor de ${formatCurrency(f.monthlyPayment)}?\n\nIsso avançará seu progresso e registrará o lançamento da despesa.`);
        if (!ok) return;

        payInstallment(f.id, (txData) => {
            createTx(txData).catch(err => console.error("Erro ao registrar transação da parcela", err));
        });
    };

    const handlePayCardInvoice = (card, invoiceAmount) => {
        if (!card) return;
        if (invoiceAmount <= 0) {
            alert('A fatura deste mês já está zerada ou paga.');
            return;
        }

        const ok = confirm(`Deseja pagar o valor de ${formatCurrency(invoiceAmount)} referente à fatura do cartão ${card.name}?\nIsso debitará o valor da sua Conta Corrente.`);
        if (!ok) return;

        createTx({
            desc: `Pagamento Fatura - ${card.name}`,
            amount: invoiceAmount,
            type: 'expense',
            category: 'invoice_payment',
            account: 'checking',
            date: new Date().toISOString().split('T')[0],
            creditCardId: card.id
        }).catch(err => console.error("Erro ao registrar pagamento de fatura", err));
    };

    return (
        <NotificationCenter
            receivables={receivables}
            financings={financings}
            cards={cards}
            transactions={transactions}
            onMarkReceived={handleMarkReceived}
            onPayFinancing={handlePayFinancing}
            onPayCardInvoice={handlePayCardInvoice}
        />
    );
}
