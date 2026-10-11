import { Router } from 'express';
import { renewalController } from '../controllers/renewalController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatform } from '../middleware/platformGuard.js';

const router = Router();

router.use(authenticate);
router.use(requirePlatform);

router.get('/', renewalController.getRenewalMetrics);

export default router;

