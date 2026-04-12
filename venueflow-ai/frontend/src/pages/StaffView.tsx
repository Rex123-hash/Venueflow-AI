import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSimulationStore } from '../stores/simulationStore';
import { useEventStore } from '../stores/eventStore';

const StaffView: React.FC = () => {
    const { user } = useAuthStore();
    const { phase, zones, gates, surgeZoneId } = useSimulationStore();
    const [assignment, setAssignment] = useState<any>(null);

    useEffect(() => {
        // Mock API call to get staff assignment
        setAssignment({
            zoneId: 'zone-north',
            zoneName: 'North Stand',
            task: 'Crowd Flow Management',
            shiftEnd: '23:30',
        });
    }, []);

    const myZoneLive = zones.find(z => z.zone_id === assignment?.zoneId);
    
    // Suggestion logic based on local state vs assignment
    const requiresAction = surgeZoneId === assignment?.zoneId || (myZoneLive && myZoneLive.density_level === 'CRITICAL');

    return (
        <div className="max-w-md mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Staff Terminal</h1>
            
            <div className={`card overflow-hidden mb-6 ${requiresAction ? 'border-danger shadow-glow-red' : ''}`}>
                <div className={`p-4 text-white text-center font-bold text-lg uppercase tracking-widest ${requiresAction ? 'bg-danger animate-pulse' : 'bg-gradient-to-r from-accent to-accent2'}`}>
                   {requiresAction ? '! IMMEDIATE ASSISTANCE REQ !' : 'Active Duty'}
                </div>
                
                <div className="p-6">
                    <p className="text-sm text-text-secondary mb-1">Your Post</p>
                    <h2 className="text-3xl font-black text-text-primary mb-6">{assignment?.zoneName}</h2>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-bg-secondary p-3 rounded-lg text-center border border-border">
                            <p className="text-xs text-text-secondary">Current Density</p>
                            <p className={`font-bold mt-1 max-w-full ${myZoneLive?.density_level === 'CRITICAL' ? 'text-danger' : 'text-success'}`}>{myZoneLive?.density_level || 'LOW'}</p>
                        </div>
                        <div className="bg-bg-secondary p-3 rounded-lg text-center border border-border">
                            <p className="text-xs text-text-secondary">Headcount</p>
                            <p className="font-bold mt-1 text-text-primary">{myZoneLive?.count || 0}</p>
                        </div>
                    </div>
                </div>
            </div>

            <h3 className="font-bold text-lg mb-4">Directives</h3>
            <div className="space-y-4">
                {requiresAction ? (
                    <div className="card p-4 border-danger/30 bg-danger/10">
                        <p className="font-bold text-danger mb-2">CRITICAL: Flow Control Required</p>
                        <p className="text-sm text-text-primary">Density has reached critical levels. Initiate slow-stream protocol at vomitories. Prepare to redirect fans to Concourse B.</p>
                        <button className="mt-4 w-full bg-danger text-white py-2 rounded-lg font-bold">
                            Acknowledge Directive
                        </button>
                    </div>
                ) : (
                    <div className="card p-4 bg-bg-secondary">
                        <p className="font-bold mb-2 text-text-primary">Routine Check</p>
                        <p className="text-sm text-text-secondary">Monitor aisles 4-8. Ensure clear pathways. Density is normal.</p>
                    </div>
                )}
                
                <div className="card p-4">
                    <p className="font-bold mb-3 text-text-primary">Report Incident</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button className="bg-bg-secondary border border-border py-2 px-3 rounded text-sm hover:border-text-secondary">Spill / Clean</button>
                        <button className="bg-bg-secondary border border-border py-2 px-3 rounded text-sm hover:border-text-secondary">Medical</button>
                        <button className="bg-bg-secondary border border-border py-2 px-3 rounded text-sm hover:border-text-secondary">Dispute</button>
                        <button className="bg-bg-secondary border border-border py-2 px-3 rounded text-sm hover:border-text-secondary line-through opacity-50">Other</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StaffView;
