import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import api from '../lib/api';
import { getApiBaseUrl } from '../lib/runtime';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.user, data.token);
      toast.success(`Welcome back, ${data.user.name}`);
      
      // Redirect based on role
      switch (data.user.role) {
        case 'MANAGER':
        case 'ADMIN':
          navigate('/manager/dashboard');
          break;
        case 'STAFF':
          navigate('/staff/view');
          break;
        default:
          navigate('/fan/dashboard');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${getApiBaseUrl()}/auth/google`;
  };

  return (
    <div className="min-h-screen flex">
      {/* Brand Side (Left) */}
      <div className="hidden lg:flex w-1/2 bg-bg-secondary relative flex-col justify-center items-center overflow-hidden border-r border-border">
        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-accent2/10 z-0"></div>
        <div className="absolute inset-0 opacity-20 z-0" 
             style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--text-secondary) 1px, transparent 0)', backgroundSize: '32px 32px' }}>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 max-w-lg text-center"
        >
          <div className="w-24 h-24 mx-auto bg-gradient-to-br from-accent to-accent2 rounded-2xl flex items-center justify-center mb-8 shadow-glow-indigo">
             <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-white">
                <path d="M12 2C10.9 2 10 2.9 10 4C10 5.1 10.9 6 12 6C13.1 6 14 5.1 14 4C14 2.9 13.1 2 12 2ZM7 8C5.34 8 4 9.34 4 11V16H6V22H10V16H14V22H18V16H20V11C20 9.34 18.66 8 17 8H7ZM12 8.5C12.83 8.5 13.5 9.17 13.5 10C13.5 10.83 12.83 11.5 12 11.5C11.17 11.5 10.5 10.83 10.5 10C10.5 9.17 11.17 8.5 12 8.5Z" fill="currentColor"/>
             </svg>
          </div>
          <h2 className="text-4xl font-bold mb-4">VenueFlow<span className="text-accent2">AI</span></h2>
          <p className="text-lg text-text-secondary">Your Smart Companion for Every Event</p>
        </motion.div>
      </div>

      {/* Form Side (Right) */}
      <div className="w-[100%] lg:w-1/2 flex items-center justify-center p-8">
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="mb-10 text-center lg:text-left">
            <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
            <p className="text-text-secondary">Sign in to access your dashboard</p>
          </div>

          <button 
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 bg-bg-card border border-border p-3 rounded-xl hover:bg-bg-secondary hover:border-text-secondary transition-all font-medium mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-border"></div>
            <span className="text-text-secondary text-sm">Targeted Login (Demo)</span>
            <div className="flex-1 h-px bg-border"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="manager@venueflow.ai"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex justify-between items-center text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-border bg-bg-secondary text-accent focus:ring-accent" />
                <span className="text-text-secondary">Remember me</span>
              </label>
              <a href="#" className="text-accent hover:text-accent-light">Forgot password?</a>
            </div>

            <button 
              type="submit" 
              className="w-full btn-primary py-3 mt-4 flex justify-center items-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Signing in...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="mt-8 text-center text-text-secondary text-sm">
            Don't have an account? <Link to="/register" className="text-accent font-medium hover:text-accent-light">Sign up</Link>
          </p>

          <div className="mt-8 p-4 bg-bg-secondary rounded-lg border border-border text-xs text-text-secondary">
             <p className="font-bold mb-2">Demo Credentials:</p>
             <p>Manager: manager@venueflow.ai / Manager@123</p>
             <p>Fan: fan1@venueflow.ai / Fan@12345</p>
             <p>Staff: staff1@venueflow.ai / Staff@123</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
