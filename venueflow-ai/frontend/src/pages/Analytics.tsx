import React from 'react';
import StatCard from '../components/StatCard';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend } from 'recharts';
import { motion } from 'framer-motion';

const MOCK_COMPARISON_DATA = [
  { time: '17:00', current: 15000, avg: 12000 },
  { time: '17:30', current: 28000, avg: 24000 },
  { time: '18:00', current: 42000, avg: 38000 },
  { time: '18:30', current: 49000, avg: 47000 },
  { time: '19:00', current: 51200, avg: 49000 },
  { time: '19:30', current: 52000, avg: 50000 },
  { time: '20:00', current: 48000, avg: 46000 },
];

const MOCK_SATISFACTION_DATA = [
  { name: 'Helpful', value: 87, fill: '#10B981' },
  { name: 'Neutral', value: 10, fill: '#F59E0B' },
  { name: 'Poor', value: 3, fill: '#EF4444' }
];

const Analytics: React.FC = () => {

  // Generate mock heatmap calendar for current month (30 days)
  const heatmapDays = Array.from({ length: 30 }, (_, i) => {
     const hasEvent = Math.random() > 0.6;
     return {
        day: i + 1,
        hasEvent,
        intensity: hasEvent ? Math.floor(Math.random() * 100) : 0
     };
  });

  return (
    <div className="max-w-[1600px] mx-auto px-4 py-8">
       <div className="mb-8">
           <h1 className="text-3xl font-bold mb-1">Post-Match Analytics & Insights</h1>
           <p className="text-text-secondary">Historical comparison and fan satisfaction metrics.</p>
       </div>

       {/* Top Summary Cards */}
       <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard title="Peak Crowd Time" value="19:24 PM" suffix="" color="accent" />
          <StatCard title="Busiest Gate" value="Gate B" suffix="" color="warning" />
          <StatCard title="Most Congested Zone" value="Food Court East" suffix="" color="danger" />
          <StatCard title="Avg Fan Rating" value="4.8" suffix="/5.0" color="success" />
       </motion.div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Historical Area Chart */}
          <div className="lg:col-span-2 card p-6">
             <h3 className="font-bold text-lg mb-6">Attendance Pace Correlation (Current vs Last 5 Matches)</h3>
             <div className="w-full h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={MOCK_COMPARISON_DATA} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                     <defs>
                        <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#64748B" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#64748B" stopOpacity={0}/>
                        </linearGradient>
                     </defs>
                     <XAxis dataKey="time" stroke="#475569" />
                     <YAxis stroke="#475569" />
                     <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" vertical={false} />
                     <Tooltip contentStyle={{ backgroundColor: '#111318', borderColor: '#1E293B' }} />
                     <Area type="monotone" dataKey="avg" stroke="#64748B" fillOpacity={1} fill="url(#colorAvg)" name="5-Match Avg" />
                     <Area type="monotone" dataKey="current" stroke="#3B82F6" fillOpacity={1} fill="url(#colorCurrent)" name="Today" />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          {/* Fan Satisfaction metrics */}
          <div className="card p-6 flex flex-col">
             <h3 className="font-bold text-lg mb-6">Fan Satisfaction</h3>
             
             <div className="flex-1 w-full h-[200px] mb-6">
               <ResponsiveContainer width="100%" height="100%">
                 <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="100%" barSize={15} data={MOCK_SATISFACTION_DATA}>
                   <RadialBar
                     background={{ fill: '#1E293B' }}
                     dataKey="value"
                     cornerRadius={10}
                   />
                   <Tooltip contentStyle={{ backgroundColor: '#111318', borderColor: '#1E293B' }} />
                 </RadialBarChart>
               </ResponsiveContainer>
             </div>

             <div className="space-y-4">
                <div className="bg-bg-secondary p-4 rounded-lg border border-border">
                   <p className="text-3xl font-black text-success mb-1">87%</p>
                   <p className="text-sm text-text-secondary">Fans found app navigation deeply helpful for bypassing lines.</p>
                </div>
                <div className="bg-bg-secondary p-4 rounded-lg border border-border">
                   <p className="text-3xl font-black text-accent mb-1">94%</p>
                   <p className="text-sm text-text-secondary">Queries resolved autonomously by FlowBot without human intervention.</p>
                </div>
             </div>
          </div>

          {/* Heatmap Section */}
          <div className="lg:col-span-3 card p-6">
             <h3 className="font-bold text-lg mb-6">Monthly Event Intensity Heatmap</h3>
             <div className="flex flex-wrap gap-2">
                {heatmapDays.map((d, i) => {
                   let colorClass = "bg-bg-secondary border-border text-text-secondary opacity-50";
                   if (d.hasEvent) {
                       if (d.intensity > 80) colorClass = "bg-danger text-white border-danger shadow-glow-red";
                       else if (d.intensity > 50) colorClass = "bg-warning text-white border-warning";
                       else colorClass = "bg-success text-white border-success";
                   }
                   return (
                     <div key={i} className={`w-14 h-14 rounded border flex flex-col items-center justify-center transition-transform hover:scale-110 cursor-default ${colorClass}`}>
                       <span className="font-bold text-sm">{d.day}</span>
                       {d.hasEvent && <span className="text-[10px] opacity-80">{d.intensity}%</span>}
                     </div>
                   );
                })}
             </div>
             <div className="flex gap-4 mt-6 text-xs text-text-secondary border-t border-border pt-4">
                 <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-bg-secondary border border-border"></div> No Event</span>
                 <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-success"></div> Low Intensity</span>
                 <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-warning"></div> Med Intensity</span>
                 <span className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-danger"></div> High Intensity</span>
             </div>
          </div>

       </div>
    </div>
  );
};

export default Analytics;
