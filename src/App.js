// src/App.jsx
import React, { useEffect, useState } from "react";
import "./App.css";
import "./index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard/Dashboard";
import Meals from "./pages/Meals/Meals";
import Exercises from "./pages/Excercise/Exercises";
import Progress from "./pages/Progress/Progress";
import Profile from "./pages/Profile/Profile";
import NewIngredient from "./pages/Meals/NewIngredient";
import LogMeal from "./pages/Meals/LogMeal";
import SnackDetails  from "./pages/Meals/SnackDetails";
import DefaultImage from "./components/images/defaultprofile.png"
import Login from './pages/Authentication/Login';
import Signup from './pages/Authentication/Signup';
import ProfileSetup from './pages/ProfileSetup/ProfileSetup';
import ProfileSetup2 from './pages/ProfileSetup/ProfileSetup2';
import ProfileSetup3 from './pages/ProfileSetup/ProfileSetup3';
import ProfileSetup4 from './pages/ProfileSetup/ProfileSetup4';
import QuickActionsFloating from './components/QuickActionsFloating';
import MobileTabBar from './components/MobileTabBar';
import { getCurrentUserId, validateStoredSession } from './services/authClient';

// Example: this would come from your DB call in a real app
const mockUser = {
  avatar: DefaultImage,
};

function ProtectedRoute({ children, status, userId }) {
  const storedUserId = localStorage.getItem("user_id") || undefined;
  const effectiveUserId = userId || storedUserId;

  if (status === 'checking' && !effectiveUserId) {
    return null;
  }

  if (effectiveUserId) {
    return children;
  }

  return <Navigate to="/login" replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

export default function App() {
  const [status, setStatus] = useState('checking');
  const [currentUserId, setCurrentUserId] = useState(() => localStorage.getItem("user_id") || undefined);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.body.classList.remove("app-booting");
      document.body.classList.add("app-ready");
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let active = true;

    async function bootstrapAuth() {
      const isValid = await validateStoredSession();
      if (!active) return;

      if (!isValid) {
        setCurrentUserId(undefined);
        setStatus('unauthorized');
        return;
      }

      const userId = await getCurrentUserId();
      if (!active) return;

      if (userId) {
        setCurrentUserId(userId);
        setStatus('authorized');
      } else {
        setCurrentUserId(undefined);
        setStatus('unauthorized');
      }
    }

    bootstrapAuth();

    const handleAuthChange = () => {
      setCurrentUserId(localStorage.getItem("user_id") || undefined);
      setStatus('checking');
      bootstrapAuth();
    };

    window.addEventListener('cc-auth-changed', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);

    return () => {
      active = false;
      window.removeEventListener('cc-auth-changed', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  const currentUser = {
    ...mockUser,
    id: currentUserId,
  };

  return (
    <BrowserRouter>
      <ScrollToTop />
      {/* floating quick actions live across all pages */}
      <QuickActionsFloating />
      <MobileTabBar />
      <Routes>
        
        <Route path="/" element={<ProtectedRoute status={status} userId={currentUserId}><Dashboard user={currentUser} /></ProtectedRoute>} />
        <Route path="/meals" element={<ProtectedRoute status={status} userId={currentUserId}><Meals user={currentUser} /></ProtectedRoute>} />
        <Route path="/meals/log" element={<ProtectedRoute status={status} userId={currentUserId}><Meals user={currentUser} /></ProtectedRoute>} />
        <Route path="/exercises" element={<ProtectedRoute status={status} userId={currentUserId}><Exercises user={currentUser}/></ProtectedRoute>} />
        <Route path="/exercises/log" element={<ProtectedRoute status={status} userId={currentUserId}><Exercises user={currentUser} /></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute status={status} userId={currentUserId}><Progress user={currentUser} /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute status={status} userId={currentUserId}><Profile user={currentUser} /></ProtectedRoute>} />
        <Route path="/meals/log" element={<ProtectedRoute status={status} userId={currentUserId}><LogMeal user={currentUser} /></ProtectedRoute>} />
        <Route path="/ingredients/new" element={<ProtectedRoute status={status} userId={currentUserId}><NewIngredient user={currentUser} /></ProtectedRoute>} />
        <Route path="/meals" element={<ProtectedRoute status={status} userId={currentUserId}><Meals user={currentUser} /></ProtectedRoute>} />
        <Route path="/meals/log" element={<ProtectedRoute status={status} userId={currentUserId}><LogMeal user={currentUser} /></ProtectedRoute>} />         {/* existing builder */}
        <Route path="/meals/new" element={<ProtectedRoute status={status} userId={currentUserId}><LogMeal user={currentUser} /></ProtectedRoute>} />         {/* create new meal via details flow */}
        <Route path="/ingredients/new" element={<ProtectedRoute status={status} userId={currentUserId}><NewIngredient user={currentUser} /></ProtectedRoute>} />
        <Route path="/snacks/new" element={<ProtectedRoute status={status} userId={currentUserId}><SnackDetails user={currentUser} /></ProtectedRoute>} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/profile-setup" element={<ProtectedRoute status={status} userId={currentUserId}><ProfileSetup /></ProtectedRoute>} />
        <Route path="/profile-setup-2" element={<ProtectedRoute status={status} userId={currentUserId}><ProfileSetup2 /></ProtectedRoute>} />
        <Route path="/profile-setup-3" element={<ProtectedRoute status={status} userId={currentUserId}><ProfileSetup3 /></ProtectedRoute>} />
        <Route path="/profile-setup-4" element={<ProtectedRoute status={status} userId={currentUserId}><ProfileSetup4 /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
