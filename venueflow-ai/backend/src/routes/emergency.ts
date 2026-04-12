import { Router, Response } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { prisma } from '../lib/prisma';
import { getSimulationEngine } from '../services/SimulationEngine';
import { generateEmergencyAnnouncement } from '../services/gemini';
import { getNearestExits } from '../config/venueMap';
import { Server as SocketServer } from 'socket.io';
import { SEED_EVENT_ID } from '../config/mockData';

const router = Router();
let io: SocketServer | null = null;

export function attachSocketToEmergency(socketServer: SocketServer): void {
  io = socketServer;
}

// POST /api/emergency/trigger
router.post('/trigger', authenticate, requireRole('MANAGER', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { zone_id, event_id } = req.body;
    const eventId = event_id || SEED_EVENT_ID;
    const managerId = (req as any).user?.id || 'unknown';

    // Get zone info
    const exits = getNearestExits(zone_id);
    const exit1 = exits[0] || 'Gate A Exit';
    const exit2 = exits[1] || 'Gate B Exit';

    // Find zone name
    let zoneName = zone_id.replace('zone-', '').replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    try {
      const engine = getSimulationEngine();
      const state = engine.getState();
      const zone = state.zones.find(z => z.id === zone_id);
      if (zone) zoneName = zone.name;
    } catch { /* use formatted id */ }

    // Generate AI announcement
    const announcement = await generateEmergencyAnnouncement(zoneName, exit1, exit2);

    // Update DB
    try {
      await prisma.event.update({
        where: { id: eventId },
        data: { emergencyActive: true },
      });

      await prisma.alert.create({
        data: {
          eventId,
          zoneId: zone_id,
          zoneName,
          severity: 'CRITICAL',
          message: `EMERGENCY EVACUATION: ${zoneName} — ${announcement}`,
          aiGenerated: true,
        },
      });
    } catch { /* DB unavailable */ }

    // Emit to ALL rooms (fans + managers)
    if (io) {
      io.emit('emergency_alert', {
        active: true,
        zone_id,
        zone_name: zoneName,
        exit_1: exit1,
        exit_2: exit2,
        announcement,
        triggered_by: managerId,
        triggered_at: new Date().toISOString(),
        message: `URGENT: Please follow the green arrows to ${exit1}. Stay calm and move steadily.`,
      });
    }

    console.log(`[Emergency] TRIGGERED by ${managerId} for zone: ${zoneName}`);

    res.json({
      success: true,
      announcement,
      zone_name: zoneName,
      exits: [exit1, exit2],
      triggered_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Emergency] Trigger error:', err.message);
    res.status(500).json({ error: 'Failed to trigger emergency' });
  }
});

// POST /api/emergency/clear
router.post('/clear', authenticate, requireRole('MANAGER', 'ADMIN'), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { event_id } = req.body;
    const eventId = event_id || SEED_EVENT_ID;

    // Update DB
    try {
      await prisma.event.update({
        where: { id: eventId },
        data: { emergencyActive: false },
      });
    } catch { /* DB unavailable */ }

    // Emit clear to ALL
    if (io) {
      io.emit('emergency_clear', {
        active: false,
        cleared_by: (req as any).user?.id,
        cleared_at: new Date().toISOString(),
      });
    }

    console.log(`[Emergency] CLEARED by ${(req as any).user?.id}`);

    res.json({ success: true, cleared_at: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to clear emergency' });
  }
});

export default router;
