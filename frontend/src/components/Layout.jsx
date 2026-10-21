import { memo } from 'react'
import Navbar from './Navbar'
import Footer from './Footer'

const LiquidBackground = memo(function LiquidBackground() {
  return (
    <div className="liquid-bg" aria-hidden="true">
      <span className="liquid-blob liquid-blob-1" />
      <span className="liquid-blob liquid-blob-2" />
      <span className="liquid-blob liquid-blob-3" />
      <span className="liquid-vignette" />
    </div>
  )
})

const Layout = memo(function Layout({ children, hideNav = false, hideFooter = false }) {
  return (
    <div className="min-h-screen flex flex-col relative isolate">
      <LiquidBackground />
      {!hideNav && <Navbar />}
      <main className={`flex-1 ${!hideNav ? 'pt-[72px]' : ''}`}>
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  )
})

export default Layout
