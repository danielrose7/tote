import React from "react";
import { useAuth, useOAuth, useUser } from "@clerk/expo";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Providers } from "./src/providers";
import { useAccount, useIsAuthenticated } from "jazz-tools/expo";
import { JazzAccount, Block } from "@tote/schema";
import * as WebBrowser from "expo-web-browser";
import { usePendingUrl } from "./src/hooks/usePendingUrl";
import { SaveProductSheet } from "./src/components/SaveProductSheet";
import { CollectionDetailScreen } from "./src/screens/CollectionDetailScreen";
import { RootStackParamList } from "./src/navigation/types";

WebBrowser.maybeCompleteAuthSession();

const Stack = createNativeStackNavigator<RootStackParamList>();

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

function CollectionListScreen({ navigation }: any) {
  const me = useAccount(JazzAccount, {
    resolve: { root: { blocks: { $each: true } } },
  });
  const { signOut } = useAuth();
  const { user } = useUser();

  if (!me) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const collections =
    me?.root?.blocks?.filter(
      (b: typeof Block.prototype | null) => b?.type === "collection",
    ) ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tote</Text>
        <TouchableOpacity onPress={() => signOut()}>
          <Text style={styles.link}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.greeting}>Hi, {user?.firstName ?? "there"}</Text>

      <FlatList
        data={collections}
        keyExtractor={(item) => item?.$jazz?.id ?? ""}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.collectionCard}
            onPress={() =>
              navigation.navigate("CollectionDetail", {
                collectionId: item.$jazz.id,
                collectionName: item.name ?? "Collection",
              })
            }
            activeOpacity={0.7}
          >
            <View style={[styles.colorDot, { backgroundColor: item?.collectionData?.color ?? "#6366f1" }]} />
            <View style={styles.collectionInfo}>
              <Text style={styles.collectionName}>{item?.name}</Text>
              <Text style={styles.collectionCount}>{item?.children?.length ?? 0} items</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No collections yet</Text>
        }
      />
      <StatusBar style="auto" />
    </View>
  );
}

function AppScreens() {
  const { pendingUrl, clearPendingUrl } = usePendingUrl();

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
          })}
        />
      </Stack.Navigator>
      {pendingUrl && (
        <SaveProductSheet url={pendingUrl} onDismiss={clearPendingUrl} />
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
    padding: 16,
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
  collectionCount: {
    fontSize: 13,
    color: "#9ca3af",
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    color: "#d1d5db",
  },
  empty: {
    textAlign: "center",
    color: "#9ca3af",
    marginTop: 40,
    fontSize: 15,
  },
});
