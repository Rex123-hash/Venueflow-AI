import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import ZoneMap from '../components/ZoneMap';
import DensityBadge from '../components/DensityBadge';
import { useSimulationStore } from '../stores/simulationStore';
import { useEventStore } from '../stores/eventStore';

const Demo: React.FC = () => {
  const { isLoaded, totalFansInside, phase, elapsedMinutes, surgeActive, surgeZoneId, zones } = useSimulationStore();
  const { currentEvent, fetchEvent } = useEventStore();
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the seeded event to get venue map SVG paths
    fetchEvent('event-ipl-2025-mi-csk');
  }, [fetchEvent]);

  // Combine live data with static paths
  const mapZones = currentEvent?.zones?.map(staticZone => {
    const liveZone = zones.find(z => z.zone_id === staticZone.id);
    return {
      ...staticZone,
      currentCount: liveZone?.count || 0,
      densityLevel: (liveZone?.density_level || staticZone.densityLevel) as any,
      waitMinutes: liveZone?.wait_minutes || 0,
      trend: liveZone?.trend || 'stable',
      svgPath: staticZone.svgPath || ''
    };
  }) || [];

  const formatTime = (minutes: number) => {
    const min = Math.floor(minutes);
    const sec = Math.round((minutes - min) * 60);
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const activeZoneData = mapZones.find(z => z.id === activeZoneId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 pt-4">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <h1 className="text-3xl font-bold">Live Simulation Demo</h1>
             <div className="px-2 py-1 rounded bg-danger/20 text-danger text-xs font-bold uppercase flex items-center gap-1.5 border border-danger/30">
               <span className="live-dot"></span> LIVE — 20x Speed
             </div>
           </div>
           <p className="text-text-secondary">Viewing: {currentEvent?.name || 'Loading IPL Seed Data...'}</p>
        </div>
        
        <div className="flex gap-4">
           {!isLoaded && (
             <div className="flex items-center gap-2 text-warning text-sm font-semibold bg-warning/10 px-3 py-1.5 rounded-lg border border-warning/30">
               <svg className="animate-spin h-4 w-4 text-warning" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
               </svg>
               Connecting to Digital Twin...
             </div>
           )}
           <Link to="/register" className="btn-primary">Get Full Access</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard 
          title="Total Fans Inside" 
          value={totalFansInside} 
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
          color="accent"
        />
        <StatCard 
          title="Simulation Phase" 
          value={phase.replace('_', ' ')} 
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="success"
        />
        <StatCard 
          title="Loop Timer (10m total)" 
          value={formatTime(elapsedMinutes)} 
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="accent2"
        />
        <StatCard 
          title="System Status" 
          value={surgeActive ? 'SURGE EVENT' : 'NOMINAL'} 
          icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
          color={surgeActive ? 'warning' : 'accent'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Map View */}
         <div className="lg:col-span-2 card p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Venue Digital Twin</h2>
              <div className="text-sm text-text-secondary">Click any zone to view details</div>
            </div>
            
            {mapZones.length > 0 ? (
              <ZoneMap 
                zones={mapZones} 
                activeZoneId={activeZoneId}
                onZoneClick={(z) => setActiveZoneId(z.id)}
              />
            ) : (
              <div className="w-full aspect-[4/3] bg-bg-secondary rounded-xl flex items-center justify-center border border-border">
                <p className="text-text-secondary font-mono">Initializing SVG Map Data...</p>
              </div>
            )}
         </div>

         {/* Side Panel: Zone Detail or Leaderboard */}
         <div className="flex flex-col gap-6">
            <div className="card p-6 min-h-[300px]">
               {activeZoneId && activeZoneData ? (
                 <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                   <div className="flex justify-between items-start mb-6">
                     <div>
                       <div className="text-xs text-text-secondary uppercase tracking-wider mb-1 font-bold">{activeZoneData.zoneType}</div>
                       <h2 className="text-2xl font-bold">{activeZoneData.name}</h2>
                     </div>
                     <button onClick={() => setActiveZoneId(null)} className="text-text-secondary hover:text-text-primary">
                       <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                     </button>
                   </div>
                   
                   <div className="space-y-6">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span className="text-text-secondary">Current Density</span>
                          <DensityBadge density={activeZoneData.densityLevel} />
                        </div>
                        <div className="h-4 bg-bg-secondary rounded-full overflow-hidden border border-border">
                          <motion.div 
                             className={`h-full ${
                               activeZoneData.densityLevel === 'CRITICAL' ? 'bg-danger' : 
                               activeZoneData.densityLevel === 'HIGH' ? 'bg-warning' : 
                               activeZoneData.densityLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-success'
                             }`}
                             initial={{ width: 0 }}
                             animate={{ width: `${Math.min(100, (activeZoneData.currentCount / activeZoneData.maxCapacity) * 100)}%` }}
                             transition={{ type: "spring", bounce: 0, duration: 1 }}
                          />
                        </div>
                        <div className="flex justify-between mt-1 text-xs text-text-secondary font-mono">
                          <span>{activeZoneData.currentCount.toLocaleString('en-IN')} fans</span>
                          <span>Max: {activeZoneData.maxCapacity.toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-bg-secondary p-3 rounded-lg border border-border">
                           <div className="text-xs text-text-secondary mb-1">Wait Time</div>
                           <div className="text-xl font-bold">{activeZoneData.waitMinutes} <span className="text-sm font-normal">min</span></div>
                        </div>
                        <div className="bg-bg-secondary p-3 rounded-lg border border-border">
                           <div className="text-xs text-text-secondary mb-1">Trend</div>
                           <div className="text-xl font-bold capitalize flex items-center gap-1">
                             {activeZoneData.trend}
                             {activeZoneData.trend === 'rising' && <svg className="w-4 h-4 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                             {activeZoneData.trend === 'falling' && <svg className="w-4 h-4 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
                           </div>
                        </div>
                      </div>
                   </div>
                 </motion.div>
               ) : (
                 <div className="h-full flex flex-col justify-center items-center text-center text-text-secondary opacity-70 mt-10">
                    <svg className="w-16 h-16 mb-4 stroke-current" fill="none" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p>Select a zone on the map <br/>to view live metrics.</p>
                 </div>
               )}
            </div>

            <div className="card p-6 flex-1 flex flex-col">
               <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                 <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                 Congestion Leaderboard
               </h3>
               
               <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                 {[...mapZones].sort((a,b) => (b.currentCount/b.maxCapacity) - (a.currentCount/a.maxCapacity)).slice(0, 5).map((zone, i) => {
                   const ratio = zone.currentCount / zone.maxCapacity;
                   return (
                     <div key={zone.id} className="flex items-center gap-3 p-2 rounded hover:bg-bg-secondary cursor-pointer" onClick={() => setActiveZoneId(zone.id)}>
                       <div className="w-6 text-text-secondary text-sm font-bold">{i+1}.</div>
                       <div className="flex-1">
                         <div className="flex justify-between items-center mb-1">
                           <span className="text-sm font-medium truncate max-w-[120px]">{zone.name}</span>
                           <span className="text-xs font-mono">{Math.round(ratio * 100)}%</span>
                         </div>
                         <div className="h-1.5 bg-bg-secondary w-full rounded-full">
                           <div className={`h-full rounded-full ${ratio > 0.9 ? 'bg-danger' : ratio > 0.8 ? 'bg-warning' : 'bg-success'}`} style={{ width: `${Math.min(100, ratio*100)}%` }}></div>
                         </div>
                       </div>
                       {surgeZoneId === zone.id && (
                         <div className="w-2 h-2 rounded-full bg-danger animate-pulse-glow" title="Active Surge"></div>
                       )}
                     </div>
                   );
                 })}
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default Demo;
