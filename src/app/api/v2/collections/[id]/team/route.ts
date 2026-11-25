import { commandRoute } from '@/lib/commands/http';
import {
  createInviteCommand,
  getTeamCommand,
} from '@/lib/commands/team/server';

const target = ({ id }: { id: string }) => ({ collectionId: id });

export const GET = commandRoute(getTeamCommand, { target });
export const POST = commandRoute(createInviteCommand, {
  target,
  created: true,
});
