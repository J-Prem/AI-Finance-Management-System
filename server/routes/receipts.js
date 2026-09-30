import express from 'express';
import {
  uploadReceipt, listReceipts, getReceipt, getReceiptImage, deleteReceipt,
  overrideCategory, retag, stats,
} from '../controllers/receiptController.js';
import { authenticateJWTOrDemo } from '../middleware/authDemo.js';

const router = express.Router();

router.post('/upload', authenticateJWTOrDemo, uploadReceipt);
router.get('/stats', authenticateJWTOrDemo, stats);
router.get('/', authenticateJWTOrDemo, listReceipts);
router.get('/:id/image', authenticateJWTOrDemo, getReceiptImage);
router.get('/:id', authenticateJWTOrDemo, getReceipt);
router.delete('/:id', authenticateJWTOrDemo, deleteReceipt);
router.patch('/:id/category', authenticateJWTOrDemo, overrideCategory);
router.post('/:id/retag', authenticateJWTOrDemo, retag);

export default router;
