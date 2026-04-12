import { create } from 'zustand';
import { SimulationState, EmergencyState } from '../types';

interface InternalSimulationState extends SimulationState {
  isLoaded: boolean;
  emergency: EmergencyState;
  
  updateFromSocket: (data: Partial<SimulationState>) => void;
  setEmergency: (data: EmergencyState) => void;
  clearEmergency: () => void;
}

export const useSimulationStore = create<InternalSimulationState>((set) => ({
  phase: 'GATES_OPEN',
  elapsedMinutes: 0,
  totalFansInside: 0,
  surgeActive: false,
  surgeZoneId: null,
  zones: [],
  gates: [],
  isLoaded: false,
  
  emergency: {
    active: false
  },

  updateFromSocket: (data) => set((state) => ({
    ...state,
    ...data,
    isLoaded: true
  })),

  setEmergency: (data) => set({ 
    emergency: { ...data, active: true } 
  }),
  
  clearEmergency: () => set({ 
    emergency: { active: false } 
  })
}));
