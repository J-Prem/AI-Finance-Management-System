import express from 'express';
import { snapshot, health } from '../controllers/monitoringController.js';
import { authenticateJWTOrDemo } from '../middleware/authDemo.js';

const router = express.Router();

router.get('/snapshot', authenticateJWTOrDemo, snapshot);
router.get('/health', health);

export default router;
