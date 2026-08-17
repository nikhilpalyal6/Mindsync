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
import { AdminProtectedRoute } from './components/AdminProtectedRoute'
import { AdminLayout } from './components/admin/AdminLayout'
import { lazy } from 'react'

const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers').then(module => ({ default: module.AdminUsers })));
const AdminAnalytics = lazy(() => import('./pages/admin/AdminAnalytics').then(module => ({ default: module.AdminAnalytics })));
const AdminAI = lazy(() => import('./pages/admin/AdminAI').then(module => ({ default: module.AdminAI })));
const AdminNotifications = lazy(() => import('./pages/admin/AdminNotifications').then(module => ({ default: module.AdminNotifications })));
const AdminReports = lazy(() => import('./pages/admin/AdminReports').then(module => ({ default: module.AdminReports })));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings').then(module => ({ default: module.AdminSettings })));
const AdminSystemLogs = lazy(() => import('./pages/admin/AdminSystemLogs').then(module => ({ default: module.AdminSystemLogs })));
import './App.css'
import AOS from 'aos'
import 'aos/dist/aos.css'
import { useEffect } from 'react'
import Pricing from './pages/Pricing'
import Contact from './pages/Contact'
import StudyMode from './pages/StudyMode'
import Community from './pages/Community'
import StudyViewer from './pages/StudyViewer'
import StudyPlanner from './components/study/StudyPlanner'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Toast from './components/Toast'



function AppContent() {
  const location = useLocation()
  const isAuthPage = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'].some(path => location.pathname.startsWith(path))
  const isStudyMode = location.pathname.startsWith('/study') && location.pathname !== '/study-planner'
  const isAdminRoute = location.pathname.startsWith('/admin')

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: false,
      mirror: true
    });
  }, []);

  return (
    <div className="app-container">
      <ScrollToTop />
      {!isAuthPage && !isStudyMode && !isAdminRoute && <Navbar />}
      <Toast />
      <div className="main-content">
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<GuestRoute><Auth /></GuestRoute>} />
        <Route path="/signup" element={<GuestRoute><Auth /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="/reset-password/:token" element={<GuestRoute><ResetPassword /></GuestRoute>} />
        <Route path="/verify-email/:token" element={<GuestRoute><VerifyEmail /></GuestRoute>} />
        <Route path="/study" element={<ProtectedRoute><StudyMode /></ProtectedRoute>} />
        <Route path="/study/:workspaceId" element={<ProtectedRoute><StudyMode /></ProtectedRoute>} />
        <Route path="/study/viewer" element={<ProtectedRoute><StudyViewer /></ProtectedRoute>} />
        <Route path="/study-planner" element={<ProtectedRoute><StudyPlanner /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/about" element={<Community />} />
        <Route path="/contact" element={<Contact />} />
        {/* Admin Routes */}
        <Route path="/admin" element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="ai" element={<AdminAI />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="system-logs" element={<AdminSystemLogs />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      </div>
      {!isAuthPage && !isStudyMode && !isAdminRoute && <Footer />}
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
