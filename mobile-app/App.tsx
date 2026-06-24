import { useAuth, useUser } from '@clerk/expo';
import { useSignInWithApple } from '@clerk/expo/apple';
import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as AuthSession from 'expo-auth-session';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  NativeModules,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AcceptInviteSheet } from './src/components/AcceptInviteSheet';
import { SaveProductSheet } from './src/components/SaveProductSheet';
import { useInviteLink } from './src/hooks/useInviteLink';
import { usePendingUrl } from './src/hooks/usePendingUrl';
import type { Collection } from './src/lib/api';
import {
  captureUrl,
  createCollection,
  fetchCaptureCollections,
  fetchCollections,
  provisionApiKey,
} from './src/lib/api';
import {
  getCachedCollections,
  setupDatabase,
  upsertCollections,
} from './src/lib/localDb';
import type { RootStackParamList } from './src/navigation/types';
import { Providers } from './src/providers';
import { AccountSettingsScreen } from './src/screens/AccountSettingsScreen';
import { CollectionDetailScreen } from './src/screens/CollectionDetailScreen';

WebBrowser.maybeCompleteAuthSession();

// Initialize SQLite on startup
setupDatabase().catch((e) => console.warn('DB setup error:', e));

const Stack = createNativeStackNavigator<RootStackParamList>();
const onboardingKey = (userId: string) => `tote_onboarding_complete_${userId}`;

const ONBOARDING_SCREENS = [
  {
    icon: 'share-outline' as const,
    title: 'Save from any store',
    body: 'Open any product in Safari or any app, tap the Share button, then select Tote.',
    tip: 'Tip: Tote may be hidden — tap "More" in the share sheet, then turn on Tote and drag it to the top to keep it handy.',
  },
  {
    icon: 'folder-outline' as const,
    title: 'Organize into collections',
    body: 'Tap + to create collections for different projects, trips, or moods. Tap any collection to browse and manage your saves.',
    tip: null,
  },
];

function OnboardingScreen({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (autoAdd: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const screen = ONBOARDING_SCREENS[step];
  const isLast = step === ONBOARDING_SCREENS.length - 1;

  async function finish(autoAdd: boolean) {
    await AsyncStorage.setItem(onboardingKey(userId), 'true');
    onDone(autoAdd);
  }

  function next() {
    if (isLast) {
      finish(true);
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <View style={styles.onboardingContainer}>
      <TouchableOpacity
        style={styles.onboardingSkip}
        onPress={() => finish(false)}
      >
        <Text style={styles.onboardingSkipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.onboardingContent}>
        <View style={styles.onboardingIconWrap}>
          <Ionicons name={screen.icon} size={48} color="#6366f1" />
        </View>
        <Text style={styles.onboardingTitle}>{screen.title}</Text>
        <Text style={styles.onboardingBody}>{screen.body}</Text>
        {screen.tip && (
          <View style={styles.onboardingTip}>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color="#6366f1"
            />
            <Text style={styles.onboardingTipText}>{screen.tip}</Text>
          </View>
        )}
      </View>

      <View style={styles.onboardingFooter}>
        <View style={styles.onboardingDots}>
          {ONBOARDING_SCREENS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.onboardingDot,
                i === step && styles.onboardingDotActive,
              ]}
            />
          ))}
        </View>
        <TouchableOpacity style={styles.onboardingButton} onPress={next}>
          <Text style={styles.onboardingButtonText}>
            {isLast ? 'Get started' : 'Next'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

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

        Alert.alert("Email sign in didn't finish", 'Please try again.');
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

function PreviewImageGrid({
  images,
  color,
}: {
  images: { url: string; title: string | null; nodeId: string }[];
  color?: string | null;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const visible = images.filter((img) => !failedUrls.has(img.url));
  const count = Math.min(visible.length, 3);

  if (count === 0) {
    return (
      <View
        style={[
          styles.previewGridFallback,
          { backgroundColor: color ?? 'rgba(99,102,241,0.18)' },
        ]}
      >
        <Ionicons
          name="albums-outline"
          size={30}
          color="rgba(255,255,255,0.8)"
        />
      </View>
    );
  }

  if (count === 1) {
    return (
      <Image
        source={{ uri: visible[0].url }}
        style={styles.previewGridFull}
        resizeMode="cover"
        onError={() => setFailedUrls((p) => new Set([...p, visible[0].url]))}
      />
    );
  }

  if (count === 2) {
    return (
      <View style={styles.previewGridRow}>
        {visible.slice(0, 2).map((img) => (
          <Image
            key={img.nodeId}
            source={{ uri: img.url }}
            style={styles.previewGridHalf}
            resizeMode="cover"
            onError={() => setFailedUrls((p) => new Set([...p, img.url]))}
          />
        ))}
      </View>
    );
  }

  // 3 images: "L" — large left, two stacked right
  return (
    <View style={styles.previewGridRow}>
      <Image
        source={{ uri: visible[0].url }}
        style={styles.previewGridLarge}
        resizeMode="cover"
        onError={() => setFailedUrls((p) => new Set([...p, visible[0].url]))}
      />
      <View style={styles.previewGridStack}>
        {visible.slice(1, 3).map((img) => (
          <Image
            key={img.nodeId}
            source={{ uri: img.url }}
            style={styles.previewGridSmall}
            resizeMode="cover"
            onError={() => setFailedUrls((p) => new Set([...p, img.url]))}
          />
        ))}
      </View>
    </View>
  );
}

function CollectionCard({
  item,
  onPress,
}: {
  item: Collection;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.collectionCard}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.collectionPreview}>
        <PreviewImageGrid
          images={item.previewImages ?? []}
          color={item.color}
        />
        <View style={styles.collectionCount}>
          <Text style={styles.collectionCountText}>
            {item.itemCount} {item.itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </View>
      <View style={styles.collectionCardInfo}>
        <View
          style={[
            styles.collectionColorDot,
            { backgroundColor: item.color ?? '#6366f1' },
          ]}
        />
        <Text style={styles.collectionName} numberOfLines={2}>
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function CollectionSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonPreview} />
      <View style={styles.skeletonInfo}>
        <View style={styles.skeletonName} />
      </View>
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
  autoAdd,
}: {
  navigation: any;
  refreshing: boolean;
  onRefresh: () => void;
  autoAdd: boolean;
}) {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const autoAddTriggered = useRef(false);
  const apiKeyProvisioned = useRef(false);

  async function loadCollections(force = false) {
    // 1. Load from cache first (fast path)
    if (!force) {
      try {
        const cached = await getCachedCollections();
        if (cached.length > 0) {
          setCollections(cached);
          setLoaded(true);
        }
      } catch {}
    }
    // 2. Fetch from API
    try {
      const token = await getToken();
      if (!token) {
        setLoaded(true);
        return;
      }
      const result = await fetchCollections(token);
      await upsertCollections(result);
      setCollections(result);
      setLoaded(true);
      // Populate cache and provision API key for share extension
      try {
        const captureCollections = await fetchCaptureCollections(token);
        NativeModules.AppGroupModule?.setCollectionsCache?.(
          JSON.stringify(captureCollections),
        );
        // Provision a long-lived API key once per app session
        if (!apiKeyProvisioned.current) {
          apiKeyProvisioned.current = true;
          const existing = await NativeModules.AppGroupModule?.getApiKey?.();
          if (!existing) {
            const secret = await provisionApiKey(token);
            NativeModules.AppGroupModule?.setApiKey?.(secret);
          }
        }
      } catch {}
    } catch (e) {
      console.warn('loadCollections error:', e);
      setLoaded(true); // show whatever we have from cache
    }
  }

  useEffect(() => {
    loadCollections();
  }, []);

  // When parent triggers refresh
  useEffect(() => {
    if (refreshing) loadCollections(true);
  }, [refreshing]);

  // Refresh when screen comes back into focus (navigate-back or app foreground)
  useEffect(() => {
    const appStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') loadCollections(true);
    });
    const focusSub = navigation.addListener('focus', () =>
      loadCollections(true),
    );
    return () => {
      appStateSub.remove();
      focusSub();
    };
  }, []);

  useEffect(() => {
    if (!autoAdd || autoAddTriggered.current || !loaded) return;
    if (collections.length === 0) {
      autoAddTriggered.current = true;
      setShowAddCollection(true);
    }
  }, [autoAdd, collections.length, loaded]);

  async function handleAddCollection(name: string, color: string) {
    try {
      const token = await getToken();
      if (!token) return;
      const result = await createCollection(token, { name, color });
      await loadCollections(true);
      navigation.navigate('CollectionDetail', {
        collectionId: result.id,
        collectionName: name,
      });
    } catch (e) {
      Alert.alert('Could not create collection', 'Please try again.');
    }
  }

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const filteredCollections = normalizedSearch
    ? collections.filter((collection) =>
        (collection.name ?? '').toLocaleLowerCase().includes(normalizedSearch),
      )
    : collections;
  const collectionColumnWidth = Math.floor(
    (Dimensions.get('window').width - 52) / 2,
  );
  const leftCollections = filteredCollections.filter(
    (_collection, index) => index % 2 === 0,
  );
  const rightCollections = filteredCollections.filter(
    (_collection, index) => index % 2 === 1,
  );

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

      <ScrollView
        contentContainerStyle={styles.collectionGrid}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
      >
        {!loaded ? (
          <View style={styles.masonryColumns}>
            <View style={{ width: collectionColumnWidth }}>
              <CollectionSkeleton />
              <CollectionSkeleton />
            </View>
            <View style={{ width: collectionColumnWidth }}>
              <CollectionSkeleton />
              <CollectionSkeleton />
            </View>
          </View>
        ) : filteredCollections.length > 0 ? (
          <View style={styles.masonryColumns}>
            {[leftCollections, rightCollections].map(
              (columnCollections, columnIndex) => (
                <View
                  key={columnIndex === 0 ? 'left' : 'right'}
                  style={{ width: collectionColumnWidth }}
                >
                  {columnCollections.map((item) => (
                    <CollectionCard
                      key={item.id}
                      item={item}
                      onPress={() =>
                        navigation.navigate('CollectionDetail', {
                          collectionId: item.id,
                          collectionName: item.name ?? 'Collection',
                        })
                      }
                    />
                  ))}
                </View>
              ),
            )}
          </View>
        ) : normalizedSearch ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No matching collections</Text>
            <Text style={styles.emptySubtitle}>
              Try a different search term
            </Text>
          </View>
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
        )}
      </ScrollView>
      <View style={styles.collectionDock}>
        <View style={styles.collectionSearch}>
          <Ionicons name="search" size={19} color="#9ca3af" />
          <TextInput
            style={styles.collectionSearchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search collections"
            placeholderTextColor="#9ca3af"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddCollection(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
      <AddCollectionModal
        visible={showAddCollection}
        onClose={() => setShowAddCollection(false)}
        onSave={handleAddCollection}
      />
      <StatusBar style="auto" />
    </View>
  );
}

function CollectionListScreen({ navigation, route }: any) {
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
      autoAdd={route.params?.autoAdd ?? false}
    />
  );
}

function AppScreens({ autoAdd }: { autoAdd: boolean }) {
  const { getToken } = useAuth();
  const {
    pendingUrl,
    clearPendingUrl,
    queueLength,
    pendingCapture,
    clearPendingCapture,
  } = usePendingUrl();
  const { invite, clearInvite } = useInviteLink();
  const [defaultQueuedCollectionId, setDefaultQueuedCollectionId] = useState<
    string | undefined
  >(undefined);
  const [rescuedCapture, setRescuedCapture] =
    useState<typeof pendingCapture>(null);

  useEffect(() => {
    if (!pendingCapture) return;
    const capture = pendingCapture;
    clearPendingCapture();

    // If the share extension couldn't extract a real title, open SaveProductSheet
    // so the WebView extractor runs and fills in title, image, price properly.
    const hasRealTitle = capture.title && capture.title !== capture.url;
    if (!hasRealTitle) {
      setRescuedCapture(capture);
      return;
    }

    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not signed in');
        await captureUrl(token, {
          collectionId: capture.collectionId,
          sectionId: capture.sectionId,
          url: capture.url,
          title: capture.title!,
        });
      } catch {
        setRescuedCapture(capture);
      }
    })();
  }, [pendingCapture]);

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
          initialParams={autoAdd ? { autoAdd: true } : undefined}
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
      {rescuedCapture && (
        <SaveProductSheet
          key={rescuedCapture.url}
          url={rescuedCapture.url}
          defaultCollectionId={rescuedCapture.collectionId}
          autoApplyCollectionId={rescuedCapture.collectionId}
          onDismiss={() => setRescuedCapture(null)}
        />
      )}
      {invite && <AcceptInviteSheet invite={invite} onClose={clearInvite} />}
    </>
  );
}

function AuthScreen() {
  const { isLoaded, userId } = useAuth();
  const { user } = useUser();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [autoAdd, setAutoAdd] = useState(false);

  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(onboardingKey(userId)).then((val) => {
      setOnboardingDone(val === 'true');
    });
  }, [userId]);

  if (!isLoaded || (userId && !user) || (userId && onboardingDone === null)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!userId) {
    return <SignInScreen />;
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        userId={userId}
        onDone={(shouldAutoAdd) => {
          setAutoAdd(shouldAutoAdd);
          setOnboardingDone(true);
        }}
      />
    );
  }

  return <AppScreens autoAdd={autoAdd} />;
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
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  collectionDock: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  collectionSearch: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 18,
    backgroundColor: '#fff',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  collectionSearchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 15,
    color: '#111827',
  },
  fab: {
    width: 52,
    height: 52,
    borderRadius: 18,
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
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  collectionPreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#e5e7eb',
    overflow: 'hidden',
  },
  previewGridFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewGridFull: {
    flex: 1,
    width: '100%',
  },
  previewGridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  previewGridHalf: {
    flex: 1,
  },
  previewGridLarge: {
    flex: 2,
  },
  previewGridStack: {
    flex: 1,
    gap: 2,
  },
  previewGridSmall: {
    flex: 1,
  },
  collectionCount: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.78)',
  },
  collectionCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  collectionCardInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 10,
    paddingBottom: 12,
  },
  collectionColorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  collectionName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    color: '#111827',
  },
  collectionGrid: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  masonryColumns: { flexDirection: 'row', gap: 12 },
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
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
  },
  skeletonPreview: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: '#e5e7eb',
  },
  skeletonInfo: { padding: 10, paddingBottom: 12 },
  skeletonName: {
    height: 14,
    borderRadius: 5,
    backgroundColor: '#e5e7eb',
    width: '70%',
  },
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
  onboardingContainer: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 60,
    paddingHorizontal: 32,
    paddingBottom: 48,
  },
  onboardingSkip: {
    alignSelf: 'flex-end',
  },
  onboardingSkipText: {
    fontSize: 15,
    color: '#9ca3af',
  },
  onboardingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  onboardingIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  onboardingTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  onboardingBody: {
    fontSize: 16,
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 24,
  },
  onboardingTip: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#ede9fe',
    borderRadius: 12,
    padding: 14,
    alignItems: 'flex-start',
    marginTop: 8,
  },
  onboardingTipText: {
    flex: 1,
    fontSize: 13,
    color: '#4338ca',
    lineHeight: 18,
  },
  onboardingFooter: {
    alignItems: 'center',
    gap: 24,
  },
  onboardingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  onboardingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#e5e7eb',
  },
  onboardingDotActive: {
    backgroundColor: '#6366f1',
    width: 18,
  },
  onboardingButton: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  onboardingButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
