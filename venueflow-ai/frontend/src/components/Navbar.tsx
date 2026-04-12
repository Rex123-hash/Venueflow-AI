import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { Link, useLocation } from 'react-router-dom';

const Navbar: React.FC = () => {
  const { isAuthenticated, user, logout } = useAuthStore();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('venueflow-theme') || 'dark');

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('venueflow-theme', newTheme);
    document.documentElement.classList.remove('dark', 'light');
    document.documentElement.classList.add(newTheme);
  };

  const getDashboardLink = () => {
    if (!user) return '/demo';
    switch (user.role) {
      case 'MANAGER':
      case 'ADMIN': return '/manager/dashboard';
      case 'STAFF': return '/staff/view';
      default: return '/fan/dashboard';
    }
  };

  return (
    <nav
      role="navigation"
      aria-label="Main navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass py-3' : 'bg-transparent py-5'}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Logo */}
          <Link to="/" aria-label="VenueFlow AI — Home" className="flex items-center gap-2 group">
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent2 flex items-center justify-center p-1 overflow-hidden">
              {/* Abstract flowing crowd silhouette + AI Node spark */}
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full text-white">
                <path d="M12 2C10.9 2 10 2.9 10 4C10 5.1 10.9 6 12 6C13.1 6 14 5.1 14 4C14 2.9 13.1 2 12 2ZM7 8C5.34 8 4 9.34 4 11V16H6V22H10V16H14V22H18V16H20V11C20 9.34 18.66 8 17 8H7ZM12 8.5C12.83 8.5 13.5 9.17 13.5 10C13.5 10.83 12.83 11.5 12 11.5C11.17 11.5 10.5 10.83 10.5 10C10.5 9.17 11.17 8.5 12 8.5Z" fill="currentColor"/>
                <circle cx="18" cy="4" r="2" className="fill-accent2 animate-pulse-glow" />
              </svg>
            </div>
            <span className="font-bold text-xl tracking-tight hidden sm:block">
              VenueFlow<span className="text-accent2">AI</span>
            </span>
          </Link>

          {/* Center Links (Desktop) */}
          <div className="hidden md:flex items-center gap-8 font-medium text-sm">
            <Link to="/demo" aria-current={location.pathname === '/demo' ? 'page' : undefined} className={`hover:text-accent transition-colors ${location.pathname === '/demo' ? 'text-accent' : 'text-text-secondary'}`}>Live Demo</Link>
            {isAuthenticated && (
              <Link to={getDashboardLink()} className="hover:text-accent transition-colors text-text-secondary">Dashboard</Link>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-bg-secondary text-text-secondary transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
              )}
            </button>

            {isAuthenticated ? (
              <div className="flex items-center gap-4">
                <span className="hidden leading-tight text-right md:block">
                  <div className="text-sm font-semibold">{user?.name}</div>
                  <div className="text-xs text-text-secondary">{user?.role}</div>
                </span>
                <div className="relative group cursor-pointer">
                  {/* Avatar: Google photo or initial */}
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-10 h-10 rounded-full object-cover shadow-glow-indigo border-2 border-transparent group-hover:border-white transition-all"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-accent to-accent2 flex items-center justify-center text-white font-bold text-lg shadow-glow-indigo border-2 border-transparent group-hover:border-white transition-all">
                      {user?.name?.charAt(0) ?? '?'}
                    </div>
                  )}
                  
                  {/* Dropdown menu */}
                  <div className="absolute right-0 mt-2 w-56 rounded-xl glass-card py-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-top-right z-50">
                    {/* User info header */}
                    <div className="px-4 py-3 border-b border-border flex items-center gap-3">
                      {user?.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-r from-accent to-accent2 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {user?.name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{user?.name}</p>
                        <p className="text-[10px] text-text-secondary truncate">{user?.email}</p>
                        <p className="text-[10px] text-accent">Venue Operations Manager</p>
                      </div>
                    </div>
                    <Link to="/profile" className="block px-4 py-2 text-sm hover:bg-bg-secondary transition-colors">Profile</Link>
                    <Link to={getDashboardLink()} className="block px-4 py-2 text-sm hover:bg-bg-secondary transition-colors">Dashboard</Link>
                    <hr className="my-1 border-border" />
                    <button onClick={logout} aria-label="Sign out" className="w-full text-left px-4 py-2 text-sm text-danger hover:bg-red-500/10 transition-colors">Sign Out</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="hidden sm:block text-sm font-medium hover:text-accent transition-colors">Log In</Link>
                <Link to="/register" className="btn-primary">Sign Up</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
