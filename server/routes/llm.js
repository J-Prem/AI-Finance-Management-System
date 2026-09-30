import express from 'express';
import { chat, providers, diagnostics } from '../controllers/llmController.js';
import { authenticateJWTOrDemo } from '../middleware/authDemo.js';

const router = express.Router();

router.post('/chat', authenticateJWTOrDemo, chat);
router.get('/providers', providers);
router.get('/diagnostics', diagnostics);

export default router;
