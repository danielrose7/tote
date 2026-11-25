import { commandRoute } from '@/lib/commands/http';
import { acceptInviteCommand } from '@/lib/commands/team/server';

export const POST = commandRoute(acceptInviteCommand, { target: () => ({}) });
