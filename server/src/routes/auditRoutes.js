import { Router } from 'express';
import { auditController } from '../controllers/auditController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatform } from '../middleware/platformGuard.js';
import { requireRole } from '../middleware/roleGuard.js';

const router = Router();

router.use(authenticate);
router.use(requirePlatform);
router.use(requireRole('Super Admin', 'Platform Admin'));

router.get('/', auditController.getAuditLogs);

export default router;

