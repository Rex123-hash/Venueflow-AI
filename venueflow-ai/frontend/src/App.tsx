import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';

import Navbar from './components/Navbar';
import AlertBanner from './components/AlertBanner';
import ChatBot from './components/ChatBot';
import EmergencyOverlay from './components/EmergencyOverlay';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Demo from './pages/Demo';
import FanDashboard from './pages/FanDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import StaffView from './pages/StaffView';
import Admin from './pages/Admin';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import NotFound from './pages/NotFound';
import OAuthCallback from './pages/OAuthCallback';

import { useAuthStore } from './stores/authStore';
import { useSimulationStore } from './stores/simulationStore';
import { getSocket, initSocket, disconnectSocket } from './lib/socket';
import { triggerToast } from './components/AlertBanner';

const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: string[] }) => {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
};

const App: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const { updateFromSocket, setEmergency, clearEmergency } = useSimulationStore();
  const [socketConnected, setSocketConnected] = useState(false);

  // Welcome toast — once per session after login
  useEffect(() => {
    if (isAuthenticated && user && !sessionStorage.getItem('venueflow-welcomed')) {
      const firstName = user.name?.split(' ')[0] || 'back';
      toast.success(`Welcome back, ${firstName} 👋`, {
        duration: 3000,
        style: {
          background: 'rgba(0,229,160,0.1)',
          border: '1px solid rgba(0,229,160,0.4)',
          color: '#00e5a0',
          fontWeight: 600,
        },
        icon: undefined,
      });
      sessionStorage.setItem('venueflow-welcomed', 'true');
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    // Setup Socket.io Global Listeners
    const socket = getSocket();

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    
    const onZoneUpdate = (data: any) => {
      updateFromSocket(data);
    };

    const onNewAlert = (data: any) => {
      triggerToast(data.message, data.severity);
    };

    const onEmergencyAlert = (data: any) => {
      setEmergency(data);
      // Dispatch custom event for ChatBot
      const event = new CustomEvent('venueflow-emergency', { detail: data });
      window.dispatchEvent(event);
    };

    const onEmergencyClear = () => {
      clearEmergency();
      triggerToast('Emergency cleared. Return to normal operations.', 'INFO');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('zone_update', onZoneUpdate);
    socket.on('new_alert', onNewAlert);
    socket.on('emergency_alert', onEmergencyAlert);
    socket.on('emergency_clear', onEmergencyClear);

    // Initial connection
    if (!socket.connected) socket.connect();

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('zone_update', onZoneUpdate);
      socket.off('new_alert', onNewAlert);
      socket.off('emergency_alert', onEmergencyAlert);
      socket.off('emergency_clear', onEmergencyClear);
      // Don't disconnect here, let it persist across page navigation
    };
  }, [updateFromSocket, setEmergency, clearEmergency]);

  // Handle Event Room Joining based on auth state
  useEffect(() => {
    if (socketConnected) {
      const socket = getSocket();
      const currentUrl = window.location.pathname;
      
      // Default to IPL seeded demo event for now
      const eventId = 'event-ipl-2025-mi-csk'; 
      
      const role = user?.role || 'FAN';
      socket.emit('join_event', { event_id: eventId, role });
    }
  }, [socketConnected, user, isAuthenticated]);

  return (
    <BrowserRouter>
      {/* Global UI Overlays */}
      <EmergencyOverlay />
      <Navbar />
      <AlertBanner />
      <Toaster position="top-right" toastOptions={{ className: 'glass-card border-border text-text-primary' }} />
      
      {/* Main Content */}
      <main role="main" aria-label="VenueFlow AI main content" className="min-h-screen pt-20 pb-10">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/demo" element={<Demo />} />
          <Route path="/auth/callback" element={<OAuthCallback />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute allowedRoles={['FAN', 'STAFF', 'MANAGER', 'ADMIN']} />}>
            <Route path="/profile" element={<Profile />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['FAN']} />}>
            <Route path="/fan/dashboard" element={<FanDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['MANAGER', 'ADMIN']} />}>
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route path="/analytics" element={<Analytics />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['STAFF', 'MANAGER', 'ADMIN']} />}>
            <Route path="/staff/view" element={<StaffView />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      {/* Global Bot (only visible for Fans or unauthenticated demo users) */}
      {(!isAuthenticated || user?.role === 'FAN') && <ChatBot fanId={user?.id} />}
    </BrowserRouter>
  );
};

export default App;
