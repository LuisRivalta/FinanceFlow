import './globals.css'
import LenisScroll from '../components/LenisScroll'
import GlobalBackgroundWrapper from '../components/3d/GlobalBackgroundWrapper'

export const metadata = {
  title: 'Blumii | Controle Seus Gastos',
  description: 'Dashboard financeiro premium para controle de gastos, investimentos e salários.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        <GlobalBackgroundWrapper />
        <LenisScroll>
          {children}
        </LenisScroll>
      </body>
    </html>
  )
}
