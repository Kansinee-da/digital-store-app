import './globals.css'
import { Noto_Sans_Thai } from 'next/font/google'
import { CartProvider } from '@/lib/cart'
import Nav from '@/components/Nav'
const font = Noto_Sans_Thai({ subsets: ['thai', 'latin'], weight: ['400', '500', '600'] })
export const metadata = { title: 'DigitalStore', description: 'ร้านขาย Digital Product' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th"><body className={font.className}>
      <CartProvider>
        <Nav />
        {children}
      </CartProvider>
    </body></html>
  )
}
