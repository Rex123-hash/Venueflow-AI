import { create } from 'zustand';
import { Event, Zone, Gate } from '../types';
import api from '../lib/api';

interface EventState {
  currentEvent: Event | null;
  events: Event[];
  isLoading: boolean;
  error: string | null;
  
  fetchEvents: () => Promise<void>;
  fetchEvent: (id: string) => Promise<void>;
  setCurrentEvent: (event: Event) => void;
  updateZone: (zoneId: string, data: Partial<Zone>) => void;
  updateGate: (gateId: string, data: Partial<Gate>) => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  currentEvent: null,
  events: [],
  isLoading: false,
  error: null,

  fetchEvents: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/events');
      set({ events: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch events', isLoading: false });
    }
  },

  fetchEvent: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get(`/events/${id}`);
      set({ currentEvent: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch event details', isLoading: false });
    }
  },

  setCurrentEvent: (event) => set({ currentEvent: event }),

  updateZone: (zoneId, data) => set((state) => {
    if (!state.currentEvent?.zones) return state;
    
    const newEvent = { ...state.currentEvent };
    newEvent.zones = newEvent.zones!.map(z => 
      z.id === zoneId ? { ...z, ...data } : z
    );
    
    return { currentEvent: newEvent };
  }),

  updateGate: (gateId, data) => set((state) => {
    if (!state.currentEvent?.gates) return state;
    
    const newEvent = { ...state.currentEvent };
    newEvent.gates = newEvent.gates!.map(g => 
      g.id === gateId ? { ...g, ...data } : g
    );
    
    return { currentEvent: newEvent };
  })
}));
