import express from 'express';
import { globalSearch } from '../controllers/searchController.js';
import { authenticateJWTOrDemo } from '../middleware/authDemo.js';

const router = express.Router();

router.get('/', authenticateJWTOrDemo, globalSearch);

export default router;
