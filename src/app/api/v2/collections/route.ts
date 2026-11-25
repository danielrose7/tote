import {
  createCollectionCommand,
  listCollectionsCommand,
} from '@/lib/commands/collections/server';
import { commandRoute } from '@/lib/commands/http';

export const GET = commandRoute(listCollectionsCommand, { target: () => ({}) });

export const POST = commandRoute(createCollectionCommand, {
  target: () => ({}),
  created: true,
});
