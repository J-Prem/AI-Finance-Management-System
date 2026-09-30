import Team from '../models/Team.js';
import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendTeamInvitationEmail } from '../services/emailService.js';
import logger from '../utils/logger.js';

/**
 * Create team
 */
export const createTeam = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  const team = await Team.create({
    name,
    description,
    owner: req.user._id,
    members: [
      {
        userId: req.user._id,
        email: req.user.email,
        role: 'owner',
      },
    ],
  });

  // Update user with team ID
  await User.findByIdAndUpdate(req.user._id, { teamId: team._id });

  res.status(201).json({
    success: true,
    message: 'Team created successfully',
    data: { team },
  });
});

/**
 * Get teams
 */
export const getTeams = asyncHandler(async (req, res) => {
  const teams = await Team.find({
    $or: [
      { owner: req.user._id },
      { 'members.userId': req.user._id },
    ],
  }).populate('members.userId', 'email name');

  res.json({
    success: true,
    data: { teams },
  });
});

/**
 * Get team
 */
export const getTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id).populate('members.userId', 'email name');

  if (!team) {
    return res.status(404).json({
      success: false,
      message: 'Team not found',
    });
  }

  // Check if user is member
  const isMember = team.members.some((m) => m.userId.toString() === req.user._id.toString());
  if (!isMember && team.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  res.json({
    success: true,
    data: { team },
  });
});

/**
 * Update team
 */
export const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    return res.status(404).json({
      success: false,
      message: 'Team not found',
    });
  }

  if (team.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Only team owner can update team',
    });
  }

  Object.assign(team, req.body);
  await team.save();

  res.json({
    success: true,
    message: 'Team updated successfully',
    data: { team },
  });
});

/**
 * Invite member
 */
export const inviteMember = asyncHandler(async (req, res) => {
  const { email, role } = req.body;

  const team = await Team.findById(req.params.id);

  if (!team) {
    return res.status(404).json({
      success: false,
      message: 'Team not found',
    });
  }

  if (team.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Only team owner can invite members',
    });
  }

  try {
    team.createInvitation(email, role);
    await team.save();

    // Send invitation email
    const inviteRecord = team.invitations[team.invitations.length - 1];
    try {
      await sendTeamInvitationEmail(email, team, inviteRecord.inviteCode);
    } catch (error) {
      logger.error('Failed to send team invitation email:', error);
    }

    res.json({
      success: true,
      message: 'Invitation sent successfully',
      data: { invitation: inviteRecord },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Accept invitation
 *
 * Accepts either `inviteCode` or `token` in the body — the client and
 * the email link use slightly different parameter names.
 */
export const acceptInvitation = asyncHandler(async (req, res) => {
  const inviteCode = req.body?.inviteCode || req.body?.token || req.query?.token;
  if (!inviteCode) {
    return res.status(400).json({ success: false, message: 'Invitation code is required' });
  }

  const team = await Team.findOne({ 'invitations.inviteCode': inviteCode });

  if (!team) {
    return res.status(404).json({
      success: false,
      message: 'Invalid invitation code',
    });
  }

  try {
    team.acceptInvitation(inviteCode, req.user._id, req.user.email);
    await team.save();

    // Update user with team ID
    await User.findByIdAndUpdate(req.user._id, { teamId: team._id });

    res.json({
      success: true,
      message: 'Invitation accepted',
      data: { team },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Remove member
 *
 * Accepts either `userId` or `memberId` in the body to match the
 * client's payload shape (TeamPage sends `memberId`).
 */
export const removeMember = asyncHandler(async (req, res) => {
  const userId = req.body?.userId || req.body?.memberId;
  if (!userId) {
    return res.status(400).json({ success: false, message: 'memberId is required' });
  }

  const team = await Team.findById(req.params.id);

  if (!team) {
    return res.status(404).json({
      success: false,
      message: 'Team not found',
    });
  }

  if (team.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Only team owner can remove members',
    });
  }

  try {
    team.removeMember(userId);
    await team.save();

    res.json({
      success: true,
      message: 'Member removed successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Update member role
 *
 * Accepts either `userId` or `memberId` in the body to match the
 * client's payload shape (TeamPage sends `memberId`).
 */
export const updateMemberRole = asyncHandler(async (req, res) => {
  const userId = req.body?.userId || req.body?.memberId;
  const { role } = req.body || {};
  if (!userId || !role) {
    return res.status(400).json({ success: false, message: 'memberId and role are required' });
  }

  const team = await Team.findById(req.params.id);

  if (!team) {
    return res.status(404).json({
      success: false,
      message: 'Team not found',
    });
  }

  if (team.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Only team owner can update member roles',
    });
  }

  try {
    team.updateMemberRole(userId, role);
    await team.save();

    res.json({
      success: true,
      message: 'Member role updated successfully',
      data: { team },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * Get team analytics
 */
export const getTeamAnalytics = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    return res.status(404).json({
      success: false,
      message: 'Team not found',
    });
  }

  // Check if user has permission
  const member = team.members.find((m) => m.userId.toString() === req.user._id.toString());
  if (!member && team.owner.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'Unauthorized',
    });
  }

  res.json({
    success: true,
    data: {
      analytics: {
        members: team.members.length,
        invitations: team.invitations.filter((i) => i.status === 'pending').length,
      },
    },
  });
});

/**
 * Leave team
 */
export const leaveTeam = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.id);

  if (!team) {
    return res.status(404).json({
      success: false,
      message: 'Team not found',
    });
  }

  if (team.owner.toString() === req.user._id.toString()) {
    return res.status(400).json({
      success: false,
      message: 'Team owner cannot leave team',
    });
  }

  team.removeMember(req.user._id);
  await team.save();

  // Remove team from user
  await User.findByIdAndUpdate(req.user._id, { teamId: null });

  res.json({
    success: true,
    message: 'Left team successfully',
  });
});
