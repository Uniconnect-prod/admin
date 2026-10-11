import { Router } from 'express';
import { exportController } from '../controllers/exportController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatform } from '../middleware/platformGuard.js';
import { requireRole } from '../middleware/roleGuard.js';

const router = Router();

router.use(authenticate);
router.use(requirePlatform);
router.use(requireRole('Super Admin', 'Platform Admin', 'Analyst'));

router.get('/subscribers', exportController.exportSubscribers);
router.get('/renewals', exportController.exportRenewals);
router.get('/churn', exportController.exportChurn);

export default router;

