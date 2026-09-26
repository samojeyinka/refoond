import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import refundsRoutes from '../modules/refunds/refunds.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', version: 'v1', uptime: process.uptime() } });
});

router.use('/auth', authRoutes);
router.use('/refunds', refundsRoutes);

export default router;
