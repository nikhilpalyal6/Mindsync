import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Auth from './pages/Auth'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Footer from './components/Footer'
import NotFound from './pages/NotFound'
import ScrollToTop from './components/ScrollToTop'
import './App.css'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useEffect } from 'react'
import Pricing from './pages/Pricing'
import Contact from './pages/Contact'
import StudyMode from './pages/StudyMode'
import Community from './pages/Community'
import StudyViewer from './pages/StudyViewer'

function AppContent() {
  const location = useLocation()
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'].some(path => location.pathname.startsWith(path))
  const studyRoutes = ['/study', '/study/viewer']
  const isStudyMode = studyRoutes.includes(location.pathname)

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: false,
      mirror: true
    });
  }, []);

  return (
    <div>
      <ScrollToTop />
      {!isAuthPage && !isStudyMode && <Navbar />}
      <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Auth />} />
              <Route path="/signup" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />
              <Route path="/verify-email/:token" element={<VerifyEmail />} />
              <Route path="/study" element={<StudyMode />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/about" element={<Community />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/study/viewer" element={<StudyViewer />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
      {!isAuthPage && !isStudyMode && <Footer />}
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
