import { Router } from 'express';
import { subscriberController } from '../controllers/subscriberController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatform } from '../middleware/platformGuard.js';

const router = Router();

router.use(authenticate);
router.use(requirePlatform);

router.get('/', subscriberController.getSubscribers);
router.get('/:id', subscriberController.getSubscriberById);

export default router;

