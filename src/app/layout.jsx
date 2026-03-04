
import './globals.css'

export const metadata = {
  title: 'FinanceFlow | Controle Seus Gastos',
  description: 'Dashboard financeiro premium para controle de gastos, investimentos e salários.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
