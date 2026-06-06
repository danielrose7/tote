import { useAuth, useUser } from '@clerk/expo';
import { useSignInWithApple } from '@clerk/expo/apple';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Block, BlockList, JazzAccount } from '@tote/schema';
import { Group } from 'jazz-tools';
import * as AuthSession from 'expo-auth-session';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useAccount } from 'jazz-tools/expo';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  GestureHandlerRootView,
  Swipeable,
} from 'react-native-gesture-handler';
import { AcceptInviteSheet } from './src/components/AcceptInviteSheet';
import { SaveProductSheet } from './src/components/SaveProductSheet';
import { useInviteLink } from './src/hooks/useInviteLink';
import { usePendingUrl } from './src/hooks/usePendingUrl';
import { cleanupPublishedClonesFromRoot } from './src/lib/shareCollection';
import type { RootStackParamList } from './src/navigation/types';
import { Providers } from './src/providers';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { CollectionDetailScreen } from './src/screens/CollectionDetailScreen';

WebBrowser.maybeCompleteAuthSession();

const Stack = createNativeStackNavigator<RootStackParamList>();
const HOME_COLLECTION_CARD_HEIGHT = 80;

function SignInScreen() {
  const {
    isLoaded: isSignInLoaded,
    signIn,
    setActive: setActiveSignIn,
  } = useSignIn();
  const {
    isLoaded: isSignUpLoaded,
    signUp,
    setActive: setActiveSignUp,
  } = useSignUp();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailMode, setEmailMode] = useState<'signIn' | 'signUp'>('signIn');
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [awaitingVerification, setAwaitingVerification] = useState(false);
  const { startAppleAuthenticationFlow } = useSignInWithApple();
  const [oauthLoading, setOauthLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const emailActionLabel = awaitingVerification
    ? 'Verify email'
    : emailMode === 'signIn'
      ? 'Sign in with email'
      : 'Create account';

  function formatClerkError(err: unknown) {
    const firstError = (
      err as { errors?: Array<{ longMessage?: string; message?: string }> }
    )?.errors?.[0];
    if (firstError?.longMessage) return firstError.longMessage;
    if (firstError?.message) return firstError.message;
    if (err instanceof Error && err.message) return err.message;
    return 'Please try again.';
  }

  async function handleSignIn(strategy: 'oauth_google' | 'oauth_apple') {
    if (oauthLoading) return;

    setOauthLoading(true);

    try {
      if (!isSignInLoaded || !isSignUpLoaded || !signIn || !signUp) return;

      const redirectUrl = AuthSession.makeRedirectUri({
        path: 'oauth-native-callback',
      });

      await signIn.create({ strategy, redirectUrl });

      const externalVerificationRedirectURL =
        signIn.firstFactorVerification.externalVerificationRedirectURL;

      if (!externalVerificationRedirectURL) {
        throw new Error('OAuth redirect URL was not returned by Clerk.');
      }

      WebBrowser.dismissAuthSession();
      const authSessionResult = await WebBrowser.openAuthSessionAsync(
        externalVerificationRedirectURL.toString(),
        redirectUrl,
      );

      if (authSessionResult.type !== 'success') return;

      const rotatingTokenNonce =
        new URL(authSessionResult.url).searchParams.get(
          'rotating_token_nonce',
        ) || '';

      await signIn.reload({ rotatingTokenNonce });

      let createdSessionId = '';
      if (signIn.status === 'complete') {
        createdSessionId = signIn.createdSessionId || '';
      } else if (signIn.firstFactorVerification.status === 'transferable') {
        await signUp.create({ transfer: true });
        createdSessionId = signUp.createdSessionId || '';
      }

      if (createdSessionId && setActiveSignIn) {
        await setActiveSignIn({ session: createdSessionId });
      }
    } catch (err) {
      const msg = formatClerkError(err);
      // Clerk throws "already signed in" when a session exists but Clerk hasn't
      // propagated isSignedIn yet — AuthScreen will redirect automatically.
      if (!msg.toLowerCase().includes('already signed in')) {
        Alert.alert('Sign in failed', msg);
      }
    } finally {
      setOauthLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (appleLoading) return;
    setAppleLoading(true);
    try {
      const { createdSessionId, setActive } =
        await startAppleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      const msg = formatClerkError(err);
      if (!msg.toLowerCase().includes('already signed in')) {
        Alert.alert('Sign in failed', msg);
      }
    } finally {
      setAppleLoading(false);
    }
  }

  async function handleEmailAuth() {
    if (emailLoading) return;

    setEmailLoading(true);

    try {
      if (awaitingVerification) {
        if (!isSignUpLoaded || !signUp || !setActiveSignUp) return;

        const attempt = await signUp.attemptEmailAddressVerification({
          code: verificationCode.trim(),
        });

        if (attempt.status === 'complete' && attempt.createdSessionId) {
          await setActiveSignUp({ session: attempt.createdSessionId });
          return;
        }

        Alert.alert(
          'Verification not complete',
          'Please enter the latest code from your email.',
        );
        return;
      }

      if (emailMode === 'signIn') {
        if (!isSignInLoaded || !signIn || !setActiveSignIn) return;

        const result = await signIn.create({
          identifier: emailAddress.trim(),
          password,
        });

        if (result.status === 'complete' && result.createdSessionId) {
          await setActiveSignIn({ session: result.createdSessionId });
          return;
        }

        Alert.alert('Email sign in didn’t finish', 'Please try again.');
        return;
      }

      if (!isSignUpLoaded || !signUp) return;

      await signUp.create({
        emailAddress: emailAddress.trim(),
        password,
      });
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setAwaitingVerification(true);
    } catch (err) {
      console.error('Email auth error:', err);
      Alert.alert(
        emailMode === 'signIn'
          ? 'Email sign in failed'
          : 'Email sign up failed',
        formatClerkError(err),
      );
    } finally {
      setEmailLoading(false);
    }
  }

  function resetEmailFlow(nextMode?: 'signIn' | 'signUp') {
    setAwaitingVerification(false);
    setVerificationCode('');
    setPassword('');
    if (nextMode) setEmailMode(nextMode);
  }

  return (
    <KeyboardAvoidingView
      style={styles.centered}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.signInScrollView}
        contentContainerStyle={styles.signInScroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authStack}>
          <View style={styles.authHero}>
            <Text style={styles.title}>Tote</Text>
            <Text style={styles.subtitle}>Save products from any store</Text>
          </View>
          <View style={styles.authButtons}>
            <TouchableOpacity
              style={[styles.button, oauthLoading && styles.buttonDisabled]}
              onPress={() => handleSignIn('oauth_google')}
              disabled={oauthLoading}
            >
              <Text style={styles.buttonText}>Continue with Google</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.buttonApple,
                appleLoading && styles.buttonDisabled,
              ]}
              onPress={handleAppleSignIn}
              disabled={appleLoading}
            >
              <Text style={styles.buttonText}>Continue with Apple</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.buttonSecondary]}
              onPress={() => {
                setShowEmailForm((value) => !value);
                resetEmailFlow();
              }}
            >
              <Text style={[styles.buttonText, styles.buttonSecondaryText]}>
                Continue with Email
              </Text>
            </TouchableOpacity>
          </View>

          {showEmailForm && (
            <View style={styles.emailCard}>
              {!awaitingVerification && (
                <View style={styles.emailModeRow}>
                  <TouchableOpacity
                    style={[
                      styles.emailModeChip,
                      emailMode === 'signIn' && styles.emailModeChipActive,
                    ]}
                    onPress={() => resetEmailFlow('signIn')}
                  >
                    <Text
                      style={[
                        styles.emailModeChipText,
                        emailMode === 'signIn' &&
                          styles.emailModeChipTextActive,
                      ]}
                    >
                      Sign In
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.emailModeChip,
                      emailMode === 'signUp' && styles.emailModeChipActive,
                    ]}
                    onPress={() => resetEmailFlow('signUp')}
                  >
                    <Text
                      style={[
                        styles.emailModeChipText,
                        emailMode === 'signUp' &&
                          styles.emailModeChipTextActive,
                      ]}
                    >
                      Create Account
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {awaitingVerification ? (
                <>
                  <Text style={styles.emailHelper}>
                    Enter the verification code Clerk emailed to{' '}
                    {emailAddress.trim()}.
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    placeholder="Verification code"
                    autoCapitalize="none"
                    keyboardType="number-pad"
                  />
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    value={emailAddress}
                    onChangeText={setEmailAddress}
                    placeholder="Email"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                    textContentType="emailAddress"
                  />
                  <TextInput
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType={
                      emailMode === 'signIn' ? 'password' : 'newPassword'
                    }
                  />
                </>
              )}

              <TouchableOpacity
                style={[styles.button, emailLoading && styles.buttonDisabled]}
                onPress={handleEmailAuth}
                disabled={emailLoading}
              >
                <Text style={styles.buttonText}>
                  {emailLoading ? 'Working...' : emailActionLabel}
                </Text>
              </TouchableOpacity>

              {awaitingVerification ? (
                <TouchableOpacity onPress={() => resetEmailFlow('signUp')}>
                  <Text style={styles.link}>Start over</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() =>
                    resetEmailFlow(emailMode === 'signIn' ? 'signUp' : 'signIn')
                  }
                >
                  <Text style={styles.link}>
                    {emailMode === 'signIn'
                      ? 'Need an account? Create one'
                      : 'Already have an account? Sign in'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CollectionCard({
  item,
  onPress,
  onDelete,
}: {
  item: typeof Block.prototype;
  onPress: () => void;
  onDelete: () => void;
}) {
  const swipeRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={(progress) => {
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [80, 0],
          extrapolate: 'clamp',
        });
        return (
          <Animated.View
            style={[styles.deleteAction, { transform: [{ translateX }] }]}
          >
            <TouchableOpacity
              style={styles.deleteActionInner}
              onPress={onDelete}
            >
              <Text style={styles.deleteActionText}>Delete</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      }}
      rightThreshold={40}
      overshootRight={false}
    >
      <TouchableOpacity
        style={styles.collectionCard}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.colorDot,
            { backgroundColor: item?.collectionData?.color ?? '#6366f1' },
          ]}
        />
        <View style={styles.collectionInfo}>
          <Text style={styles.collectionName}>{item?.name}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </Swipeable>
  );
}

function CollectionSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonDot} />
      <View style={styles.skeletonInfo}>
        <View style={styles.skeletonName} />
      </View>
      <View style={styles.skeletonChevron} />
    </View>
  );
}

const COLLECTION_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#06b6d4',
];

function AddCollectionModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, color: string) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLLECTION_COLORS[0]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, color);
    setName('');
    setColor(COLLECTION_COLORS[0]);
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Add Collection</Text>

          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder="Collection name"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.swatches}>
            {COLLECTION_COLORS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.swatch,
                  { backgroundColor: c },
                  color === c && styles.swatchSelected,
                ]}
                onPress={() => setColor(c)}
              >
                {color === c && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalSave} onPress={handleSave}>
              <Text style={styles.modalSaveText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CollectionListContent({
  navigation,
  refreshing,
  onRefresh,
}: {
  navigation: any;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const me = useAccount(JazzAccount, {
    resolve: {
      root: {
        blocks: { $each: true },
      },
    },
  });
  const { user } = useUser();
  const [showAddCollection, setShowAddCollection] = useState(false);

  useEffect(() => {
    if (!me) return;
    cleanupPublishedClonesFromRoot(me.root?.blocks);
  }, [me, me?.root?.blocks]);

  if (!me) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const blocksLoaded = me.root?.blocks != null;
  const collections =
    me?.root?.blocks?.filter(
      (b: typeof Block.prototype | null) =>
        b?.type === 'collection' && !b?.collectionData?.sourceId,
    ) ?? [];

  function deleteCollection(item: typeof Block.prototype) {
    const list = me?.root?.blocks;
    if (!list) return;
    const idx = list.findIndex((b) => b?.$jazz?.id === item.$jazz.id);
    if (idx !== -1) list.$jazz.splice(idx, 1);
  }

  function handleAddCollection(name: string, color: string) {
    if (!me?.root) return;
    const ownerGroup = Group.create({ owner: me });
    ownerGroup.addMember(me, 'admin');
    const childrenList = BlockList.create([], { owner: ownerGroup });
    const collection = Block.create(
      {
        type: 'collection',
        name,
        collectionData: {
          color,
          viewMode: 'grid',
          sharingGroupId: ownerGroup.$jazz.id,
        },
        children: childrenList,
        createdAt: new Date(),
      },
      { owner: ownerGroup },
    );
    me.root.blocks?.$jazz.push(collection);
    navigation.navigate('CollectionDetail', {
      collectionId: collection.$jazz.id,
      collectionName: name,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tote</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('AccountSettings')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {user?.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
          ) : (
            <Ionicons name="person-circle-outline" size={28} color="#6b7280" />
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={collections}
        keyExtractor={(item) => item?.$jazz?.id ?? ''}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
        renderItem={({ item }) => (
          <CollectionCard
            item={item}
            onPress={() =>
              navigation.navigate('CollectionDetail', {
                collectionId: item.$jazz.id,
                collectionName: item.name ?? 'Collection',
              })
            }
            onDelete={() => deleteCollection(item)}
          />
        )}
        ListEmptyComponent={
          !blocksLoaded ? (
            <>
              <CollectionSkeleton />
              <CollectionSkeleton />
              <CollectionSkeleton />
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No collections yet</Text>
              <Text style={styles.emptySubtitle}>
                Add a collection to start saving products
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => setShowAddCollection(true)}
              >
                <Text style={styles.emptyButtonText}>Add Collection</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowAddCollection(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
      <AddCollectionModal
        visible={showAddCollection}
        onClose={() => setShowAddCollection(false)}
        onSave={handleAddCollection}
      />
      <StatusBar style="auto" />
    </View>
  );
}

function CollectionListScreen({ navigation }: any) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  function handleRefresh() {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => {
      setRefreshing(false);
    }, 500);
  }

  return (
    <CollectionListContent
      key={refreshKey}
      navigation={navigation}
      refreshing={refreshing}
      onRefresh={handleRefresh}
    />
  );
}

function AppScreens() {
  const { pendingUrl, clearPendingUrl, queueLength } = usePendingUrl();
  const { invite, clearInvite } = useInviteLink();
  const [defaultQueuedCollectionId, setDefaultQueuedCollectionId] = useState<
    string | undefined
  >(undefined);

  function handleDismissPendingUrl() {
    clearPendingUrl();
    if (queueLength <= 1) {
      setDefaultQueuedCollectionId(undefined);
    }
  }

  return (
    <>
      <Stack.Navigator>
        <Stack.Screen
          name="CollectionList"
          component={CollectionListScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CollectionDetail"
          component={CollectionDetailScreen}
          options={{
            headerShown: false,
            fullScreenGestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="AccountSettings"
          component={AccountSettingsScreen}
          options={{ title: 'Account', headerBackTitle: 'Collections' }}
        />
      </Stack.Navigator>
      {pendingUrl && (
        <SaveProductSheet
          key={pendingUrl}
          url={pendingUrl}
          onDismiss={handleDismissPendingUrl}
          defaultCollectionId={defaultQueuedCollectionId}
          autoApplyCollectionId={defaultQueuedCollectionId}
          queueRemaining={Math.max(queueLength - 1, 0)}
          onApplyCollectionToRemaining={(collectionId) =>
            setDefaultQueuedCollectionId(collectionId ?? undefined)
          }
        />
      )}
      {invite && <AcceptInviteSheet invite={invite} onClose={clearInvite} />}
    </>
  );
}

function JazzAppShell() {
  return <AppScreens />;
}

function AuthScreen() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();

  if (!isLoaded || (userId && !user)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!userId) {
    return <SignInScreen />;
  }

  return <JazzAppShell />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Providers>
        <NavigationContainer>
          <AuthScreen />
        </NavigationContainer>
      </Providers>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 32,
    textAlign: 'center',
  },
  signInScroll: {
    alignItems: 'stretch',
    flexGrow: 1,
    justifyContent: 'center',
    paddingTop: 32,
    paddingBottom: 32,
  },
  signInScrollView: {
    width: '100%',
    alignSelf: 'stretch',
  },
  authStack: {
    width: '100%',
    alignSelf: 'stretch',
    paddingHorizontal: 24,
  },
  authHero: {
    alignItems: 'center',
    marginBottom: 16,
  },
  authButtons: {
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonApple: {
    backgroundColor: '#000',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#111827',
  },
  emailCard: {
    width: '100%',
    alignSelf: 'stretch',
    marginTop: 12,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  emailModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  emailModeChip: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  emailModeChipActive: {
    backgroundColor: '#eef2ff',
  },
  emailModeChipText: {
    color: '#4b5563',
    fontSize: 14,
    fontWeight: '600',
  },
  emailModeChipTextActive: {
    color: '#4f46e5',
  },
  emailHelper: {
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
    marginBottom: 12,
  },
  input: {
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  link: {
    color: '#6366f1',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 2,
  },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: HOME_COLLECTION_CARD_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  chevron: {
    fontSize: 20,
    color: '#d1d5db',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  empty: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: 40,
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 16,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  skeletonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    height: HOME_COLLECTION_CARD_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  skeletonDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#e5e7eb',
  },
  skeletonInfo: { flex: 1 },
  skeletonName: {
    height: 16,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
    width: '50%',
  },
  skeletonChevron: {
    width: 12,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  deleteAction: { width: 80, backgroundColor: '#ef4444' },
  deleteActionInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
    marginTop: 16,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111',
  },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, color: '#6b7280', fontWeight: '600' },
  modalSave: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#6366f1',
    alignItems: 'center',
  },
  modalSaveText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: { borderWidth: 2.5, borderColor: 'rgba(0,0,0,0.2)' },
});
