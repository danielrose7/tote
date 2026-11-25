import { commandRoute } from '@/lib/commands/http';
import { revokeInviteCommand } from '@/lib/commands/team/server';

export const DELETE = commandRoute(revokeInviteCommand, {
  target: ({ id, inviteId }: { id: string; inviteId: string }) => ({
    collectionId: id,
    inviteId,
  }),
});
