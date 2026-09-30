import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { TEAM_MEMBER_ROLES } from '../config/constants.js';

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
    },
    members: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true,
        },
        email: String,
        role: {
          type: String,
          enum: Object.values(TEAM_MEMBER_ROLES),
          default: TEAM_MEMBER_ROLES.MEMBER,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        permissions: {
          canViewTransactions: { type: Boolean, default: true },
          canAddTransactions: { type: Boolean, default: true },
          canEditTransactions: { type: Boolean, default: false },
          canDeleteTransactions: { type: Boolean, default: false },
          canViewAnalytics: { type: Boolean, default: true },
          canManageBudgets: { type: Boolean, default: false },
          canManageMembers: { type: Boolean, default: false },
          canManageSettings: { type: Boolean, default: false },
        },
      },
    ],
    invitations: [
      {
        email: {
          type: String,
          required: true,
        },
        inviteCode: {
          type: String,
          required: true,
          unique: true,
        },
        role: {
          type: String,
          enum: Object.values(TEAM_MEMBER_ROLES),
          default: TEAM_MEMBER_ROLES.MEMBER,
        },
        invitedAt: {
          type: Date,
          default: Date.now,
        },
        expiresAt: {
          type: Date,
          default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
        status: {
          type: String,
          enum: ['pending', 'accepted', 'rejected', 'expired'],
          default: 'pending',
        },
      },
    ],
    sharedBudgets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Budget',
      },
    ],
    subscription: {
      tier: {
        type: String,
        enum: ['FREE', 'PRO', 'ENTERPRISE'],
        default: 'FREE',
      },
      stripeCustomerId: String,
      stripeSubscriptionId: String,
      status: {
        type: String,
        enum: ['active', 'inactive', 'cancelled'],
        default: 'inactive',
      },
    },
    settings: {
      currency: {
        type: String,
        default: 'USD',
      },
      timezone: {
        type: String,
        default: 'UTC',
      },
      language: {
        type: String,
        default: 'en',
      },
      allowPublicReports: {
        type: Boolean,
        default: false,
      },
      requireApprovalForTransactions: {
        type: Boolean,
        default: false,
      },
    },
    avatar: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
teamSchema.index({ owner: 1 });
teamSchema.index({ 'members.userId': 1 });
teamSchema.index({ 'invitations.email': 1 });
teamSchema.index({ createdAt: 1 });

// Virtual for member count
teamSchema.virtual('memberCount').get(function () {
  return this.members.length;
});

// Virtual for pending invitations
teamSchema.virtual('pendingInvitationCount').get(function () {
  return this.invitations.filter((inv) => inv.status === 'pending').length;
});

// Method to add member
teamSchema.methods.addMember = function (userId, email, role = TEAM_MEMBER_ROLES.MEMBER) {
  const existingMember = this.members.find((m) => m.userId.toString() === userId.toString());
  if (existingMember) {
    throw new Error('User already a member of this team');
  }

  this.members.push({
    userId,
    email,
    role,
  });
  return this;
};

// Method to remove member
teamSchema.methods.removeMember = function (userId) {
  this.members = this.members.filter((m) => m.userId.toString() !== userId.toString());
  return this;
};

// Method to update member role
teamSchema.methods.updateMemberRole = function (userId, newRole) {
  const member = this.members.find((m) => m.userId.toString() === userId.toString());
  if (!member) {
    throw new Error('Member not found');
  }
  member.role = newRole;
  return this;
};

// Method to update member permissions
teamSchema.methods.updateMemberPermissions = function (userId, permissions) {
  const member = this.members.find((m) => m.userId.toString() === userId.toString());
  if (!member) {
    throw new Error('Member not found');
  }
  Object.assign(member.permissions, permissions);
  return this;
};

// Method to check member permission
teamSchema.methods.hasPermission = function (userId, permission) {
  const member = this.members.find((m) => m.userId.toString() === userId.toString());
  if (!member) return false;

  // Owners and admins have all permissions
  if ([TEAM_MEMBER_ROLES.OWNER, TEAM_MEMBER_ROLES.ADMIN].includes(member.role)) {
    return true;
  }

  return member.permissions[permission] || false;
};

// Method to create invitation
teamSchema.methods.createInvitation = function (email, role = TEAM_MEMBER_ROLES.MEMBER) {
  // Check if already invited or member
  const existingInvitation = this.invitations.find((inv) => inv.email === email);
  if (existingInvitation && existingInvitation.status === 'pending') {
    throw new Error('Invitation already pending for this email');
  }

  const existingMember = this.members.find((m) => m.email === email);
  if (existingMember) {
    throw new Error('User is already a member of this team');
  }

  this.invitations.push({
    email,
    inviteCode: uuidv4(),
    role,
    status: 'pending',
  });

  return this;
};

// Method to accept invitation
teamSchema.methods.acceptInvitation = function (inviteCode, userId, email) {
  const invitation = this.invitations.find((inv) => inv.inviteCode === inviteCode);
  if (!invitation) {
    throw new Error('Invitation not found');
  }

  if (invitation.status !== 'pending') {
    throw new Error('Invitation is no longer valid');
  }

  if (new Date() > invitation.expiresAt) {
    invitation.status = 'expired';
    throw new Error('Invitation has expired');
  }

  // Add member
  this.addMember(userId, email, invitation.role);

  // Mark invitation as accepted
  invitation.status = 'accepted';

  return this;
};

// Method to get member by user ID
teamSchema.methods.getMember = function (userId) {
  return this.members.find((m) => m.userId.toString() === userId.toString());
};

// Statics for common queries
teamSchema.statics.findByOwner = function (ownerId) {
  return this.find({ owner: ownerId });
};

teamSchema.statics.findByMember = function (userId) {
  return this.find({ 'members.userId': userId });
};

export default mongoose.model('Team', teamSchema);
