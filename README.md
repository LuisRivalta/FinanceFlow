# FinanceFlow 💸

Um sistema financeiro pessoal moderno, dinâmico e focado em design de alto padrão (Glassmorphism e Dark Mode).

## 📊 Módulos do Sistema

### 1. Dashboard Principal
- Visão geral das finanças, saldo líquido, receitas e despesas.
- Gráficos de fluxo de caixa em formato doughnut e line charts.
- Interface responsiva com navegação lateral elegante.

### 2. Cartões (Cards)
- Gestão inteligente de cartões de crédito.
- Acompanhamento de faturas mensais e limites disponíveis.
- Separação de gastos por cartão em tempo real.

### 3. Investimentos & Minha Carteira (Wallet) 🚀
Módulo completo para acompanhamento patrimonial em tempo real.

**Minha Carteira (Wallet):**
- **Ativos Dinâmicos:** Adicione Criptomoedas (BTC, ETH, etc) e Moedas Estrangeiras (USD, EUR).
- **Cotações ao Vivo:** Integração direta com a **AwesomeAPI** (API gratuita que não exige token) para puxar o valor do Dólar, Euro e Cripto no exato milissegundo.
- **Renda Fixa / CDI:** Adicione valores de investimentos de renda fixa com uma taxa anual. O sistema simula o crescimento daquele ativo de forma contínua com juros sobre juros a partir da data de criação.
- **Card de Patrimônio:** Calcula o valor exato em Reais (BRL) de todos os seus ativos somados utilizando as cotações atuais.
- **Armazenamento Seguro:** Todos os ativos são registrados localmente atrelados à conta do usuário.

**Simulador de Juros Compostos:**
- Simulação de rendimento com Valor Inicial, Aporte Mensal, Taxa e Período.
- Gráfico preditivo para ilustrar o crescimento exponencial do patrimônio investido.

### 4. Transações
- Controle total de entradas, saídas e investimentos.
- Banco de dados gerenciado via Supabase.
- Organização por categorias dinâmicas (ex: Lazer, Alimentação, Salário).

---
## 💻 Tecnologias
- **Frontend:** Next.js 15+ (React), CSS puro (Tokens, CSS Grid, Flexbox e Glassmorphism).
- **Backend:** Supabase (PostgreSQL).
- **Integração de Dados:** AwesomeAPI (Cotações de Moedas e Cripto).
- **Gráficos:** Chart.js + react-chartjs-2.
