import express from 'express';
import * as teamController from '../controllers/teamController.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateJWT);

/**
 * @route POST /api/teams
 * @desc Create team
 * @access Private
 */
router.post('/', teamController.createTeam);

/**
 * @route GET /api/teams
 * @desc Get user's teams
 * @access Private
 */
router.get('/', teamController.getTeams);

/**
 * @route GET /api/teams/:id
 * @desc Get single team
 * @access Private
 */
router.get('/:id', teamController.getTeam);

/**
 * @route PATCH /api/teams/:id
 * @desc Update team
 * @access Private
 */
router.patch('/:id', teamController.updateTeam);

/**
 * @route POST /api/teams/:id/invite
 * @desc Invite member
 * @access Private
 */
router.post('/:id/invite', teamController.inviteMember);

/**
 * @route POST /api/teams/:id/accept-invitation
 * @desc Accept invitation
 * @access Private
 */
router.post('/:id/accept-invitation', teamController.acceptInvitation);

/**
 * @route POST /api/teams/:id/remove-member
 * @desc Remove member
 * @access Private
 */
router.post('/:id/remove-member', teamController.removeMember);

/**
 * @route POST /api/teams/:id/update-member-role
 * @desc Update member role
 * @access Private
 */
router.post('/:id/update-member-role', teamController.updateMemberRole);

/**
 * @route GET /api/teams/:id/analytics
 * @desc Get team analytics
 * @access Private
 */
router.get('/:id/analytics', teamController.getTeamAnalytics);

/**
 * @route POST /api/teams/:id/leave
 * @desc Leave team
 * @access Private
 */
router.post('/:id/leave', teamController.leaveTeam);

export default router;
