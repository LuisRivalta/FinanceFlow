import './globals.css'
import LenisScroll from '../components/LenisScroll'

export const metadata = {
  title: 'Blumii | Controle Seus Gastos',
  description: 'Dashboard financeiro premium para controle de gastos, investimentos e salários.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <LenisScroll>
          {children}
        </LenisScroll>
      </body>
    </html>
  )
}
