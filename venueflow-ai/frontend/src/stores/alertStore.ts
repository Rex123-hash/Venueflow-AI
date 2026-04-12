import { create } from 'zustand';
import { Alert } from '../types';
import api from '../lib/api';

interface AlertState {
  alerts: Alert[];
  unreadCount: number;
  
  fetchAlerts: (eventId: string) => Promise<void>;
  addAlert: (alert: Alert) => void;
  markResolved: (alertId: string) => Promise<void>;
  clearAll: () => void;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  alerts: [],
  unreadCount: 0,

  fetchAlerts: async (eventId: string) => {
    try {
      const { data } = await api.get(`/alerts/${eventId}`);
      set({ 
        alerts: data,
        unreadCount: data.filter((a: Alert) => !a.resolved).length
      });
    } catch (err) {
      console.error('Failed to fetch alerts', err);
    }
  },

  addAlert: (alert) => set((state) => {
    // Avoid duplicates
    if (state.alerts.some(a => a.id === alert.id)) return state;
    
    return {
      alerts: [alert, ...state.alerts].slice(0, 50), // keep last 50
      unreadCount: state.unreadCount + 1
    };
  }),

  markResolved: async (alertId) => {
    try {
      await api.patch(`/alerts/${alertId}/resolve`);
      set((state) => ({
        alerts: state.alerts.map(a => 
          a.id === alertId ? { ...a, resolved: true, resolvedAt: new Date().toISOString() } : a
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    } catch (err) {
      console.error('Failed to resolve alert', err);
      // Optimistic update even if backend fails
      set((state) => ({
        alerts: state.alerts.map(a => 
          a.id === alertId ? { ...a, resolved: true, resolvedAt: new Date().toISOString() } : a
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }));
    }
  },

  clearAll: () => set({ alerts: [], unreadCount: 0 })
}));
