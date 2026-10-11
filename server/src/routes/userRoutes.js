import { Router } from 'express';
import { userController } from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole, requireSuperAdmin } from '../middleware/roleGuard.js';

const router = Router();

router.use(authenticate);

router.get('/roles', userController.getRoles);
router.get('/', requireRole('Super Admin', 'Platform Admin'), userController.getAllUsers);
router.get('/:id', requireRole('Super Admin', 'Platform Admin'), userController.getUserById);

// Admin-Only User Management (Section 7 requirement: Platform users cannot create, delete, edit, or assign)
router.post('/', requireSuperAdmin, userController.createUser);
router.put('/:id', requireSuperAdmin, userController.updateUser);
router.put('/:id/reset-password', requireSuperAdmin, userController.resetPassword);
router.delete('/:id', requireSuperAdmin, userController.deleteUser);

export default router;

