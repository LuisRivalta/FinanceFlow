export async function POST(req) {
    try {
        const body = await req.json();
        const { income = 0, budgets = [], expenses = [] } = body;

        const apiKey = process.env.GEMINI_API_KEY;

        if (apiKey) {
            try {
                const promptText = `Você é um consultor financeiro pessoal especialista de alto nível do aplicativo Blumii FinanceFlow.
Analise os dados financeiros abaixo e forneça um diagnóstico profissional, empático e prático com dicas para otimização de orçamento:

- Renda Mensal: R$ ${income.toFixed(2)}
- Metas de Orçamento por Categoria: ${JSON.stringify(budgets)}
- Gastos Reais no Mês: ${JSON.stringify(expenses)}

Estrutura da sua resposta:
1. Diagnóstico Geral (resumo da saúde do orçamento).
2. Pontos de Atenção (categorias estouradas ou próximas do limite).
3. Ações Práticas Recomendadas (passos claros para os próximos dias).
Não use emojis na resposta: a interface usa ícones próprios.

Responda em português do Brasil, usando emojis amigáveis e marcadores markdown limpos.`;

                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: promptText }] }]
                    })
                });

                if (res.ok) {
                    const data = await res.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        return Response.json({ advice: text });
                    }
                }
            } catch (err) {
                console.error("Erro na API do Gemini, usando fallback de diagnóstico:", err);
            }
        }

        // Rule-based Intelligent Financial Diagnostic Engine (Fallback)
        let overspent = [];
        let nearLimit = [];
        let totalLimitBrl = 0;

        budgets.forEach(b => {
            const limitVal = parseFloat(String(b.limit).replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
            totalLimitBrl += limitVal;
            const exp = expenses.find(e => e.label === b.label);
            const spentVal = exp ? (parseFloat(String(exp.spent).replace(/[^\d,-]/g, '').replace(',', '.')) || 0) : 0;

            if (spentVal > limitVal && limitVal > 0) {
                overspent.push({ label: b.label, diff: spentVal - limitVal, spent: spentVal, limit: limitVal });
            } else if (limitVal > 0 && spentVal >= limitVal * 0.8) {
                nearLimit.push({ label: b.label, spent: spentVal, limit: limitVal });
            }
        });

        let adviceLines = [];

        adviceLines.push("**Diagnóstico Geral do seu Roteiro**");
        if (income > 0) {
            const committedPct = (totalLimitBrl / income) * 100;
            adviceLines.push(`• Sua renda mensal base é de **R$ ${income.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}**.`);
            adviceLines.push(`• Você planejou um teto total de **R$ ${totalLimitBrl.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** (${committedPct.toFixed(1)}% da sua renda).`);
            if (committedPct > 90) {
                adviceLines.push(`Seu planejamento compromete mais de 90% da sua renda. O ideal é manter orçamentos essenciais em até 70-80% para ter margem de reserva.`);
            } else {
                adviceLines.push(`Seu planejamento inicial está dentro de uma margem saudável em relação à sua renda!`);
            }
        } else {
            adviceLines.push(`• Adicione suas receitas mensais no Dashboard para receber análises comparativas de % da renda.`);
        }

        adviceLines.push("\n**Categorias em Atenção**");
        if (overspent.length > 0) {
            overspent.forEach(o => {
                adviceLines.push(`• **${o.label}**: Orçamento estourado em **R$ ${o.diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}** (Gasto: R$ ${o.spent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / Meta: R$ ${o.limit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).`);
            });
        } else {
            adviceLines.push(`• Parabéns! Nenhuma categoria ultrapassou a meta planejada até o momento.`);
        }

        if (nearLimit.length > 0) {
            nearLimit.forEach(n => {
                adviceLines.push(`• **${n.label}**: Próximo da meta (já utilizou mais de 80% do teto).`);
            });
        }

        adviceLines.push("\n**Recomendações Práticas**");
        if (overspent.length > 0) {
            adviceLines.push(`1. Tente remanejar saldo de categorias com sobra (ex: Lazer ou Outros) para cobrir os excessos em **${overspent.map(o => o.label).join(', ')}**.`);
        } else {
            adviceLines.push(`1. Mantenha o ritmo de acompanhamento semanal para encerrar o mês com saldo positivo.`);
        }
        adviceLines.push(`2. Utilize a regra **50/30/20** (50% Necessidades, 30% Desejos, 20% Investimentos) para calibrar os limites do seu Roteiro.`);
        adviceLines.push(`3. Transfira qualquer sobra do teto no final do mês para a sua carteira de investimentos!`);

        return Response.json({ advice: adviceLines.join('\n') });

    } catch (err) {
        console.error("Erro no handler ai-roadmap:", err);
        return Response.json({ error: "Falha ao processar análise do roteiro." }, { status: 500 });
    }
}
