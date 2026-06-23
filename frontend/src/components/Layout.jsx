import { memo } from 'react'
import Navbar from './Navbar'
import Footer from './Footer'

const Layout = memo(function Layout({ children, hideNav = false, hideFooter = false }) {
  return (
    <div className="min-h-screen bg-body flex flex-col">
      {!hideNav && <Navbar />}
      <main className={`flex-1 ${!hideNav ? 'pt-16' : ''}`}>
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  )
})

export default Layout
