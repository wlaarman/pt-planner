import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import CalendarPage from './pages/CalendarPage';
import TrainersPage from './pages/TrainersPage';
import ParticipantsPage from './pages/ParticipantsPage';
import TrainingTypesPage from './pages/TrainingTypesPage';
import OverzichtPage from './pages/OverzichtPage';
import SettingsPage from './pages/SettingsPage';
import PWAInstallBanner from './components/PWAInstallBanner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuthStore();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Navigate to="/calendar" replace />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/trainers" element={<TrainersPage />} />
                  <Route path="/participants" element={<ParticipantsPage />} />
                  <Route path="/training-types" element={<TrainingTypesPage />} />
                  <Route path="/overzicht" element={<OverzichtPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
      <PWAInstallBanner />
    </>
  );
}

export default App;
