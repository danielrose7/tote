import {
  deleteCollectionCommand,
  getCollectionCommand,
  updateCollectionCommand,
} from '@/lib/commands/collections/server';
import { commandRoute } from '@/lib/commands/http';

const target = ({ id }: { id: string }) => ({ collectionId: id });

export const GET = commandRoute(getCollectionCommand, { target });
export const PATCH = commandRoute(updateCollectionCommand, { target });
export const DELETE = commandRoute(deleteCollectionCommand, { target });
