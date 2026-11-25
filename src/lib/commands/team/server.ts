import { z } from 'zod';
import {
  acceptCollectionInviteInputSchema,
  collectionIdSchema,
  collectionMemberUserIdSchema,
  createCollectionInviteInputSchema,
  transferCollectionOwnershipInputSchema,
  updateCollectionMemberInputSchema,
} from '@/lib/collections/api';
import {
  acceptCollectionInvite,
  changeCollectionMemberRole,
  createCollectionInvite,
  getCollectionTeam,
  removeCollectionMember,
  revokeCollectionInvite,
  transferCollectionOwnership,
} from '@/lib/collections/teamRepository';
import { collectionTarget, defineCommand, noTarget } from '../command';

/**
 * Team commands: who can see and edit a collection. These change access, so
 * they are not exposed as agent tools; sharing stays a deliberate, in-app
 * action by the user.
 */

const inviteTarget = z.object({
  collectionId: collectionIdSchema,
  inviteId: collectionIdSchema,
});

const memberTarget = z.object({
  collectionId: collectionIdSchema,
  memberUserId: collectionMemberUserIdSchema,
});

export const getTeamCommand = defineCommand({
  name: 'team.get',
  description:
    "List a collection's members, open invites and recent team activity.",
  annotations: { readOnly: true },
  target: collectionTarget,
  run: ({ userId }, { collectionId }) =>
    getCollectionTeam(userId, collectionId),
});

export const createInviteCommand = defineCommand({
  name: 'team.invites.create',
  description: 'Create an invite link that adds people as editors or viewers.',
  annotations: {},
  target: collectionTarget,
  input: createCollectionInviteInputSchema,
  run: ({ userId }, { collectionId }, input) =>
    createCollectionInvite(userId, collectionId, input),
});

export const revokeInviteCommand = defineCommand({
  name: 'team.invites.revoke',
  description: 'Revoke an invite link so it can no longer be used.',
  annotations: { destructive: true },
  target: inviteTarget,
  run: ({ userId }, { collectionId, inviteId }) =>
    revokeCollectionInvite(userId, collectionId, inviteId),
});

export const acceptInviteCommand = defineCommand({
  name: 'team.invites.accept',
  description: 'Join a collection with an invite token.',
  annotations: {},
  target: noTarget,
  input: acceptCollectionInviteInputSchema,
  // The invite page shows a specific message for this code.
  failures: {
    not_found: {
      status: 404,
      body: {
        error: 'Invite is invalid or no longer available',
        code: 'invite_unavailable',
      },
    },
  },
  run: ({ userId }, _target, { token }) =>
    acceptCollectionInvite(userId, token),
});

export const changeMemberRoleCommand = defineCommand({
  name: 'team.members.update',
  description: "Change a member's role between editor and viewer.",
  annotations: {},
  target: memberTarget,
  input: updateCollectionMemberInputSchema,
  run: ({ userId }, { collectionId, memberUserId }, { role }) =>
    changeCollectionMemberRole(userId, collectionId, memberUserId, role),
});

export const removeMemberCommand = defineCommand({
  name: 'team.members.remove',
  description: "Remove a member's access to a collection.",
  annotations: { destructive: true },
  target: memberTarget,
  run: ({ userId }, { collectionId, memberUserId }) =>
    removeCollectionMember(userId, collectionId, memberUserId),
});

export const transferOwnershipCommand = defineCommand({
  name: 'team.transfer-ownership',
  description: 'Make another member the owner of a collection.',
  annotations: { destructive: true },
  target: collectionTarget,
  input: transferCollectionOwnershipInputSchema,
  run: ({ userId }, { collectionId }, { targetUserId }) =>
    transferCollectionOwnership(userId, collectionId, targetUserId),
});
