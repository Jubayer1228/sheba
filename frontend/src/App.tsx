import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { CartPage } from './pages/CartPage'
import { CategoryPage } from './pages/CategoryPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { OrderDetailPage } from './pages/OrderDetailPage'
import { OrdersPage } from './pages/OrdersPage'
import { PharmacyDetailPage } from './pages/PharmacyDetailPage'
import { PrescriptionPage } from './pages/PrescriptionPage'
import { ProfilePage } from './pages/ProfilePage'
import { AppointmentDetailPage } from './pages/AppointmentDetailPage'
import { AppointmentsPage } from './pages/AppointmentsPage'
import { CallRoomPage } from './pages/CallRoomPage'
import { ConsultPage } from './pages/ConsultPage'
import { DoctorBookPage } from './pages/DoctorBookPage'
import { DoctorDashboardPage } from './pages/DoctorDashboardPage'
import { DoctorsPage } from './pages/DoctorsPage'
import { RegisterAmbulancePage } from './pages/RegisterAmbulancePage'
import { VoiceNursePage } from './pages/VoiceNursePage'
import { RegisterCustomerPage } from './pages/RegisterCustomerPage'
import { RegisterDoctorPage } from './pages/RegisterDoctorPage'
import { RegisterHubPage } from './pages/RegisterHubPage'
import { RegisterPharmacyPage } from './pages/RegisterPharmacyPage'
import { RegisterRiderPage } from './pages/RegisterRiderPage'
import { SearchPage } from './pages/SearchPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="pharmacies/:id" element={<PharmacyDetailPage />} />
            <Route path="categories/:slug" element={<CategoryPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterHubPage />} />
            <Route path="register/customer" element={<RegisterCustomerPage />} />
            <Route path="register/pharmacy" element={<RegisterPharmacyPage />} />
            <Route path="register/rider" element={<RegisterRiderPage />} />
            <Route path="register/ambulance" element={<RegisterAmbulancePage />} />
            <Route path="register/doctor" element={<RegisterDoctorPage />} />
            <Route path="doctors" element={<DoctorsPage />} />
            <Route path="doctors/:id" element={<DoctorBookPage />} />
            <Route
              path="consult"
              element={
                <ProtectedRoute>
                  <ConsultPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="voice"
              element={
                <ProtectedRoute>
                  <VoiceNursePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="appointments"
              element={
                <ProtectedRoute>
                  <AppointmentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="appointments/:id"
              element={
                <ProtectedRoute>
                  <AppointmentDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="calls/:id"
              element={
                <ProtectedRoute>
                  <CallRoomPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="doctor"
              element={
                <ProtectedRoute>
                  <DoctorDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="prescription"
              element={
                <ProtectedRoute>
                  <PrescriptionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="checkout"
              element={
                <ProtectedRoute>
                  <CheckoutPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders"
              element={
                <ProtectedRoute>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="orders/:id"
              element={
                <ProtectedRoute>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
