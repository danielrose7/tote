import { commandRoute } from '@/lib/commands/http';
import {
  changeMemberRoleCommand,
  removeMemberCommand,
} from '@/lib/commands/team/server';

const target = ({ id, userId }: { id: string; userId: string }) => ({
  collectionId: id,
  memberUserId: userId,
});

export const PATCH = commandRoute(changeMemberRoleCommand, { target });
export const DELETE = commandRoute(removeMemberCommand, { target });
