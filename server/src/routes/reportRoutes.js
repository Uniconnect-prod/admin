import { Router } from 'express';
import { reportController } from '../controllers/reportController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatform } from '../middleware/platformGuard.js';

const router = Router();

router.use(authenticate);
router.use(requirePlatform);

router.get('/overview', reportController.getOverview);
router.get('/revenue', reportController.getRevenueReport);
router.get('/growth', reportController.getGrowthReport);
router.get('/platform-comparison', reportController.getPlatformComparison);
router.get('/subscription-business-report', reportController.getSubscriptionBusinessReport);

export default router;

