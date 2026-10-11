import { Router } from 'express';
import { platformManagementController } from '../controllers/platformManagementController.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/roleGuard.js';

const router = Router();

// Strictly guard all platform management routes for authenticated Super Admins
router.use(authenticate, requireSuperAdmin);

// Platform Collection Operations
router.get('/', platformManagementController.getAll);
router.post('/', platformManagementController.create);

// Standalone Connection & Discovery (useful before platform is saved)
router.post('/test-connection', platformManagementController.testConnection);
router.post('/discover-schema', platformManagementController.discoverSchema);

// Platform-specific Operations
router.get('/:id', platformManagementController.getById);
router.put('/:id', platformManagementController.update);
router.delete('/:id', platformManagementController.delete);

router.post('/:id/test-connection', platformManagementController.testConnection);
router.post('/:id/discover-schema', platformManagementController.discoverSchema);
router.get('/:id/collections', platformManagementController.getCollections);

router.put('/:id/mappings', platformManagementController.updateMappings);
router.put('/:id/offers', platformManagementController.updateOffers);
router.post('/:id/validate', platformManagementController.validate);
router.post('/:id/activate', platformManagementController.activate);
router.post('/:id/disable', platformManagementController.disable);

export default router;
