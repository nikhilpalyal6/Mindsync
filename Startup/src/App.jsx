import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Auth from './pages/Auth'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Footer from './components/Footer'
import NotFound from './pages/NotFound'
import ScrollToTop from './components/ScrollToTop'
import ProtectedRoute from './components/ProtectedRoute'
import GuestRoute from './components/GuestRoute'
import './App.css'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useEffect } from 'react'
import Pricing from './pages/Pricing'
import Contact from './pages/Contact'
import StudyMode from './pages/StudyMode'
import Community from './pages/Community'
import StudyViewer from './pages/StudyViewer'
import { AuthProvider } from './contexts/AuthContext'
import Toast from './components/Toast'

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
      <Toast />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<GuestRoute><Auth /></GuestRoute>} />
        <Route path="/signup" element={<GuestRoute><Auth /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="/reset-password/:token" element={<GuestRoute><ResetPassword /></GuestRoute>} />
        <Route path="/verify-email/:token" element={<GuestRoute><VerifyEmail /></GuestRoute>} />
        <Route path="/study" element={<ProtectedRoute><StudyMode /></ProtectedRoute>} />
        <Route path="/study/viewer" element={<ProtectedRoute><StudyViewer /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<Community />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isAuthPage && !isStudyMode && <Footer />}
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
