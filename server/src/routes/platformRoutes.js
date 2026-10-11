import { Router } from 'express';
import { platformController } from '../controllers/platformController.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/roleGuard.js';

const router = Router();

// Public showcase route for login page slideshow carousel (no auth required)
router.get('/showcase', platformController.getPublicShowcase);

router.use(authenticate);

router.get('/', platformController.getAllPlatforms);
router.get('/:id', platformController.getPlatformById);
router.post('/', requireSuperAdmin, platformController.createPlatform);
router.put('/:id', requireSuperAdmin, platformController.updatePlatform);
router.delete('/:id', requireSuperAdmin, platformController.deletePlatform);

export default router;

