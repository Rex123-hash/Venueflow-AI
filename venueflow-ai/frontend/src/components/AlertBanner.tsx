import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface Toast {
  id: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
}

const AlertBanner: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handleNewAlert = (e: CustomEvent) => {
      const toast = {
        id: Math.random().toString(36).substr(2, 9),
        message: e.detail.message,
        severity: e.detail.severity || 'INFO',
      };
      
      setToasts(prev => [...prev, toast]);
      
      // Auto dismiss after duration
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, toast.severity === 'CRITICAL' ? 10000 : 5000);
    };

    window.addEventListener('venueflow-alert', handleNewAlert as EventListener);
    return () => window.removeEventListener('venueflow-alert', handleNewAlert as EventListener);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2 max-w-sm w-full font-sans">
      {toasts.map((toast) => (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, x: 50, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          className={`card overflow-hidden shadow-lg border-l-4 ${
            toast.severity === 'CRITICAL' ? 'border-danger bg-danger/10' :
            toast.severity === 'WARNING' ? 'border-warning bg-warning/10' :
            'border-accent bg-accent/10'
          }`}
        >
          <div className="p-4 flex items-start gap-3">
            <div className="mt-0.5 flex-shrink-0">
              {toast.severity === 'CRITICAL' && (
                <svg className="w-5 h-5 text-danger" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
              )}
              {toast.severity === 'WARNING' && (
                <svg className="w-5 h-5 text-warning" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              )}
              {toast.severity === 'INFO' && (
                <svg className="w-5 h-5 text-accent" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
              )}
            </div>
            <div className="flex-1 w-0">
              <p className="text-sm font-medium text-text-primary leading-tight">
                {toast.message}
              </p>
            </div>
            <div className="flex-shrink-0 flex">
              <button
                onClick={() => removeToast(toast.id)}
                className="bg-transparent rounded-md inline-flex text-text-secondary hover:text-text-primary focus:outline-none"
              >
                <span className="sr-only">Close</span>
                <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default AlertBanner;

// Helper to trigger toasts from anywhere
export const triggerToast = (message: string, severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO') => {
  const event = new CustomEvent('venueflow-alert', { detail: { message, severity } });
  window.dispatchEvent(event);
};
