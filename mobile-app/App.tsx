import React, { useEffect, useRef } from "react";
import { useOAuth, useUser } from "@clerk/expo";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  Image,
} from "react-native";
import { GestureHandlerRootView, Swipeable } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Providers } from "./src/providers";
import { useAccount, useIsAuthenticated } from "jazz-tools/expo";
import { JazzAccount, Block } from "@tote/schema";
import * as WebBrowser from "expo-web-browser";
import { usePendingUrl } from "./src/hooks/usePendingUrl";
import { useInviteLink } from "./src/hooks/useInviteLink";
import { SaveProductSheet } from "./src/components/SaveProductSheet";
import { AcceptInviteSheet } from "./src/components/AcceptInviteSheet";
import { CollectionDetailScreen } from "./src/screens/CollectionDetailScreen";
import { AccountSettingsScreen } from "./src/screens/AccountSettingsScreen";
import { RootStackParamList } from "./src/navigation/types";
import { Ionicons } from "@expo/vector-icons";
import { cleanupPublishedClonesFromRoot } from "./src/lib/shareCollection";

WebBrowser.maybeCompleteAuthSession();

const Stack = createNativeStackNavigator<RootStackParamList>();
const HOME_COLLECTION_CARD_HEIGHT = 56;

function SignInScreen() {
  const { startOAuthFlow: startGoogle } = useOAuth({ strategy: "oauth_google" });
  const { startOAuthFlow: startApple } = useOAuth({ strategy: "oauth_apple" });

  async function handleSignIn(startFlow: typeof startGoogle) {
    try {
      const { createdSessionId, setActive } = await startFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err) {
      console.error("OAuth error:", err);
    }
  }

  return (
    <View style={styles.centered}>
      <Text style={styles.title}>Tote</Text>
      <Text style={styles.subtitle}>Your personal product collection</Text>
      <TouchableOpacity
        style={styles.button}
        onPress={() => handleSignIn(startGoogle)}
      >
        <Text style={styles.buttonText}>Continue with Google</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, styles.buttonApple]}
        onPress={() => handleSignIn(startApple)}
      >
        <Text style={styles.buttonText}>Continue with Apple</Text>
      </TouchableOpacity>
    </View>
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
          extrapolate: "clamp",
        });
        return (
          <Animated.View style={[styles.deleteAction, { transform: [{ translateX }] }]}>
            <TouchableOpacity style={styles.deleteActionInner} onPress={onDelete}>
              <Text style={styles.deleteActionText}>Delete</Text>
            </TouchableOpacity>
          </Animated.View>
        );
      }}
      rightThreshold={40}
      overshootRight={false}
    >
      <TouchableOpacity style={styles.collectionCard} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.colorDot, { backgroundColor: item?.collectionData?.color ?? "#6366f1" }]} />
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

function CollectionListScreen({ navigation }: any) {
  const me = useAccount(JazzAccount, {
    resolve: { root: { blocks: { $each: true } } },
  });
  const { user } = useUser();
  if (!me) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  useEffect(() => {
    cleanupPublishedClonesFromRoot(me.root?.blocks);
  }, [me.root?.blocks]);

  const blocksLoaded = me.root?.blocks != null;
  const collections =
    me?.root?.blocks?.filter(
      (b: typeof Block.prototype | null) =>
        b?.type === "collection" && !b?.collectionData?.sourceId,
    ) ?? [];

  function deleteCollection(item: typeof Block.prototype) {
    const list = me?.root?.blocks;
    if (!list) return;
    const idx = list.findIndex((b) => b?.$jazz?.id === item.$jazz.id);
    if (idx !== -1) list.$jazz.splice(idx, 1);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tote</Text>
        <TouchableOpacity onPress={() => navigation.navigate("AccountSettings")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          {user?.imageUrl ? (
            <Image source={{ uri: user.imageUrl }} style={styles.avatar} />
          ) : (
            <Ionicons name="person-circle-outline" size={28} color="#6b7280" />
          )}
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>Hi, {user?.firstName ?? "there"}</Text>

      <FlatList
        data={collections}
        keyExtractor={(item) => item?.$jazz?.id ?? ""}
        renderItem={({ item }) => (
          <CollectionCard
            item={item}
            onPress={() =>
              navigation.navigate("CollectionDetail", {
                collectionId: item.$jazz.id,
                collectionName: item.name ?? "Collection",
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
            <Text style={styles.empty}>No collections yet</Text>
          )
        }
      />
      <StatusBar style="auto" />
    </View>
  );
}

function AppScreens() {
  const { pendingUrl, clearPendingUrl } = usePendingUrl();
  const { invite, clearInvite } = useInviteLink();

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
          options={({ route }) => ({
            title: route.params.collectionName,
            headerBackTitle: "Collections",
            fullScreenGestureEnabled: false,
          })}
        />
        <Stack.Screen
          name="AccountSettings"
          component={AccountSettingsScreen}
          options={{ title: "Account", headerBackTitle: "Collections" }}
        />
      </Stack.Navigator>
      {pendingUrl && (
        <SaveProductSheet url={pendingUrl} onDismiss={clearPendingUrl} />
      )}
      {invite && (
        <AcceptInviteSheet
          invite={invite}
          onClose={clearInvite}
        />
      )}
    </>
  );
}

function AuthScreen() {
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) {
    return <AppScreens />;
  }

  return <SignInScreen />;
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
    backgroundColor: "#fff",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  centered: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    marginTop: 8,
    marginBottom: 32,
  },
  greeting: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginBottom: 12,
  },
  buttonApple: {
    backgroundColor: "#000",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    color: "#6366f1",
    fontSize: 16,
  },
  collectionCard: {
    flexDirection: "row",
    alignItems: "center",
    height: HOME_COLLECTION_CARD_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
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
    fontWeight: "600",
  },
  chevron: {
    fontSize: 20,
    color: "#d1d5db",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 40,
    fontSize: 15,
  },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    height: HOME_COLLECTION_CARD_HEIGHT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 10,
    gap: 12,
  },
  skeletonDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#e5e7eb" },
  skeletonInfo: { flex: 1 },
  skeletonName: { height: 14, borderRadius: 5, backgroundColor: "#e5e7eb", width: "50%" },
  skeletonChevron: { width: 12, height: 14, borderRadius: 4, backgroundColor: "#f3f4f6" },
  deleteAction: { width: 80, backgroundColor: "#ef4444" },
  deleteActionInner: { flex: 1, justifyContent: "center", alignItems: "center" },
  deleteActionText: { color: "#fff", fontSize: 14, fontWeight: "600" },
});
