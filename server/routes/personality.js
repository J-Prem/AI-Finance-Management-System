import express from 'express';
import { analyze, history, latest } from '../controllers/personalityController.js';
import { authenticateJWTOrDemo } from '../middleware/authDemo.js';

const router = express.Router();

router.post('/analyze', authenticateJWTOrDemo, analyze);
router.get('/history', authenticateJWTOrDemo, history);
router.get('/latest', authenticateJWTOrDemo, latest);

export default router;
