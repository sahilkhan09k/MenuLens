import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ScanProvider } from './context/ScanContext';
import { LocationProvider } from './context/LocationContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingScreen from './components/LoadingScreen';
import Landing from './pages/Landing';
import Signup from './pages/Signup';
import Login from './pages/Login';
import OtpVerify from './pages/OtpVerify';

import OnboardingGenderAge  from './pages/onboarding/OnboardingGenderAge';
import OnboardingBody       from './pages/onboarding/OnboardingBody';
import OnboardingGoal       from './pages/onboarding/OnboardingGoal';
import OnboardingDiet       from './pages/onboarding/OnboardingDiet';
import OnboardingAllergies  from './pages/onboarding/OnboardingAllergies';
import OnboardingActivity   from './pages/onboarding/OnboardingActivity';
import OnboardingConditions from './pages/onboarding/OnboardingConditions';
import OnboardingComplete   from './pages/onboarding/OnboardingComplete';

import Home       from './pages/Home';
import Scan       from './pages/Scan';
import Processing from './pages/Processing';
import Results    from './pages/Results';
import DishDetail from './pages/DishDetail';
import History    from './pages/History';
import Saved      from './pages/Saved';
import Profile    from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminQueue     from './pages/admin/AdminQueue';
// --- OnboardingRoute: requires auth but NOT onboarding complete ---
function OnboardingRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// --- App ---
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/"           element={<Landing />} />
      <Route path="/signup"     element={<Signup />} />
      <Route path="/login"      element={<Login />} />
      <Route path="/verify-otp" element={<OtpVerify />} />

      {/* Onboarding (auth required, onboarding not yet complete) */}
      <Route path="/onboarding/gender-age"  element={<OnboardingRoute><OnboardingGenderAge /></OnboardingRoute>} />
      <Route path="/onboarding/body"        element={<OnboardingRoute><OnboardingBody /></OnboardingRoute>} />
      <Route path="/onboarding/goal"        element={<OnboardingRoute><OnboardingGoal /></OnboardingRoute>} />
      <Route path="/onboarding/diet"        element={<OnboardingRoute><OnboardingDiet /></OnboardingRoute>} />
      <Route path="/onboarding/allergies"   element={<OnboardingRoute><OnboardingAllergies /></OnboardingRoute>} />
      <Route path="/onboarding/activity"    element={<OnboardingRoute><OnboardingActivity /></OnboardingRoute>} />
      <Route path="/onboarding/conditions"  element={<OnboardingRoute><OnboardingConditions /></OnboardingRoute>} />
      <Route path="/onboarding/complete"    element={<OnboardingRoute><OnboardingComplete /></OnboardingRoute>} />

      {/* Protected (auth + onboarding complete) */}
      <Route path="/home"                  element={<ProtectedRoute><Home /></ProtectedRoute>} />
      <Route path="/scan"                  element={<ProtectedRoute><Scan /></ProtectedRoute>} />
      <Route path="/processing/:scanId"    element={<ProtectedRoute><Processing /></ProtectedRoute>} />
      <Route path="/results/:scanId"       element={<ProtectedRoute><Results /></ProtectedRoute>} />
      <Route path="/dish/:dishId"          element={<ProtectedRoute><DishDetail /></ProtectedRoute>} />
      <Route path="/history"               element={<ProtectedRoute><History /></ProtectedRoute>} />
      <Route path="/saved"                 element={<ProtectedRoute><Saved /></ProtectedRoute>} />
      <Route path="/profile"               element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      {/* Admin (protected — server enforces admin email check) */}
      <Route path="/admin"                 element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/queue"           element={<ProtectedRoute><AdminQueue /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LocationProvider>
        <AuthProvider>
          <ScanProvider>
            <AppRoutes />
            <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
          </ScanProvider>
        </AuthProvider>
      </LocationProvider>
    </BrowserRouter>
  );
}
