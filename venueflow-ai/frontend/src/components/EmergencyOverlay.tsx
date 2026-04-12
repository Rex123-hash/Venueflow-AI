import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSimulationStore } from '../stores/simulationStore';
import api from '../lib/api';

const EmergencyOverlay: React.FC = () => {
  const { emergency, clearEmergency } = useSimulationStore();
  const [managerRole, setManagerRole] = useState(false);

  useEffect(() => {
    // Check if user is manager to show clear button
    try {
      const userStr = localStorage.getItem('venueflow-auth');
      if (userStr) {
        const data = JSON.parse(userStr);
        setManagerRole(data.state?.user?.role === 'MANAGER' || data.state?.user?.role === 'ADMIN');
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (emergency.active) {
      document.body.classList.add('emergency-active');
    } else {
      document.body.classList.remove('emergency-active');
    }
    return () => document.body.classList.remove('emergency-active');
  }, [emergency.active]);

  const handleClear = async () => {
    if (!window.confirm('Are you SURE you want to clear the emergency state? All evacuation UI will be removed.')) return;
    try {
      await api.post('/emergency/clear', { event_id: 'event-ipl-2025-mi-csk' });
      // clearEmergency(); // Local clear handled by socket event
    } catch (err) {
      console.error('Failed to clear emergency', err);
      clearEmergency(); // Force local clear on error
    }
  };

  return (
    <AnimatePresence>
      {emergency.active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] pointer-events-none"
        >
          {/* Pulsing Red Border around entire screen */}
          <div className="absolute inset-0 emergency-border pointer-events-none" />

          {/* Dimmer backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm pointer-events-none" />

          {/* Top Banner Data */}
          <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex justify-center pointer-events-none">
            <motion.div 
              initial={{ y: -50 }}
              animate={{ y: 0 }}
              className="bg-bg-card border-2 border-danger rounded-xl shadow-glow-red p-4 sm:p-6 max-w-2xl w-full text-center pointer-events-auto"
            >
              <div className="flex items-center justify-center gap-3 mb-2">
                <svg className="w-8 h-8 text-danger animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h1 className="text-2xl sm:text-3xl font-black text-danger tracking-tight uppercase">
                  Emergency Evacuation
                </h1>
              </div>
              
              <p className="text-text-primary text-base sm:text-lg mb-4 font-semibold uppercase bg-danger/10 py-2 rounded-lg">
                Location: {emergency.zone_name || 'Venue'}
              </p>

              <div className="bg-bg-secondary p-4 rounded-lg mb-4 text-left">
                <p className="text-text-primary text-sm sm:text-base font-bold mb-2 uppercase text-danger tracking-wider flex items-center justify-between">
                   <span>Auto-Generated PA Announcement</span>
                   <span className="text-xs text-white bg-danger px-2 py-0.5 rounded font-mono">Estimated evacuation: 8 minutes</span>
                </p>
                <div className="bg-[#0a0a0f] p-3 rounded border border-border">
                   <p className="text-text-primary text-sm leading-relaxed mb-3">
                     <span className="font-bold text-accent mr-2">ENG:</span>
                     {emergency.announcement || "Attention all attendees, please proceed calmly to your nearest designated exit as directed by venue staff."}
                   </p>
                   <p className="text-text-secondary text-sm leading-relaxed italic">
                     <span className="font-bold text-accent2 mr-2">HIN:</span>
                     सभी दर्शकों से अनुरोध है, कृपया शांतिपूर्वक अपने निकटतम निकास द्वार की ओर बढ़ें।
                   </p>
                </div>
              </div>

              {emergency.exit_1 && (
                <div className="flex flex-col sm:flex-row gap-4 justify-center mt-6">
                  <div className="flex-1 bg-bg-secondary border border-border p-3 rounded-lg flex items-center justify-between group h-14">
                    <span className="text-sm text-text-secondary uppercase tracking-wider font-bold">Primary</span>
                    <span className="text-emerald-400 font-bold ml-2 truncate">{emergency.exit_1}</span>
                    <svg className="w-6 h-6 text-emerald-400 ml-2 green-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </div>
                  {emergency.exit_2 && (
                    <div className="flex-1 bg-bg-secondary border border-border p-3 rounded-lg flex items-center justify-between group h-14">
                      <span className="text-sm text-text-secondary uppercase tracking-wider font-bold">Secondary</span>
                      <span className="text-emerald-400 font-bold ml-2 truncate">{emergency.exit_2}</span>
                      <svg className="w-6 h-6 text-emerald-400 ml-2 green-arrow" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                    </div>
                  )}
                </div>
              )}

              {managerRole && (
                <button
                  onClick={handleClear}
                  className="mt-6 px-6 py-2 bg-text-secondary hover:bg-text-primary text-bg-primary font-bold rounded-lg transition-colors w-full sm:w-auto"
                >
                  ALL CLEAR (Manager Only)
                </button>
              )}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmergencyOverlay;
