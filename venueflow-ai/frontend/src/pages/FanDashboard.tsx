import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { useSimulationStore } from '../stores/simulationStore';
import { useEventStore } from '../stores/eventStore';
import DensityBadge from '../components/DensityBadge';
import { getApiBaseUrl } from '../lib/runtime';

const getStoredToken = () => {
    const directToken = localStorage.getItem('venueflow-token');
    if (directToken) return directToken;

    const persistedAuth = localStorage.getItem('venueflow-auth');
    if (!persistedAuth) return null;

    try {
        const parsed = JSON.parse(persistedAuth);
        return parsed?.state?.token ?? null;
    } catch {
        return null;
    }
};

const FanDashboard: React.FC = () => {
    const { user } = useAuthStore();
    const { phase, zones, gates, totalFansInside } = useSimulationStore();
    const { fetchEvent } = useEventStore();
    
    // UI states
    const [ticket, setTicket] = useState<any>(null);
    const [chatMessages, setChatMessages] = useState<{id: string, sender: 'user'|'bot', text: string, isStreaming?: boolean}[]>([
      { id: '1', sender: 'bot', text: "Hi there! I'm FlowBot. The stadium is filling up quickly. Need to know the fastest food queue or where the nearest restrooms are?" }
    ]);
    const [chatInput, setChatInput] = useState('');
    const [isWaiting, setIsWaiting] = useState(false);
    const msgsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchEvent('event-ipl-2025-mi-csk');
        setTicket({
            id: 'tkt-123',
            eventName: 'IPL 2025: MI vs CSK',
            gate: 'Gate B',
            zone: 'North Stand',
            seat: 'Block E, Row 14, Seat 22',
            qrCode: 'mock-qr-code'
        });
    }, []);

    useEffect(() => {
      msgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages, isWaiting]);

    const myGate = gates.find(g => g.name === ticket?.gate);
    const foodEast = zones.find(z => z.zone_id === 'zone-food-court-east');
    
    const handleSendChat = async (text: string) => {
        if (!text.trim() || isWaiting) return;
        
        const userMsgId = Date.now().toString();
        const botMsgId = (Date.now() + 1).toString();
        
        setChatMessages(prev => [...prev, { id: userMsgId, sender: 'user', text }]);
        setChatInput('');
        setIsWaiting(true);
        setChatMessages(prev => [...prev, { id: botMsgId, sender: 'bot', text: '', isStreaming: true }]);

        try {
            const API_URL = getApiBaseUrl();
            const params = new URLSearchParams({ message: text });
            if (user?.id) params.append('fan_id', user.id);

            const response = await fetch(`${API_URL}/ai/chat/stream?${params.toString()}`, {
               headers: { 'Authorization': `Bearer ${getStoredToken()}` }
            });

            if (!response.body) throw new Error('No stream');
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let botText = '';

            while (true) {
               const { value, done } = await reader.read();
               if (done) break;
               const chunk = decoder.decode(value, { stream: true });
               const lines = chunk.split('\n\n');
               for (const line of lines) {
                   if (line.startsWith('data: ')) {
                       try {
                           const data = JSON.parse(line.substring(6));
                           if (data.token) {
                               botText += data.token;
                               setChatMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: botText } : m));
                           }
                       } catch (e) {}
                   }
               }
            }
            setChatMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: botText, isStreaming: false } : m));
        } catch (err) {
            setChatMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, text: "I'm having trouble connecting to the network right now.", isStreaming: false } : m));
        } finally {
            setIsWaiting(false);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
            {/* Top Welcome Banner */}
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="card bg-gradient-to-r from-[#111318] to-accent/20 border-accent/30 p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-text-primary mb-2">Welcome back, {user?.name || 'Fan'}! 👋</h1>
                  <p className="text-text-secondary">IPL Final starts in <span className="text-white font-bold">23 minutes</span>. Your seat <span className="text-accent-light font-bold">Block E, Row 14, Seat 22</span> is ready.</p>
                </div>
                <div className="flex gap-4">
                   <div className="bg-bg-card p-3 rounded-xl border border-border text-center min-w-[120px]">
                      <p className="text-xs text-text-secondary uppercase">Recommended Entry</p>
                      <p className="font-bold text-lg text-accent-light">{myGate?.name || 'Gate B'}</p>
                   </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-6">
                    
                    {/* Smart Journey Planner */}
                    <div className="card p-6">
                        <h3 className="font-bold text-xl mb-6">Smart Journey Planner</h3>
                        <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-0">
                           <div className="hidden md:block absolute top-[24px] left-[10%] right-[10%] h-[2px] bg-border z-0"></div>
                           
                           <div className="relative z-10 flex flex-col items-center flex-1">
                             <div className="w-12 h-12 rounded-full bg-success/20 border-2 border-success text-success flex items-center justify-center text-xl mb-2 backdrop-blur-sm">🚗</div>
                             <p className="font-bold text-sm">Arrive</p>
                             <p className="text-xs text-success">Done</p>
                           </div>
                           <div className="relative z-10 flex flex-col items-center flex-1">
                             <div className="w-12 h-12 rounded-full bg-accent/20 border-2 border-accent text-accent flex items-center justify-center text-xl mb-2 backdrop-blur-sm"><span className="live-dot"></span></div>
                             <p className="font-bold text-sm">{myGate?.name || 'Gate B'} Entry</p>
                             <p className="text-xs text-accent-light">{myGate ? myGate.wait_minutes : 2}m wait (Now)</p>
                           </div>
                           <div className="relative z-10 flex flex-col items-center flex-1">
                             <div className="w-12 h-12 rounded-full bg-bg-secondary border-2 border-border text-text-secondary flex items-center justify-center text-xl mb-2 backdrop-blur-sm opacity-50">🍔</div>
                             <p className="font-bold text-sm">Food Court</p>
                             <p className="text-xs text-text-secondary">Upcoming</p>
                           </div>
                           <div className="relative z-10 flex flex-col items-center flex-1">
                             <div className="w-12 h-12 rounded-full bg-bg-secondary border-2 border-border text-text-secondary flex items-center justify-center text-xl mb-2 backdrop-blur-sm opacity-50">💺</div>
                             <p className="font-bold text-sm">Seat E-14-22</p>
                             <p className="text-xs text-text-secondary">Upcoming</p>
                           </div>
                        </div>
                    </div>

                    {/* Live Alerts Feed & Match Countdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="card p-6 border-accent/20">
                            <h3 className="font-bold mb-4 flex items-center gap-2 text-lg">
                                <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                Live Alerts Feed
                            </h3>
                            <div className="space-y-3 h-[180px] overflow-y-auto pr-2">
                               <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex gap-3">
                                 <div className="text-warning mt-0.5">🟡</div>
                                 <p className="text-sm">Gate B congestion rising — consider Gate D for VIP access if applicable.</p>
                               </div>
                               <div className="p-3 rounded-lg bg-success/10 border border-success/30 flex gap-3">
                                 <div className="text-success mt-0.5">🟢</div>
                                 <p className="text-sm">East Food Court just opened — zero wait!</p>
                               </div>
                               <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 flex gap-3">
                                 <div className="text-danger mt-0.5">🔴</div>
                                 <p className="text-sm">Match starts in 23 min — grab food NOW to beat the rush.</p>
                               </div>
                            </div>
                        </div>

                        <div className="card p-6 bg-gradient-to-br from-bg-secondary to-bg-card flex flex-col items-center justify-center text-center">
                            <p className="text-text-secondary font-bold uppercase tracking-widest text-xs mb-2">Today's Match</p>
                            <h2 className="text-3xl font-black mb-1">MI vs CSK</h2>
                            <p className="text-text-secondary mb-4">Wankhede Stadium | 28°C, Clear</p>
                            
                            <div className="flex items-center gap-3">
                               <div className="w-16 h-16 rounded-xl bg-bg-primary border border-border flex flex-col justify-center items-center">
                                 <span className="text-xl font-mono font-bold">00</span>
                                 <span className="text-[10px] text-text-secondary uppercase">Hrs</span>
                               </div>
                               <span className="text-2xl font-bold">:</span>
                               <div className="w-16 h-16 rounded-xl bg-bg-primary border border-border flex flex-col justify-center items-center">
                                 <span className="text-xl font-mono font-bold">23</span>
                                 <span className="text-[10px] text-text-secondary uppercase">Min</span>
                               </div>
                               <span className="text-2xl font-bold">:</span>
                               <div className="w-16 h-16 rounded-xl bg-bg-primary border border-border flex flex-col justify-center items-center">
                                 <span className="text-xl font-mono font-bold text-accent">42</span>
                                 <span className="text-[10px] text-text-secondary uppercase">Sec</span>
                               </div>
                            </div>
                        </div>
                    </div>

                    {/* Venue Mini Map (Simplified) */}
                    <div className="card p-6">
                        <h3 className="font-bold text-xl mb-4">Venue Mini Map</h3>
                        <div className="w-full h-[250px] bg-[#0A0A0F] rounded-xl border border-border relative overflow-hidden flex items-center justify-center">
                           <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsIDI1NSwgMjU1LCAwLjEpIi8+PC9zdmc+')]"></div>
                           
                           {/* Abstract map layout */}
                           <svg viewBox="0 0 400 200" className="w-full h-full p-4 relative z-10">
                              {/* North Stand */}
                              <path d="M100,40 Q200,10 300,40 L280,70 Q200,40 120,70 Z" className="fill-bg-secondary stroke-border" />
                              <text x="200" y="55" fill="white" fontSize="10" textAnchor="middle">North Stand</text>
                              {/* South Stand */}
                              <path d="M100,160 Q200,190 300,160 L280,130 Q200,160 120,130 Z" className="fill-bg-secondary stroke-border" />
                              {/* Pitch */}
                              <rect x="150" y="80" width="100" height="40" className="fill-green-900/30 stroke-border" />
                              
                              {/* Gates */}
                              <circle cx="50" cy="50" r="10" className="fill-bg-secondary stroke-border" />
                              <text x="50" y="70" fill="gray" fontSize="8" textAnchor="middle">Gate B</text>
                              
                              <circle cx="350" cy="50" r="10" className="fill-bg-secondary stroke-border" />
                              
                              <circle cx="50" cy="150" r="10" className="fill-bg-secondary stroke-border" />
                              <text x="50" y="170" fill="gray" fontSize="8" textAnchor="middle">Gate A</text>
                              
                              {/* Amenities */}
                              <circle cx="280" cy="100" r="6" className="fill-accent2" />
                              <text x="280" y="115" fill="cyan" fontSize="8" textAnchor="middle">Food</text>

                              {/* Fan Location */}
                              <circle cx="180" cy="55" r="4" className="fill-accent stroke-white stroke-2 animate-bounce-subtle shadow-glow-indigo" />
                              <text x="180" y="45" fill="white" fontSize="8" textAnchor="middle" fontWeight="bold">You</text>
                              
                              {/* Pathing line */}
                              <path d="M50,50 L100,50 L180,55" className="stroke-accent stroke-2 fill-none stroke-dasharray-[4,4] animate-marquee" />
                           </svg>
                        </div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                    {/* Live Venue Pulse */}
                    <div className="card p-6 border-accent/20 bg-bg-card/50 backdrop-blur-md">
                        <h3 className="font-bold text-lg mb-6 flex items-center justify-between">
                           Live Venue Pulse
                           <span className="live-dot"></span>
                        </h3>
                        
                        <div className="space-y-4">
                           <div className="flex justify-between items-center border-b border-border pb-3">
                              <span className="text-text-secondary">Total Fans Inside</span>
                              <span className="font-mono font-bold text-xl">{totalFansInside.toLocaleString()}</span>
                           </div>
                           <div className="flex justify-between items-center border-b border-border pb-3">
                              <span className="text-text-secondary">Expected Wait (Gate B)</span>
                              <span className="font-mono font-bold text-xl text-success">{myGate?.wait_minutes || 0}m</span>
                           </div>
                           <div className="flex justify-between items-center border-b border-border pb-3">
                              <span className="text-text-secondary">Nearest Food Court</span>
                              <div className="text-right">
                                 <span className="font-mono font-bold text-warning">{foodEast?.wait_minutes || 5}m wait</span>
                                 <p className="text-[10px] text-text-secondary">East Concessions</p>
                              </div>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-text-secondary">Closest Washroom</span>
                              <span className="font-mono font-bold text-success">No wait</span>
                           </div>
                        </div>
                    </div>

                    {/* Reward Points */}
                    <div className="card p-6 bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-indigo-500/30">
                        <div className="flex justify-between items-start mb-4">
                           <h3 className="font-bold text-lg">VenueFlow Points</h3>
                           <div className="px-3 py-1 bg-amber-500/20 text-amber-500 font-bold rounded-full text-sm">340 ⭐</div>
                        </div>
                        <p className="text-sm text-text-secondary">You earn points for using smart routes! Redeem for free snacks at Gate B concession.</p>
                    </div>

                    {/* FlowBot Embedded Chat */}
                    <div className="card flex flex-col h-[400px] border-accent/30 overflow-hidden relative shadow-glow-indigo">
                        <div className="p-4 bg-bg-secondary border-b border-border flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold text-xs">FB</div>
                           <div>
                              <h3 className="font-bold text-sm">FlowBot AI</h3>
                              <p className="text-[10px] text-text-secondary">Your Personal Stadium Assistant</p>
                           </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg-primary">
                           {chatMessages.map((msg) => (
                              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                 <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${msg.sender === 'user' ? 'bg-accent text-white rounded-tr-sm' : 'bg-bg-secondary border border-border rounded-tl-sm'}`}>
                                     <span className={msg.isStreaming ? 'typing-cursor' : ''}>{msg.text}</span>
                                 </div>
                              </div>
                           ))}
                           {isWaiting && (
                                <div className="flex justify-start">
                                  <div className="bg-bg-secondary border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 bg-text-secondary rounded-full" />
                                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-text-secondary rounded-full" />
                                    <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-text-secondary rounded-full" />
                                  </div>
                                </div>
                            )}
                           <div ref={msgsEndRef} />
                        </div>

                        {/* Quick Prompts */}
                        {chatMessages.length === 1 && (
                            <div className="absolute bottom-16 left-0 right-0 px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                               <button onClick={() => handleSendChat("🚪 Best gate to enter now?")} className="flex-shrink-0 text-xs bg-bg-card border border-border hover:border-accent px-3 py-1.5 rounded-full whitespace-nowrap transition-colors">🚪 Best gate to enter now?</button>
                               <button onClick={() => handleSendChat("🍕 Shortest food queue?")} className="flex-shrink-0 text-xs bg-bg-card border border-border hover:border-accent px-3 py-1.5 rounded-full whitespace-nowrap transition-colors">🍕 Shortest food queue?</button>
                               <button onClick={() => handleSendChat("🚽 Nearest washroom?")} className="flex-shrink-0 text-xs bg-bg-card border border-border hover:border-accent px-3 py-1.5 rounded-full whitespace-nowrap transition-colors">🚽 Nearest washroom?</button>
                            </div>
                        )}

                        <div className="p-3 bg-bg-card border-t border-border">
                           <form onSubmit={(e) => { e.preventDefault(); handleSendChat(chatInput); }} className="flex gap-2">
                              <input type="text" placeholder="Ask FlowBot..." value={chatInput} onChange={e => setChatInput(e.target.value)} disabled={isWaiting} className="flex-1 input-field rounded-full py-2 px-4 text-sm" />
                              <button type="submit" disabled={!chatInput.trim() || isWaiting} className="w-9 h-9 rounded-full bg-accent hover:bg-accent-light text-white flex justify-center items-center disabled:opacity-50 transition-colors">
                                <svg className="w-4 h-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                              </button>
                           </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FanDashboard;
