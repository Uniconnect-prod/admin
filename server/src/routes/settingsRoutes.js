import { Router } from 'express';
import { settingsController } from '../controllers/settingsController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', settingsController.getSettings);
router.put('/profile', settingsController.updateProfile);
router.put('/security', settingsController.updateSecurity);

export default router;

