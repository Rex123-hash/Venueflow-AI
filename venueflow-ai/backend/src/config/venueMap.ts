// Venue map configuration: zone polygons, exit paths, adjacency
export interface ZoneConfig {
  id: string;
  name: string;
  label: string;
  maxCapacity: number;
  zoneType: 'ENTRY' | 'STAND' | 'FOOD' | 'VIP';
  lat: number;
  lng: number;
  polygonCoords: [number, number][];
  exitPaths: { exitName: string; direction: string; distanceMeters: number }[];
  adjacentZoneIds: string[];
  svgPath: string; // simplified SVG path for map rendering
  svgColor: string; // base fill color
}

export interface GateConfig {
  id: string;
  name: string;
  label: string;
  zoneId: string;
  isVip: boolean;
  defaultThroughput: number; // fans per minute
  lat: number;
  lng: number;
}

export interface VenueMapConfig {
  venueId: string;
  totalCapacity: number;
  zones: ZoneConfig[];
  gates: GateConfig[];
  svgViewBox: string;
  svgWidth: number;
  svgHeight: number;
}

// DY Patil Stadium — IPL 2025 MI vs CSK event config
export const DY_PATIL_MAP: VenueMapConfig = {
  venueId: 'dy-patil-navi-mumbai',
  totalCapacity: 55000,
  svgViewBox: '0 0 800 600',
  svgWidth: 800,
  svgHeight: 600,
  zones: [
    {
      id: 'zone-gate-a',
      name: 'Gate A',
      label: 'Gate A — South Entry',
      maxCapacity: 5000,
      zoneType: 'ENTRY',
      lat: 19.0440,
      lng: 73.0160,
      polygonCoords: [[50, 450], [150, 450], [150, 550], [50, 550]],
      exitPaths: [{ exitName: 'South Exit A1', direction: 'south', distanceMeters: 30 }],
      adjacentZoneIds: ['zone-south-stand', 'zone-food-court-east'],
      svgPath: 'M50,450 h100 v100 h-100 Z',
      svgColor: '#4F46E5',
    },
    {
      id: 'zone-gate-b',
      name: 'Gate B',
      label: 'Gate B — North Entry',
      maxCapacity: 4500,
      zoneType: 'ENTRY',
      lat: 19.0480,
      lng: 73.0160,
      polygonCoords: [[50, 50], [150, 50], [150, 150], [50, 150]],
      exitPaths: [{ exitName: 'North Exit B1', direction: 'north', distanceMeters: 25 }],
      adjacentZoneIds: ['zone-north-stand', 'zone-food-court-central'],
      svgPath: 'M50,50 h100 v100 h-100 Z',
      svgColor: '#4F46E5',
    },
    {
      id: 'zone-gate-c',
      name: 'Gate C',
      label: 'Gate C — East Entry',
      maxCapacity: 4500,
      zoneType: 'ENTRY',
      lat: 19.0460,
      lng: 73.0200,
      polygonCoords: [[650, 50], [750, 50], [750, 150], [650, 150]],
      exitPaths: [{ exitName: 'East Exit C1', direction: 'east', distanceMeters: 20 }],
      adjacentZoneIds: ['zone-north-stand', 'zone-south-stand'],
      svgPath: 'M650,50 h100 v100 h-100 Z',
      svgColor: '#4F46E5',
    },
    {
      id: 'zone-gate-d',
      name: 'Gate D',
      label: 'Gate D — VIP Entry',
      maxCapacity: 1000,
      zoneType: 'VIP',
      lat: 19.0460,
      lng: 73.0130,
      polygonCoords: [[650, 450], [750, 450], [750, 550], [650, 550]],
      exitPaths: [{ exitName: 'VIP Exit D1', direction: 'west', distanceMeters: 15 }],
      adjacentZoneIds: ['zone-south-stand'],
      svgPath: 'M650,450 h100 v100 h-100 Z',
      svgColor: '#F59E0B',
    },
    {
      id: 'zone-north-stand',
      name: 'North Stand',
      label: 'North Stand',
      maxCapacity: 20000,
      zoneType: 'STAND',
      lat: 19.0480,
      lng: 73.0165,
      polygonCoords: [[200, 120], [400, 20], [600, 120], [550, 170], [400, 90], [250, 170]],
      exitPaths: [{ exitName: 'Gate B Exit', direction: 'west', distanceMeters: 80 }],
      adjacentZoneIds: ['zone-gate-b', 'zone-gate-c', 'zone-food-court-central'],
      svgPath: 'M200,120 Q400,20 600,120 L550,170 Q400,90 250,170 Z',
      svgColor: '#6366F1',
    },
    {
      id: 'zone-south-stand',
      name: 'South Stand',
      label: 'South Stand',
      maxCapacity: 18000,
      zoneType: 'STAND',
      lat: 19.0440,
      lng: 73.0165,
      polygonCoords: [[200, 480], [400, 580], [600, 480], [550, 430], [400, 510], [250, 430]],
      exitPaths: [{ exitName: 'Gate A Exit', direction: 'west', distanceMeters: 60 }],
      adjacentZoneIds: ['zone-gate-a', 'zone-food-court-east'],
      svgPath: 'M200,480 Q400,580 600,480 L550,430 Q400,510 250,430 Z',
      svgColor: '#6366F1',
    },
    {
      id: 'zone-east-stand',
      name: 'East Stand',
      label: 'East Stand',
      maxCapacity: 12000,
      zoneType: 'STAND',
      lat: 19.0460,
      lng: 73.0180,
      polygonCoords: [[600, 200], [670, 200], [670, 400], [600, 400]],
      exitPaths: [{ exitName: 'Gate C Exit', direction: 'east', distanceMeters: 40 }],
      adjacentZoneIds: ['zone-north-stand', 'zone-south-stand', 'zone-gate-c'],
      svgPath: 'M600,200 h70 v200 h-70 Z',
      svgColor: '#6366F1',
    },
    {
      id: 'zone-west-stand',
      name: 'West Stand',
      label: 'West Stand',
      maxCapacity: 12000,
      zoneType: 'STAND',
      lat: 19.0460,
      lng: 73.0140,
      polygonCoords: [[130, 200], [200, 200], [200, 400], [130, 400]],
      exitPaths: [{ exitName: 'Gate A Exit', direction: 'west', distanceMeters: 40 }],
      adjacentZoneIds: ['zone-north-stand', 'zone-south-stand', 'zone-gate-a'],
      svgPath: 'M130,200 h70 v200 h-70 Z',
      svgColor: '#6366F1',
    },
    {
      id: 'zone-food-court-central',
      name: 'Food Court Central',
      label: 'Food Court Central',
      maxCapacity: 4000,
      zoneType: 'FOOD',
      lat: 19.0465,
      lng: 73.0158,
      polygonCoords: [[280, 280], [320, 280], [320, 320], [280, 320]],
      exitPaths: [{ exitName: 'Gate B Exit', direction: 'north', distanceMeters: 100 }],
      adjacentZoneIds: ['zone-north-stand', 'zone-south-stand'],
      svgPath: 'M280,280 h40 v40 h-40 Z',
      svgColor: '#22D3EE',
    },
    {
      id: 'zone-food-court-east',
      name: 'Food Court East',
      label: 'Food Court East',
      maxCapacity: 2500,
      zoneType: 'FOOD',
      lat: 19.0455,
      lng: 73.0180,
      polygonCoords: [[480, 280], [520, 280], [520, 320], [480, 320]],
      exitPaths: [{ exitName: 'Gate C Exit', direction: 'east', distanceMeters: 80 }],
      adjacentZoneIds: ['zone-north-stand', 'zone-south-stand'],
      svgPath: 'M480,280 h40 v40 h-40 Z',
      svgColor: '#22D3EE',
    },
  ],
  gates: [
    { id: 'gate-a', name: 'Gate A', label: 'Gate A', zoneId: 'zone-gate-a', isVip: false, defaultThroughput: 200, lat: 19.0440, lng: 73.0155 },
    { id: 'gate-b', name: 'Gate B', label: 'Gate B', zoneId: 'zone-gate-b', isVip: false, defaultThroughput: 200, lat: 19.0485, lng: 73.0155 },
    { id: 'gate-c', name: 'Gate C', label: 'Gate C', zoneId: 'zone-gate-c', isVip: false, defaultThroughput: 200, lat: 19.0460, lng: 73.0205 },
    { id: 'gate-d', name: 'Gate D', label: 'Gate D (VIP)', zoneId: 'zone-gate-d', isVip: true, defaultThroughput: 80, lat: 19.0460, lng: 73.0125 },
  ],
};

export function getZoneConfig(zoneId: string): ZoneConfig | undefined {
  return DY_PATIL_MAP.zones.find(z => z.id === zoneId);
}

export function getGateConfig(gateId: string): GateConfig | undefined {
  return DY_PATIL_MAP.gates.find(g => g.id === gateId);
}

export function getNearestExits(zoneId: string): string[] {
  const zone = getZoneConfig(zoneId);
  if (!zone) return ['Nearest Gate', 'Emergency Exit'];
  return zone.exitPaths.map(e => e.exitName).slice(0, 2);
}
