import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSimulationStore } from '../stores/simulationStore';
import { useEventStore } from '../stores/eventStore';
import { useAuthStore } from '../stores/authStore';
import ZoneMap from '../components/ZoneMap';
import { triggerToast } from '../components/AlertBanner';
import api from '../lib/api';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

// ─── Types ───────────────────────────────────────────────────────────────────
interface FlowAgentPrediction {
  prediction: string;
  action: string;
  actionType: 'deploy_staff' | 'open_gate' | 'alert_vendors' | 'broadcast_pa' | 'monitor';
  confidence: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  targetZone: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

const urgencyColors: Record<string, { bg: string; border: string; badge: string }> = {
  low:      { bg: 'rgba(16,185,129,0.08)',  border: '#10b98140', badge: '#10b981' },
  medium:   { bg: 'rgba(245,158,11,0.08)',  border: '#f59e0b40', badge: '#f59e0b' },
  high:     { bg: 'rgba(249,115,22,0.08)',  border: '#f9731640', badge: '#f97316' },
  critical: { bg: 'rgba(239,68,68,0.08)',   border: '#ef444440', badge: '#ef4444' },
};

// ─── Skeleton Card ────────────────────────────────────────────────────────────
const SkeletonCard: React.FC<{ delay?: number }> = ({ delay = 0 }) => (
  <div
    style={{
      background: 'linear-gradient(90deg, #0f1828 25%, #1a2840 50%, #0f1828 75%)',
      backgroundSize: '200% 100%',
      animation: `shimmer 1.5s infinite ${delay}s`,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      height: 90,
      border: '1px solid #1e3a5f',
    }}
  />
);

// ─── Component ────────────────────────────────────────────────────────────────
const ManagerDashboard: React.FC = () => {
  const { phase, elapsedMinutes, totalFansInside, zones, gates, surgeActive } = useSimulationStore();
  const { fetchEvent, currentEvent } = useEventStore();
  const { user } = useAuthStore();
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);

  // ─── FlowAgent Predictions State ─────────────────────────────────────────
  const [predictions, setPredictions] = useState<FlowAgentPrediction[]>([]);
  const [predLoading, setPredLoading] = useState(false);
  const [predStatus, setPredStatus] = useState<'loading' | 'live' | 'offline' | 'idle'>('idle');
  const [usedFallback, setUsedFallback] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // ─── Fetch Predictions ────────────────────────────────────────────────────
  const fetchPredictions = useCallback(async () => {
    if (predLoading) return;
    setPredLoading(true);
    setPredStatus('loading');
    setUsedFallback(false);

    const zonePayload = currentEvent?.zones?.map((staticZone: any) => {
      const live = zones.find((z: any) => z.zone_id === staticZone.id);
      return {
        id: staticZone.id,
        name: staticZone.name,
        occ: live?.count || Math.floor(staticZone.capacity * 0.4),
        cap: staticZone.capacity || 5000,
      };
    }) || zones.slice(0, 8).map((z: any) => ({
      id: z.zone_id,
      name: z.name,
      occ: z.count || 1000,
      cap: 5000,
    }));

    try {
      const res = await api.post('/ai/predict', {
        zones: zonePayload,
        phase,
        totalFans: totalFansInside,
        capacity: 42000,
      });

      if (res.data.predictions?.length > 0) {
        setPredictions(res.data.predictions);
        setPredStatus(res.data.success ? 'live' : 'offline');
        if (!res.data.success) setUsedFallback(true);
      }
    } catch {
      setPredStatus('offline');
      setUsedFallback(true);
    } finally {
      setPredLoading(false);
    }
  }, [phase, totalFansInside, zones, currentEvent, predLoading]);

  // ─── Auto-refresh every 60 seconds ───────────────────────────────────────
  useEffect(() => {
    fetchEvent('event-ipl-2025-mi-csk');

    const loadHistory = async () => {
      try {
        const res = await api.get('/simulation/history');
        const formatted = res.data.map((d: any, i: number) => ({
          time: `-${30 - i}m`,
          count: Math.floor(d.count / 1000),
        }));
        setHistoryData(formatted.slice(-15));
      } catch {
        const d = [];
        for (let i = 0; i < 15; i++) d.push({ time: `-${15 - i}m`, count: 10 + i + Math.random() * 5 });
        setHistoryData(d);
      }
    };
    loadHistory();

    // Initial prediction fetch (delayed so zone data is ready)
    const initTimer = setTimeout(() => fetchPredictions(), 1500);

    // Auto-refresh every 60s
    intervalRef.current = setInterval(() => fetchPredictions(), 60000);

    return () => {
      clearTimeout(initTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchEvent]);

  // Refetch when phase changes
  useEffect(() => {
    if (phase) fetchPredictions();
  }, [phase]);

  // ─── Simulation Controls ──────────────────────────────────────────────────
  const handleSurge = async () => {
    try {
      await api.post('/simulation/control', { action: 'surge', zoneId: activeZoneId || undefined });
      triggerToast('Simulated crowd surge triggered.', 'INFO');
      setTimeout(() => fetchPredictions(), 500);
    } catch {
      triggerToast('Failed to trigger surge', 'WARNING');
    }
  };

  const handleSpeedPhase = async (newPhase: string) => {
    try {
      await api.post('/simulation/control', { action: 'phase-skip', phase: newPhase });
      triggerToast(`Jumped to phase: ${newPhase}`, 'INFO');
      setTimeout(() => fetchPredictions(), 500);
    } catch {
      triggerToast('Failed to skip phase', 'WARNING');
    }
  };

  const handleEmergency = async () => {
    if (!window.confirm('WARNING: Triggering Emergency Evacuation God Mode. Proceed?')) return;
    try {
      await api.post('/emergency/trigger', {
        event_id: 'event-ipl-2025-mi-csk',
        zone_id: activeZoneId || 'zone-north',
        category: 'FIRE',
      });
      triggerToast('God Mode Active!', 'WARNING');
      setTimeout(() => fetchPredictions(), 500);
    } catch {
      triggerToast('Failed to trigger emergency', 'WARNING');
    }
  };

  // ─── Export Report ────────────────────────────────────────────────────────
  const handleExportReport = () => {
    const now = new Date();
    const dateStr = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const filename = `VenueFlow_Report_DYPatil_${now.toISOString().slice(0, 10)}.txt`;

    const zoneStatus = (currentEvent?.zones || zones.slice(0, 8)).map((z: any) => {
      const live = zones.find((lz: any) => lz.zone_id === z.id || lz.zone_id === z.zone_id);
      const occ = live?.count || z.count || 0;
      const cap = z.capacity || 5000;
      const pct = Math.round((occ / cap) * 100);
      const status = pct > 85 ? 'CRITICAL' : pct > 70 ? 'HIGH' : pct > 40 ? 'MED' : 'LOW';
      const wait = Math.round(pct / 100 * 15);
      return `${(z.name || 'Zone').padEnd(28)} ${String(pct + '%').padEnd(6)} (${occ}/${cap}) — ${status} — Wait: ${wait}min`;
    }).join('\n');

    const predLines = predictions.map((p, i) =>
      `${i + 1}. [${p.urgency.toUpperCase()}] ${p.prediction} (${p.confidence}% confidence)\n   Action: ${p.action} → ${p.targetZone}`
    ).join('\n');

    const report = `═══════════════════════════════════════════════════
VENUEFLOW AI — OPERATIONS REPORT
Generated by: ${user?.name || 'Manager'}
Email: ${user?.email || 'N/A'}
Venue: DY Patil Stadium, Navi Mumbai
Event: IPL 2025 — Mumbai Indians vs CSK
Date: ${dateStr} IST
═══════════════════════════════════════════════════

VENUE SUMMARY
─────────────────────────────────────────────────
Total Fans Inside : ${totalFansInside.toLocaleString()}
Overall Load      : ${Math.round((totalFansInside / 42000) * 100)}%
Event Phase       : ${phase}
Active Alerts     : ${surgeActive ? 1 : 0}
Elapsed Minutes   : ${elapsedMinutes}

ZONE STATUS
─────────────────────────────────────────────────
${zoneStatus}

FLOWAGENT AI PREDICTIONS
─────────────────────────────────────────────────
${predLines || 'No predictions generated yet.'}

═══════════════════════════════════════════════════
Report generated by VenueFlow AI
Powered by Google Cloud Vertex AI
═══════════════════════════════════════════════════`;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Map Zones ────────────────────────────────────────────────────────────
  const mapZones = currentEvent?.zones?.map((staticZone: any) => {
    const liveZone = zones.find((z: any) => z.zone_id === staticZone.id);
    return {
      ...staticZone,
      currentCount: liveZone?.count || 0,
      densityLevel: (liveZone?.density_level || staticZone.densityLevel) as any,
      waitMinutes: liveZone?.wait_minutes || 0,
      trend: liveZone?.trend || 'stable',
      svgPath: staticZone.svgPath || '',
    };
  }) || [];

  const barData = gates.map((g: any) => ({ name: g.name.replace('Gate ', 'G'), wait: g.wait_minutes }));
  const pieData = zones.filter((z: any) => z.count > 0).slice(0, 5).map((z: any) => ({ name: z.name, value: z.count }));

  // ─── Status indicator label ───────────────────────────────────────────────
  const statusLabel = predStatus === 'loading' ? 'Analyzing...' : predStatus === 'live' ? 'AI · Live' : predStatus === 'offline' ? 'AI · Offline' : 'AI · Live';
  const statusColor = predStatus === 'loading' ? '#f59e0b' : predStatus === 'offline' ? '#ef4444' : '#00e5a0';

  return (
    <>
      {/* Shimmer animation */}
      <style>{`@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>

      <div className="max-w-[1600px] mx-auto px-4 py-8">
        <div className="flex flex-col xl:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-1 tracking-tight">Operations Command Center</h1>
            <p className="text-text-secondary">{currentEvent?.name} — Live Telemetry</p>
          </div>

          {/* Phase buttons */}
          <div className="flex bg-bg-secondary p-1 rounded-lg border border-border">
            {['PRE_MATCH', 'GATES_OPEN', 'MATCH_LIVE', 'HALFTIME', 'CLEARING'].map(p => (
              <button
                key={p}
                onClick={() => handleSpeedPhase(p)}
                className={`text-xs px-3 py-1.5 rounded-md font-bold transition-colors ${phase === p ? 'bg-accent text-white' : 'text-text-secondary hover:text-white hover:bg-bg-card'}`}
              >
                {p.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="flex gap-4">
            <button onClick={handleSurge} className="px-5 py-2 border border-warning text-warning hover:bg-warning/10 rounded-lg transition-colors font-bold text-sm">
              {activeZoneId ? 'Trigger Surge Here' : 'Trigger Random Surge'}
            </button>
            <button onClick={handleEmergency} className="btn-danger flex items-center justify-center gap-2 px-6 shadow-glow-red hover:animate-pulse">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              GOD MODE
            </button>
          </div>
        </div>

        {/* KPI Row */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <div className="card p-4 border-l-4 border-accent"><p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Total Fans</p><p className="text-2xl font-black font-mono mt-1">{totalFansInside.toLocaleString()}</p></div>
          <div className="card p-4 border-l-4 border-success"><p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Gate Avg Wait</p><p className="text-2xl font-black font-mono mt-1">{Math.round(gates.reduce((acc: number, g: any) => acc + g.wait_minutes, 0) / (gates.length || 1))}m</p></div>
          <div className="card p-4 border-l-4 border-danger"><p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Active Alerts</p><p className="text-2xl font-black font-mono mt-1">{surgeActive ? 1 : 0}</p></div>
          <div className="card p-4 border-l-4 border-indigo-500"><p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Sim Phase</p><p className="text-2xl font-black font-mono mt-1 text-sm pt-2">{phase.replace('_', ' ')}</p></div>
          <div className="card p-4 border-l-4 border-warning"><p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Venue Load</p><p className="text-2xl font-black font-mono mt-1">{Math.round((totalFansInside / 42000) * 100)}%</p></div>
          <div className="card p-4 border-l-4 border-emerald-500"><p className="text-xs text-text-secondary font-bold uppercase tracking-wider">Est Revenue</p><p className="text-2xl font-black font-mono mt-1">₹{(totalFansInside * 500).toLocaleString()}</p></div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left column */}
          <div className="lg:col-span-8 flex flex-col gap-8">
            {/* Venue Map */}
            <div className="card p-6 flex-1 min-h-[500px] border-accent/20">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2"><div className="live-dot" /> Venue Digital Twin</h3>
                {activeZoneId && <button onClick={() => setActiveZoneId(null)} className="text-xs text-accent hover:text-accent-light">Clear Selection</button>}
              </div>
              {mapZones.length > 0 && <ZoneMap zones={mapZones} activeZoneId={activeZoneId} onZoneClick={(z: any) => setActiveZoneId(z.id)} />}
              <div className="mt-4 flex gap-4 text-xs font-bold text-text-secondary justify-center">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success" /> LOW</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> MED</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" /> HIGH</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-danger" /> CRIT</span>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card p-4 bg-bg-secondary h-[250px] flex flex-col">
                <h4 className="text-sm font-bold text-text-secondary mb-4">Crowd Density (Last 15m)</h4>
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData}>
                      <defs><linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="time" hide /><YAxis hide domain={['auto', 'auto']} />
                      <Tooltip contentStyle={{ backgroundColor: '#111318', borderColor: '#1E293B', fontSize: '12px' }} />
                      <Area type="monotone" dataKey="count" stroke="#3B82F6" fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card p-4 bg-bg-secondary h-[250px] flex flex-col">
                <h4 className="text-sm font-bold text-text-secondary mb-4">Gate Wait Times</h4>
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: '#1E293B' }} contentStyle={{ backgroundColor: '#111318', borderColor: '#1E293B', fontSize: '12px' }} />
                      <Bar dataKey="wait" fill="#10B981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card p-4 bg-bg-secondary h-[250px] flex flex-col">
                <h4 className="text-sm font-bold text-text-secondary mb-4">Zone Distribution</h4>
                <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={5} dataKey="value" stroke="none">
                        {pieData.map((_: any, index: number) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#111318', borderColor: '#1E293B', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="lg:col-span-4 flex flex-col gap-6">

            {/* FlowAgent Predictions Panel */}
            <div className="card border-accent/40 shadow-[0_0_20px_rgba(59,130,246,0.1)] overflow-hidden">
              <div className="bg-gradient-to-r from-accent/20 to-transparent p-4 border-b border-accent/20 flex gap-3 items-center justify-between">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded bg-accent/20 flex items-center justify-center animate-pulse"><span className="text-accent text-xl">⚡</span></div>
                  <h3 className="font-bold">FlowAgent Predictions</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span id="flowagent-status" style={{ fontSize: 9, color: statusColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    {statusLabel}
                  </span>
                  <button
                    onClick={fetchPredictions}
                    disabled={predLoading}
                    className="text-[10px] px-2 py-1 rounded border border-accent/30 text-accent hover:bg-accent/10 transition-colors disabled:opacity-40"
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {usedFallback && (
                <div className="px-4 pt-2">
                  <span className="text-[10px] text-amber-400">⚠ Using cached predictions</span>
                </div>
              )}

              <div className="p-4 space-y-2 bg-bg-primary/50" id="flowagent-predictions">
                {predLoading || predictions.length === 0 ? (
                  <>
                    <SkeletonCard delay={0} />
                    <SkeletonCard delay={0.15} />
                    <SkeletonCard delay={0.3} />
                  </>
                ) : (
                  predictions.map((p, i) => {
                    const c = urgencyColors[p.urgency] || urgencyColors.medium;
                    return (
                      <div
                        key={i}
                        id={`pred-card-${i}`}
                        style={{
                          background: c.bg,
                          border: `1px solid ${c.border}`,
                          borderRadius: 12,
                          padding: 14,
                          animation: `fadeInUp 0.3s ease ${i * 0.1}s both`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4, flex: 1, marginRight: 10 }}>
                            {p.prediction}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            <span style={{ background: `${c.badge}20`, border: `1px solid ${c.badge}60`, color: c.badge, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99 }}>
                              {p.confidence}%
                            </span>
                            <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                              {p.urgency}
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 9, color: '#475569' }}>Zone: {p.targetZone}</span>
                          <button
                            onClick={() => triggerToast(`${p.action} action triggered for ${p.targetZone}`, 'INFO')}
                            style={{ background: '#0f1828', border: '1px solid #1e3a5f', borderRadius: 8, padding: '6px 14px', fontSize: 11, fontWeight: 600, color: '#3b82f6', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                          >
                            → {p.action}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Alert Management */}
            <div className="card p-5 flex-1">
              <h3 className="font-bold mb-4 flex justify-between items-center">
                Alert Center
                <span className="bg-danger text-white text-xs px-2 py-0.5 rounded-full">{surgeActive ? 1 : 0} Active</span>
              </h3>
              <div className="space-y-3">
                {surgeActive ? (
                  <div className="bg-danger/10 border border-danger/30 p-3 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-danger uppercase">Congestion</span>
                      <span className="text-[10px] text-text-secondary">Just now</span>
                    </div>
                    <p className="text-sm mb-3">Zone capacity exceeded 90%. System triggered automatic flow throttling at gates.</p>
                    <div className="flex gap-2">
                      <button className="flex-1 bg-bg-secondary hover:bg-border text-xs py-1.5 rounded font-bold transition-colors">Resolve</button>
                      <button className="flex-1 bg-danger text-white text-xs py-1.5 rounded font-bold hover:bg-red-600 transition-colors">Escalate</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-text-secondary border border-dashed border-border rounded-lg">No active alerts.</div>
                )}
                <div className="bg-bg-secondary border border-border p-3 rounded-lg opacity-60">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-bold text-success uppercase">Resolved</span>
                    <span className="text-[10px] text-text-secondary">42m ago</span>
                  </div>
                  <p className="text-sm">Minor queue buildup at Food Court Central.</p>
                </div>
              </div>
            </div>

            {/* Staff Panel */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Staff Coordination</h3>
                <button
                  onClick={handleExportReport}
                  className="text-xs px-3 py-1.5 rounded-lg border border-accent/40 text-accent hover:bg-accent/10 transition-colors font-semibold"
                >
                  ↓ Export Report
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { role: 'Security', loc: 'Gate A, B, C, D', cnt: 4, icon: '👮' },
                  { role: 'Cleaning', loc: 'Food Court East', cnt: 2, icon: '🧹' },
                  { role: 'Medical', loc: 'First Aid Center', cnt: 1, icon: '🏥' },
                ].map((s, i) => (
                  <div key={i} className="flex justify-between items-center p-2 hover:bg-bg-secondary rounded transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="text-xl">{s.icon}</div>
                      <div>
                        <p className="text-sm font-bold">{s.role} <span className="text-text-secondary font-normal">({s.cnt})</span></p>
                        <p className="text-[10px] text-text-secondary">{s.loc}</p>
                      </div>
                    </div>
                    <button className="text-xs text-accent font-bold opacity-0 group-hover:opacity-100 transition-opacity">Deploy →</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ManagerDashboard;
