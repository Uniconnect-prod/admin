import { Router } from 'express';
import { countryController } from '../controllers/countryController.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/roleGuard.js';

const router = Router();

router.use(authenticate);

router.get('/', countryController.getAllCountries);
router.get('/:id', countryController.getCountryById);
router.post('/', requireSuperAdmin, countryController.createCountry);
router.put('/:id', requireSuperAdmin, countryController.updateCountry);
router.delete('/:id', requireSuperAdmin, countryController.deleteCountry);

export default router;
