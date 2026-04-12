export interface User {
  id: string;
  name: string;
  email: string;
  role: 'FAN' | 'STAFF' | 'MANAGER' | 'ADMIN';
  avatarUrl?: string | null;
}

export interface Zone {
  id: string;
  name: string;
  label: string;
  maxCapacity: number;
  currentCount: number;
  densityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evacuationActive: boolean;
  exitPaths?: any;
  lat: number;
  lng: number;
  polygonCoords: any;
  zoneType: string;
  svgPath?: string;
}

export interface Gate {
  id: string;
  name: string;
  label: string;
  zoneId: string;
  status: 'OPEN' | 'CLOSED' | 'LIMITED';
  currentQueueCount: number;
  avgWaitMinutes: number;
  throughputPerMinute: number;
  isVip: boolean;
}

export interface Event {
  id: string;
  venueId: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  bannerUrl?: string | null;
  status: 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  emergencyActive: boolean;
  simulationPhase: string;
  venue: {
    id: string;
    name: string;
    city: string;
  };
  zones?: Zone[];
  gates?: Gate[];
}

export interface Alert {
  id: string;
  eventId: string;
  zoneId?: string;
  zoneName?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  aiGenerated: boolean;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface SimulationState {
  phase: string;
  elapsedMinutes: number;
  totalFansInside: number;
  surgeActive: boolean;
  surgeZoneId: string | null;
  zones: {
    zone_id: string;
    name: string;
    count: number;
    max: number;
    density_level: string;
    trend: string;
    wait_minutes: number;
    flow_rate: number;
    zone_type: string;
    svg_path?: string;
  }[];
  gates: {
    gate_id: string;
    name: string;
    queue_count: number;
    wait_minutes: number;
    throughput_per_min: number;
    status: string;
  }[];
}

export interface EmergencyState {
  active: boolean;
  zone_id?: string;
  zone_name?: string;
  exit_1?: string;
  exit_2?: string;
  announcement?: string;
  message?: string;
}
