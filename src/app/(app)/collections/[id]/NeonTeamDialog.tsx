'use client';

import { useAuth } from '@clerk/nextjs';
import * as Dialog from '@radix-ui/react-dialog';
import { useMutation, useQuery } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { useToast } from '@/components/ToastNotification';
import { errorMessage } from '@/i18n/apiError';
import { useFormat, useTranslation } from '@/i18n/client';
import {
  type CreateCollectionInviteMutation,
  fetchCollectionTeam,
  type RemoveCollectionMemberMutation,
  type RevokeCollectionInviteMutation,
  type TransferCollectionOwnershipMutation,
  type UpdateCollectionMemberMutation,
} from '@/lib/collections/client';
import type { CollectionRole } from '@/lib/collections/permissions';
import {
  collectionMutationKeys,
  collectionQueryKeys,
} from '@/lib/collections/queryKeys';
import type { CollectionTeam } from '@/lib/collections/teamRepository';
import styles from './NeonTeamDialog.module.css';

function useOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return online;
}

const ROLE_LABEL = {
  owner: 'dialogs.team.role.owner',
  admin: 'dialogs.team.role.admin',
  editor: 'dialogs.team.role.editor',
  viewer: 'dialogs.team.role.viewer',
} as const satisfies Record<CollectionRole, string>;

const EVENT_LABEL = {
  invite_created: 'dialogs.team.event.invite_created',
  invite_revoked: 'dialogs.team.event.invite_revoked',
  invite_accepted: 'dialogs.team.event.invite_accepted',
  role_changed: 'dialogs.team.event.role_changed',
  member_removed: 'dialogs.team.event.member_removed',
  ownership_transferred: 'dialogs.team.event.ownership_transferred',
} as const satisfies Record<CollectionTeam['events'][number]['action'], string>;

function UserAvatar({
  user,
  fallback,
}: {
  user: CollectionTeam['members'][number]['user'];
  fallback: string;
}) {
  const [imgError, setImgError] = useState(false);
  if (user?.imageUrl && !imgError) {
    return (
      <img
        src={user.imageUrl}
        alt={user.displayName}
        className={styles.avatar}
        onError={() => setImgError(true)}
      />
    );
  }
  const initials = (user?.displayName ?? fallback)
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
  return <div className={styles.avatarFallback}>{initials}</div>;
}

export function NeonTeamDialog({
  collectionId,
  actorRole,
  open,
  onOpenChange,
}: {
  collectionId: string;
  actorRole: CollectionRole;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormat();
  const { userId } = useAuth();
  const { showToast } = useToast();
  const online = useOnline();
  const [recipientHint, setRecipientHint] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('viewer');
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: team, isLoading } = useQuery({
    queryKey: collectionQueryKeys.team(collectionId),
    queryFn: () => fetchCollectionTeam(collectionId),
    enabled: open,
  });

  const formatDate = (value: Date | null) =>
    value ? fmt.dateTime(value) : t('dialogs.team.noExpiration');

  const mutationError = (title: string) => (mutation: Error) => {
    setError(errorMessage(t, mutation));
    showToast({
      title,
      description: errorMessage(t, mutation),
      variant: 'error',
    });
  };
  const createInvite = useMutation<
    {
      id: string;
      token: string;
      role: 'editor' | 'viewer';
      expiresAt: string | null;
      maxUses: number | null;
    },
    Error,
    CreateCollectionInviteMutation
  >({
    mutationKey: collectionMutationKeys.createInvite,
    onSuccess: (invite) => {
      const url = `${window.location.origin}/invite/${encodeURIComponent(invite.token)}`;
      setLatestInviteUrl(url);
      setRecipientHint('');
      setError(null);
    },
    onError: mutationError(t('dialogs.team.error.invite')),
  });
  const revokeInvite = useMutation<
    { revokedAt: string },
    Error,
    RevokeCollectionInviteMutation
  >({
    mutationKey: collectionMutationKeys.revokeInvite,
    onError: mutationError(t('dialogs.team.error.revoke')),
  });
  const updateMember = useMutation<
    { role: string },
    Error,
    UpdateCollectionMemberMutation
  >({
    mutationKey: collectionMutationKeys.updateMember,
    onError: mutationError(t('dialogs.team.error.role')),
  });
  const removeMember = useMutation<
    { revokedAt: string },
    Error,
    RemoveCollectionMemberMutation
  >({
    mutationKey: collectionMutationKeys.removeMember,
    onError: mutationError(t('dialogs.team.error.remove')),
  });
  const transferOwnership = useMutation<
    { version: number },
    Error,
    TransferCollectionOwnershipMutation
  >({
    mutationKey: collectionMutationKeys.transferOwnership,
    onSuccess: () => onOpenChange(false),
    onError: mutationError(t('dialogs.team.error.transfer')),
  });
  const busy =
    createInvite.isPending ||
    revokeInvite.isPending ||
    updateMember.isPending ||
    removeMember.isPending ||
    transferOwnership.isPending;

  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!online) return;
    createInvite.mutate({
      collectionId,
      input: {
        role: inviteRole,
        recipientHint: recipientHint.trim() || undefined,
        maxUses: 1,
      },
    });
  };

  const copyInvite = async () => {
    if (!latestInviteUrl) return;
    await navigator.clipboard.writeText(latestInviteUrl);
    showToast({
      title: t('dialogs.team.copiedTitle'),
      description: t('dialogs.team.copiedDescription'),
      variant: 'success',
    });
  };

  const canManageMember = (member: CollectionTeam['members'][number]) =>
    member.userId !== userId &&
    member.role !== 'owner' &&
    (actorRole === 'owner' || member.role !== 'admin');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          <div className={styles.heading}>
            <div>
              <Dialog.Title className={styles.title}>
                {t('dialogs.team.title')}
              </Dialog.Title>
              <Dialog.Description className={styles.description}>
                {t('dialogs.team.description')}
              </Dialog.Description>
            </div>
            <Dialog.Close className={styles.closeButton}>
              {t('dialogs.common.close')}
            </Dialog.Close>
          </div>

          {!online && (
            <p className={styles.notice}>{t('dialogs.team.offline')}</p>
          )}
          {error && <p className={styles.error}>{error}</p>}

          <section className={styles.section}>
            <h3>{t('dialogs.team.shareHeading')}</h3>
            <form className={styles.inviteForm} onSubmit={submitInvite}>
              <input
                value={recipientHint}
                onChange={(event) => setRecipientHint(event.target.value)}
                placeholder={t('dialogs.team.labelPlaceholder')}
                aria-label={t('dialogs.team.labelAria')}
                maxLength={320}
              />
              <select
                value={inviteRole}
                onChange={(event) =>
                  setInviteRole(event.target.value as 'editor' | 'viewer')
                }
                aria-label={t('dialogs.team.roleAria')}
              >
                <option value="viewer">{t(ROLE_LABEL.viewer)}</option>
                <option value="editor">{t(ROLE_LABEL.editor)}</option>
              </select>
              <button type="submit" disabled={!online || busy}>
                {t('dialogs.team.createLink')}
              </button>
            </form>
            {latestInviteUrl && (
              <div className={styles.inviteLinkReady}>
                <p className={styles.inviteLinkReadyLabel}>
                  {t('dialogs.team.linkReady')}
                </p>
                <div className={styles.inviteLink}>
                  <input
                    readOnly
                    value={latestInviteUrl}
                    aria-label={t('dialogs.team.linkAria')}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button type="button" onClick={copyInvite}>
                    {t('dialogs.team.copyLink')}
                  </button>
                </div>
              </div>
            )}
            <p className={styles.helper}>{t('dialogs.team.linkHelper')}</p>
          </section>

          {isLoading && (
            <p className={styles.muted}>{t('dialogs.team.loading')}</p>
          )}
          {team && (
            <>
              <section className={styles.section}>
                <h3>{t('dialogs.team.members')}</h3>
                <div className={styles.list}>
                  {team.members.map((member) => {
                    const manageable = canManageMember(member);
                    const displayName =
                      member.userId === userId
                        ? t('dialogs.team.you')
                        : (member.user?.displayName ?? member.userId);
                    return (
                      <div className={styles.row} key={member.userId}>
                        <div className={styles.memberRow}>
                          <UserAvatar
                            user={member.user}
                            fallback={member.userId}
                          />
                          <div className={styles.identity}>
                            <strong>{displayName}</strong>
                            <span>
                              {t('dialogs.team.joined', {
                                date: formatDate(member.joinedAt),
                              })}
                            </span>
                          </div>
                        </div>
                        <div className={styles.rowActions}>
                          <select
                            value={member.role}
                            disabled={!online || busy || !manageable}
                            onChange={(event) =>
                              updateMember.mutate({
                                collectionId,
                                userId: member.userId,
                                role: event.target.value as
                                  | 'admin'
                                  | 'editor'
                                  | 'viewer',
                              })
                            }
                            aria-label={t('dialogs.team.memberRoleAria', {
                              name: displayName,
                            })}
                          >
                            {member.role === 'owner' && (
                              <option value="owner">
                                {t(ROLE_LABEL.owner)}
                              </option>
                            )}
                            {(actorRole === 'owner' ||
                              member.role === 'admin') && (
                              <option value="admin">
                                {t(ROLE_LABEL.admin)}
                              </option>
                            )}
                            <option value="editor">
                              {t(ROLE_LABEL.editor)}
                            </option>
                            <option value="viewer">
                              {t(ROLE_LABEL.viewer)}
                            </option>
                          </select>
                          {manageable && (
                            <>
                              <button
                                type="button"
                                disabled={!online || busy}
                                onClick={() =>
                                  removeMember.mutate({
                                    collectionId,
                                    userId: member.userId,
                                  })
                                }
                              >
                                {t('dialogs.team.remove')}
                              </button>
                              {actorRole === 'owner' && (
                                <button
                                  type="button"
                                  disabled={!online || busy}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        t('dialogs.team.confirmTransfer', {
                                          name: displayName,
                                        }),
                                      )
                                    ) {
                                      transferOwnership.mutate({
                                        collectionId,
                                        targetUserId: member.userId,
                                      });
                                    }
                                  }}
                                >
                                  {t('dialogs.team.makeOwner')}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={styles.section}>
                <h3>{t('dialogs.team.invites')}</h3>
                <div className={styles.list}>
                  {team.invites.length === 0 && (
                    <p className={styles.muted}>
                      {t('dialogs.team.noInvites')}
                    </p>
                  )}
                  {team.invites.map((invite) => (
                    <div className={styles.row} key={invite.id}>
                      <div className={styles.identity}>
                        <strong>
                          {invite.recipientHint || t('dialogs.team.shareLink')}
                        </strong>
                        <span>
                          {t('dialogs.team.inviteMeta', {
                            role: t(ROLE_LABEL[invite.role]),
                            count: invite.useCount,
                            expires: formatDate(invite.expiresAt),
                          })}
                        </span>
                      </div>
                      {invite.revokedAt ? (
                        <span className={styles.muted}>
                          {t('dialogs.team.revoked')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={!online || busy}
                          onClick={() =>
                            revokeInvite.mutate({
                              collectionId,
                              inviteId: invite.id,
                            })
                          }
                        >
                          {t('dialogs.team.revoke')}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              <details className={styles.audit}>
                <summary>
                  {t('dialogs.team.activity', { count: team.events.length })}
                </summary>
                <div className={styles.list}>
                  {team.events
                    .slice()
                    .reverse()
                    .map((event) => (
                      <div className={styles.auditRow} key={event.id}>
                        <span>
                          {t('dialogs.team.auditEntry', {
                            actor:
                              team.userIndex[event.actorUserId]?.displayName ??
                              event.actorUserId,
                            action: t(EVENT_LABEL[event.action]),
                          })}
                        </span>
                        <time>{formatDate(event.createdAt)}</time>
                      </div>
                    ))}
                </div>
              </details>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
