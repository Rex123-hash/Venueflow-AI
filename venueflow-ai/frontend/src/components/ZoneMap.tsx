import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Zone {
  id: string;
  name: string;
  densityLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  polygonCoords: [number, number][];
  svgPath: string;
  zoneType: string;
  currentCount?: number;
  maxCapacity?: number;
}

interface ZoneMapProps {
  zones: Zone[];
  activeZoneId?: string | null;
  onZoneClick?: (zone: Zone) => void;
  className?: string;
  viewBox?: string;
  emergencyPaths?: {
    active: boolean;
    exit1Path?: string;
    exit2Path?: string;
  };
}

const ZoneMap: React.FC<ZoneMapProps> = ({ 
  zones, 
  activeZoneId, 
  onZoneClick, 
  className = '',
  viewBox = "0 0 800 600",
  emergencyPaths
}) => {
  // Memoize path generation to avoid recalculating on every render unless coordinates change
  const renderPaths = useMemo(() => {
    return zones.map((zone) => {
      const isActive = activeZoneId === zone.id;
      const isEmergency = emergencyPaths?.active;
      
      // If emergency is active and this isn't an exit path, dim it significantly
      const opacityClass = isEmergency ? 'opacity-20' : isActive ? 'opacity-100 drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'opacity-80 hover:opacity-100';
      
      // Base stroke styles depending on active state
      const strokeClass = isActive && !isEmergency ? 'stroke-white stroke-[3px] z-10' : 'stroke-white/20 stroke-1 hover:stroke-white/50';

      return (
        <motion.path
          key={zone.id}
          d={zone.svgPath}
          onClick={() => onZoneClick && onZoneClick(zone)}
          className={`zone-fill-${zone.densityLevel} ${strokeClass} ${opacityClass} transition-all duration-300 cursor-pointer origin-center`}
          whileHover={!isEmergency ? { scale: 1.01 } : {}}
          whileTap={!isEmergency ? { scale: 0.99 } : {}}
          style={{ vectorEffect: 'non-scaling-stroke' }} // Keeps stroke width consistent when scaled
        />
      );
    });
  }, [zones, activeZoneId, onZoneClick, emergencyPaths?.active]);

  return (
    <div className={`relative w-full aspect-[4/3] bg-bg-secondary rounded-xl border border-border overflow-hidden ${className}`}>
      {/* Map Background grid */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(var(--text-secondary) 1px, transparent 1px), linear-gradient(90deg, var(--text-secondary) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <svg 
        viewBox={viewBox} 
        className="w-full h-full relative z-10 drop-shadow-2xl"
        preserveAspectRatio="xMidYMid meet"
      >
        <g className="zones-layer">
          {renderPaths}
        </g>
        
        {/* Fan Simulation Layer */}
        {!emergencyPaths?.active && (
          <g className="fans-layer pointer-events-none">
             {zones.map(zone => {
               if (!zone.polygonCoords || zone.polygonCoords.length === 0) return null;
               let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
               zone.polygonCoords.forEach(([x, y]) => {
                 if (x < minX) minX = x;
                 if (x > maxX) maxX = x;
                 if (y < minY) minY = y;
                 if (y > maxY) maxY = y;
               });
               const cx = (minX + maxX) / 2;
               const cy = (minY + maxY) / 2;
               const w = (maxX - minX);
               const h = (maxY - minY);
               
               // Generate more dots based on density
               const dotCount = zone.densityLevel === 'CRITICAL' ? 15 : zone.densityLevel === 'HIGH' ? 10 : zone.densityLevel === 'MEDIUM' ? 5 : 2;
               
               return Array.from({ length: dotCount }).map((_, i) => {
                 const startX = cx + (Math.random() - 0.5) * w * 0.8;
                 const startY = cy + (Math.random() - 0.5) * h * 0.8;
                 const tx = (Math.random() - 0.5) * 80;
                 const ty = (Math.random() - 0.5) * 80;
                 const dur = 2 + Math.random() * 3;
                 const del = Math.random() * 2;
                 
                 return (
                   <circle 
                     key={`fan-${zone.id}-${i}`}
                     cx={startX} cy={startY} r="3"
                     className="fan-dot"
                     style={{
                       '--tx': `${tx}px`,
                       '--ty': `${ty}px`,
                       '--dur': `${dur}s`,
                       '--del': `${del}s`
                     } as any}
                   />
                 );
               });
             })}
          </g>
        )}
        
        {/* Draw mock pitch for stadium context */}
        <g className={`pitch-layer pointer-events-none transition-opacity duration-300 ${emergencyPaths?.active ? 'opacity-10' : 'opacity-30'}`}>
           <ellipse cx="465" cy="135" rx="70" ry="100" className="fill-green-900/40 stroke-white/20 stroke-2 transform rotate-90 origin-center translate-y-32 -translate-x-32" />
           <rect x="365" y="245" width="200" height="40" className="fill-amber-900/60 stroke-white/30 stroke-1" />
        </g>

        {/* Labels Layer (only show if few zones or zoomed in, simplified for demo) */}
        <g className={`labels-layer pointer-events-none transition-opacity duration-300 ${emergencyPaths?.active ? 'opacity-0' : 'opacity-100'}`}>
          {zones.map(zone => {
            // Calculate rough center for label placement
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            if (zone.polygonCoords && zone.polygonCoords.length > 0) {
               zone.polygonCoords.forEach(([x, y]) => {
                 if (x < minX) minX = x;
                 if (x > maxX) maxX = x;
                 if (y < minY) minY = y;
                 if (y > maxY) maxY = y;
               });
            } else {
               // Fallback if no coords parsed
               minX = 400; maxX = 400; minY = 300; maxY = 300;
            }
            const cx = (minX + maxX) / 2;
            const cy = (minY + maxY) / 2;
            const percentage = zone.currentCount !== undefined && zone.maxCapacity ? Math.round((zone.currentCount / zone.maxCapacity) * 100) : 0;

            return (
              <g key={`label-group-${zone.id}`} className="transition-transform duration-300 hover:scale-110 pointer-events-none">
                <text 
                  x={cx} 
                  y={cy - 8} 
                  textAnchor="middle" 
                  dominantBaseline="middle"
                  className="fill-white font-sans text-xs font-bold tracking-wider uppercase drop-shadow-md"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
                >
                  {zone.name.replace(' Stand', '').replace(' Gate', '').replace('Food Court', 'FC')}
                </text>
                <text 
                  x={cx} 
                  y={cy + 10} 
                  textAnchor="middle" 
                  dominantBaseline="middle"
                  className="fill-white font-mono text-sm font-black drop-shadow-md"
                  style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}
                >
                  {percentage}%
                </text>
              </g>
            );
          })}
        </g>

        {/* Emergency Escape Routes Layer */}
        <AnimatePresence>
          {emergencyPaths?.active && (
            <g className="emergency-routes-layer pointer-events-none z-50">
               {/* Mock Exit Paths for Demo (normally calculated per-zone) */}
               {/* Path to Exit 1 (Gate A) */}
               <motion.path 
                 initial={{ pathLength: 0, opacity: 0 }}
                 animate={{ pathLength: 1, opacity: 1 }}
                 exit={{ opacity: 0 }}
                 transition={{ duration: 1.5, ease: "easeInOut" }}
                 d="M465 265 L465 400 L175 400 L175 540" 
                 className="stroke-[#00FF88] stroke-[6px] fill-none drop-shadow-[0_0_10px_#00FF88]"
                 strokeDasharray="20 10"
               />
               {/* Path to Exit 2 (Gate C) */}
               <motion.path 
                 initial={{ pathLength: 0, opacity: 0 }}
                 animate={{ pathLength: 1, opacity: 1 }}
                 exit={{ opacity: 0 }}
                 transition={{ duration: 1.5, ease: "easeInOut", delay: 0.5 }}
                 d="M465 265 L600 265 L600 300 L730 300" 
                 className="stroke-[#00FF88] stroke-[6px] fill-none drop-shadow-[0_0_10px_#00FF88]"
                 strokeDasharray="20 10"
               />
               
               {/* Animated arrows moving along the path */}
               <path d="M465 265 L465 400 L175 400 L175 540" className="stroke-white stroke-[3px] fill-none animate-arrow-march" strokeDasharray="10 30" />
               <path d="M465 265 L600 265 L600 300 L730 300" className="stroke-white stroke-[3px] fill-none animate-arrow-march" strokeDasharray="10 30" />
            </g>
          )}
        </AnimatePresence>

        {/* Fan Location Indicator (if active zone selected) */}
        {!emergencyPaths?.active && activeZoneId && (
          <g className="fan-location-layer pointer-events-none z-40">
             {(() => {
                const zone = zones.find(z => z.id === activeZoneId);
                if (!zone || !zone.polygonCoords || zone.polygonCoords.length === 0) return null;
                // Roughly place fan in center of their active zone
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                zone.polygonCoords.forEach(([x, y]) => {
                  if (x < minX) minX = x;
                  if (x > maxX) maxX = x;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                });
                const cx = (minX + maxX) / 2;
                const cy = (minY + maxY) / 2;

                return (
                  <circle cx={cx} cy={cy + 20} r="8" className="fill-accent stroke-white stroke-2 animate-bounce-subtle drop-shadow-[0_0_10px_rgba(99,102,241,0.8)]" />
                );
             })()}
          </g>
        )}
      </svg>
      
      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 flex gap-3 bg-bg-card/80 backdrop-blur-md p-2.5 rounded-lg border border-border z-20 pointer-events-none shadow-lg">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#10B981]"></span><span className="text-[10px] font-bold text-text-secondary">LOW</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#F59E0B]"></span><span className="text-[10px] font-bold text-text-secondary">MED</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#F97316]"></span><span className="text-[10px] font-bold text-text-secondary">HIGH</span></div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#EF4444]"></span><span className="text-[10px] font-bold text-text-secondary">CRIT</span></div>
      </div>
    </div>
  );
};

export default ZoneMap;
