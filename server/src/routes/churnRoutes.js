import { Router } from 'express';
import { churnController } from '../controllers/churnController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatform } from '../middleware/platformGuard.js';

const router = Router();

router.use(authenticate);
router.use(requirePlatform);

router.get('/', churnController.getChurnMetrics);

export default router;

