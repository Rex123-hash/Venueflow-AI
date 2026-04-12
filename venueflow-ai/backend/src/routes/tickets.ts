import { Router, Response } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { MOCK_TICKET } from '../config/mockData';

const router = Router();

// GET /api/tickets/my
router.get('/my', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tickets = await prisma.ticket.findMany({
      where: { userId: req.user!.id },
      include: { event: { include: { venue: true } } },
    });
    if (tickets.length === 0 && req.user?.id === 'seed-fan-1') {
      res.json([MOCK_TICKET]);
      return;
    }
    res.json(tickets);
  } catch {
    res.json([MOCK_TICKET]);
  }
});

// POST /api/tickets/scan
router.post('/scan', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { qrCode } = req.body;
    const ticket = await prisma.ticket.update({
      where: { qrCode },
      data: { status: 'USED', scannedAt: new Date() },
    });
    res.json({ success: true, ticket });
  } catch {
    res.status(404).json({ error: 'Ticket not found or already scanned' });
  }
});

export default router;
