import { Router } from 'express';
import { quizController } from '../controllers/quizController.js';
import { authenticate } from '../middleware/auth.js';
import { requirePlatform } from '../middleware/platformGuard.js';
import { requireRole } from '../middleware/roleGuard.js';

const router = Router();

router.use(authenticate);
router.use(requirePlatform);

router.get('/', quizController.getQuizzes);
router.get('/:id', quizController.getQuizById);
router.post('/', requireRole('Super Admin', 'Platform Admin', 'Author'), quizController.createQuiz);
router.put('/:id', requireRole('Super Admin', 'Platform Admin', 'Author'), quizController.updateQuiz);
router.delete('/:id', requireRole('Super Admin', 'Platform Admin'), quizController.deleteQuiz);
router.post('/import', requireRole('Super Admin', 'Platform Admin', 'Author'), quizController.importQuestions);

export default router;

