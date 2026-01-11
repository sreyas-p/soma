import 'react-native-gesture-handler';
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '@/theme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DrawerNavigator } from '@/navigation/DrawerNavigator';
import { LoginScreen } from '@/screens/LoginScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
import { View, ActivityIndicator, LogBox, Text, StyleSheet } from 'react-native';

// Ignore expected network errors (we handle them gracefully with local auth fallback)
LogBox.ignoreLogs([
  'Network request failed',
  'AuthRetryableFetchError',
  'TypeError: Network request failed',
]);

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('💥 Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>{this.state.error?.message || 'Unknown error'}</Text>
          <Text style={styles.errorHint}>Check the console for more details</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// App content component that uses theme and auth context
const AppContent: React.FC = () => {
  const { isDark } = useTheme();
  const { user, session, isLoading, isOnboardingComplete } = useAuth();
  const [forceRender, setForceRender] = React.useState(0);

  // Safety timeout - if loading takes too long, force render
  React.useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Loading timeout - forcing render');
        setForceRender(prev => prev + 1);
      }, 5000); // 5 second timeout
      return () => clearTimeout(timeout);
    }
  }, [isLoading]);

  // Debug logging to track app state
  console.log('📱 AppContent render - isLoading:', isLoading, 'session:', !!session, 'user:', !!user, 'onboarding:', isOnboardingComplete, 'forceRender:', forceRender);

  if (isLoading && forceRender === 0) {
    console.log('📱 Showing loading spinner');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#000' : '#fff' }}>
        <ActivityIndicator size="large" color="#4F7FFF" />
        <Text style={{ color: isDark ? '#fff' : '#000', marginTop: 16 }}>Loading...</Text>
      </View>
    );
  }

  // Show login if not authenticated (check both session and user for dev mode)
  if (!session && !user) {
    console.log('📱 Showing LoginScreen');
    return (
      <ErrorBoundary>
        <LoginScreen />
      </ErrorBoundary>
    );
  }

  // Show onboarding if authenticated but onboarding not complete
  if (!isOnboardingComplete) {
    console.log('📱 Showing OnboardingScreen - user:', user?.name || 'no name', 'session:', !!session);
    return (
      <ErrorBoundary>
        <OnboardingScreen />
      </ErrorBoundary>
    );
  }

  // Show main app if authenticated and onboarding complete
  console.log('📱 Showing DrawerNavigator (main app) - user:', user?.name || 'no name');
  try {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <NavigationContainer>
            <DrawerNavigator />
            <StatusBar style={isDark ? 'light' : 'dark'} />
          </NavigationContainer>
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  } catch (error) {
    console.error('💥 Error rendering DrawerNavigator:', error);
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#000' : '#fff' }}>
        <Text style={{ color: isDark ? '#fff' : '#000' }}>Error loading app. Check console.</Text>
      </View>
    );
  }
};

// Main App component with theme and auth providers
export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  errorHint: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
}); 