import express from 'express';
import * as apiKeyController from '../controllers/apiKeyController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

/**
 * @route POST /api/api-keys
 * @desc Generate API key
 * @access Private
 */
router.post('/', apiKeyController.generateKey);

/**
 * @route GET /api/api-keys
 * @desc List API keys
 * @access Private
 */
router.get('/', apiKeyController.listKeys);

/**
 * @route GET /api/api-keys/:id
 * @desc Get single API key
 * @access Private
 */
router.get('/:id', apiKeyController.getKey);

/**
 * @route PATCH /api/api-keys/:id
 * @desc Update API key
 * @access Private
 */
router.patch('/:id', apiKeyController.updateKey);

/**
 * @route POST /api/api-keys/:id/revoke
 * @desc Revoke API key
 * @access Private
 */
router.post('/:id/revoke', apiKeyController.revokeKey);

/**
 * @route POST /api/api-keys/:id/rotate
 * @desc Rotate API key
 * @access Private
 */
router.post('/:id/rotate', apiKeyController.rotateKey);

/**
 * @route DELETE /api/api-keys/:id
 * @desc Delete API key
 * @access Private
 */
router.delete('/:id', apiKeyController.deleteKey);

/**
 * @route POST /api/api-keys/:id/permissions
 * @desc Add permission
 * @access Private
 */
router.post('/:id/permissions', apiKeyController.addPermission);

/**
 * @route DELETE /api/api-keys/:id/permissions
 * @desc Remove permission
 * @access Private
 */
router.delete('/:id/permissions', apiKeyController.removePermission);

/**
 * @route GET /api/api-keys/:id/usage
 * @desc Get API key usage
 * @access Private
 */
router.get('/:id/usage', apiKeyController.getKeyUsage);

export default router;
