import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, StatusBar, AppState, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { initDatabase } from './src/database/schema';
import { useStore } from './src/store';
import { Colors, Typography, Spacing } from './src/theme';

import DashboardScreen from './src/screens/DashboardScreen';
import AssetListScreen from './src/screens/AssetListScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import AssetDetailScreen from './src/screens/AssetDetailScreen';
import CategoryAssetsScreen from './src/screens/CategoryAssetsScreen';
import CashFlowScreen from './src/screens/CashFlowScreen';
import LoginScreen from './src/screens/LoginScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const TAB_ICONS = {
  Dashboard: 'home',
  Assets: 'layers',
  Settings: 'settings',
};

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: Colors.background }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopWidth: 1,
          borderTopColor: Colors.surfaceBorder,
          height: Platform.OS === 'ios' ? 62 + insets.bottom : 68,
          paddingBottom: Platform.OS === 'ios' ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
        tabBarIcon: ({ color, focused, size }) => (
          <View style={focused ? styles.activeTabIcon : null}>
            <Feather name={TAB_ICONS[route.name]} size={20} color={color} />
          </View>
        ),
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Assets" component={AssetListScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [appState, setAppState] = useState(AppState.currentState);
  const loadData = useStore(state => state.loadData);

  const handleAuthenticate = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access NetWorth',
        fallbackLabel: 'Use Passcode',
        cancelLabel: 'Cancel'
      });
      if (result.success) setIsAuthenticated(true);
    } else {
      setIsAuthenticated(true);
    }
  };

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (isAuthenticated) {
           setIsAuthenticated(false);
           handleAuthenticate();
        }
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, [appState, isAuthenticated]);

  useEffect(() => {
    const setup = async () => {
      try {
        await initDatabase();
        await loadData();
        await handleAuthenticate();
      } catch (e) {
        console.error('Setup error', e);
      } finally {
        setIsInitializing(false);
      }
    };
    setup();
  }, []);

  if (isInitializing) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <View style={styles.splashLogo}>
          <Feather name="trending-up" size={32} color={Colors.accent} />
        </View>
        <Text style={styles.splashName}>NetWorth</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <LoginScreen onAuthenticate={handleAuthenticate} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider style={{ backgroundColor: Colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <NavigationContainer
        theme={{
          dark: true,
          colors: {
            primary: Colors.accent,
            background: Colors.background,
            card: Colors.background,
            text: Colors.textPrimary,
            border: Colors.surfaceBorder,
            notification: Colors.accent,
          },
          fonts: {
            regular: { fontFamily: Typography.fontFamily, fontWeight: Typography.regular },
            medium: { fontFamily: Typography.fontFamily, fontWeight: Typography.medium },
            bold: { fontFamily: Typography.fontFamily, fontWeight: Typography.bold },
            heavy: { fontFamily: Typography.fontFamily, fontWeight: Typography.bold },
          },
        }}
      >
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="AssetDetail"
            component={AssetDetailScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CategoryAssets"
            component={CategoryAssetsScreen}
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="CashFlow"
            component={CashFlowScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
      
      {/* Privacy Screen Cover when inactive/background */}
      {appState !== 'active' && isAuthenticated && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999 }]}>
          <View style={styles.privacyCover}>
            <Feather name="shield" size={48} color={Colors.accent} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.privacyText}>App Content Protected</Text>
          </View>
        </View>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  splashLogo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1.5,
    borderColor: 'rgba(0,200,120,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  splashName: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  activeTabIcon: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 8,
    padding: 4,
  },
  privacyCover: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  privacyText: {
    fontSize: Typography.lg,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
});
