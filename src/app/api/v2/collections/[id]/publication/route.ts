import { commandRoute } from '@/lib/commands/http';
import {
  getPublicationCommand,
  publishCollectionCommand,
  unpublishCollectionCommand,
} from '@/lib/commands/publications/server';

const target = ({ id }: { id: string }) => ({ collectionId: id });

export const GET = commandRoute(getPublicationCommand, { target });
export const POST = commandRoute(publishCollectionCommand, { target });
export const DELETE = commandRoute(unpublishCollectionCommand, { target });
