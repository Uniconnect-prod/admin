import { Router } from 'express';
import authRoutes from './authRoutes.js';
import platformRoutes from './platformRoutes.js';
import platformManagementRoutes from './platformManagementRoutes.js';
import userRoutes from './userRoutes.js';
import subscriberRoutes from './subscriberRoutes.js';
import renewalRoutes from './renewalRoutes.js';
import churnRoutes from './churnRoutes.js';
import reportRoutes from './reportRoutes.js';
import quizRoutes from './quizRoutes.js';
import auditRoutes from './auditRoutes.js';
import exportRoutes from './exportRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import countryRoutes from './countryRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/platforms', platformRoutes);
router.use('/platform-management', platformManagementRoutes);
router.use('/users', userRoutes);
router.use('/countries', countryRoutes);
router.use('/subscribers', subscriberRoutes);
router.use('/renewals', renewalRoutes);
router.use('/churn', churnRoutes);
router.use('/reports', reportRoutes);
router.use('/quizzes', quizRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/export', exportRoutes);
router.use('/settings', settingsRoutes);

router.get('/health', (req, res) => {
  res.status(200).json({ status: 'HEALTHY', timestamp: new Date().toISOString() });
});

export default router;

