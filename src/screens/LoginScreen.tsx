import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { StatusBar } from 'expo-status-bar';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const LoginScreen: React.FC = () => {
  const { theme } = useTheme();
  const { signUp, signIn, user, session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // If user becomes authenticated while on this screen, don't render anything
  // App.tsx will handle navigation
  if (user || session) {
    console.log('🔒 LoginScreen: User is authenticated, not rendering');
    return null;
  }

  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      console.log('⚠️ Form validation failed: empty email or password');
      return;
    }
    
    setIsLoading(true);
    console.log(`🔄 Starting ${isSignUp ? 'sign up' : 'sign in'} process...`);
    
    try {
      let result;
      
      if (isSignUp) {
        result = await signUp(email.trim(), password);
        console.log('📝 Sign up result:', result);
        
        if (result.success) {
          // User is now authenticated - App.tsx will automatically navigate to OnboardingScreen
          // Don't show alert or switch modes - just let the navigation happen
          console.log('✅ Sign up successful - navigation will happen automatically');
          // Clear the form
          setEmail('');
          setPassword('');
          return; // Don't show error alert
        }
      } else {
        result = await signIn(email.trim(), password);
        console.log('🔑 Sign in result:', result);
      }

      if (!result.success) {
        console.error('❌ Auth failed:', result.error);
        Alert.alert(
          isSignUp ? 'Sign Up Failed' : 'Sign In Failed',
          result.error || 'An unexpected error occurred',
          [{ text: 'OK' }]
        );
      } else {
        console.log('✅ Auth successful - navigation should happen automatically');
      }
    } catch (error) {
      console.error('💥 Auth error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setEmail('');
    setPassword('');
  };

  const isFormValid = email.trim() && password.trim();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <StatusBar style="dark" />
      
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Animated.View 
          style={[
            styles.content,
            { opacity: fadeAnim }
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="heart" size={48} color="white" />
            </View>
            <Text style={[styles.title, { color: theme.colors.text.primary }]}>
              Welcome to Soma
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.text.secondary }]}>
              Your AI-powered health copilot
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>
                Email
              </Text>
              <View style={[
                styles.inputWrapper,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: email.trim() ? theme.colors.primary : theme.colors.border.light
                }
              ]}>
                <Ionicons 
                  name="mail-outline" 
                  size={20} 
                  color={email.trim() ? theme.colors.primary : theme.colors.text.tertiary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text.primary }]}
                  placeholder="Enter your email"
                  placeholderTextColor={theme.colors.text.disabled}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: theme.colors.text.secondary }]}>
                Password
              </Text>
              <View style={[
                styles.inputWrapper,
                { 
                  backgroundColor: theme.colors.surface,
                  borderColor: password.trim() ? theme.colors.primary : theme.colors.border.light
                }
              ]}>
                <Ionicons 
                  name="lock-closed-outline" 
                  size={20} 
                  color={password.trim() ? theme.colors.primary : theme.colors.text.tertiary} 
                  style={styles.inputIcon}
                />
                <TextInput
                  style={[styles.textInput, { color: theme.colors.text.primary }]}
                  placeholder={isSignUp ? "Create a password" : "Enter your password"}
                  placeholderTextColor={theme.colors.text.disabled}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.passwordToggle}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color={theme.colors.text.tertiary} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Auth Button */}
            <TouchableOpacity
              style={[
                styles.authButton,
                { 
                  backgroundColor: isFormValid ? theme.colors.primary : theme.colors.border.light,
                  opacity: isFormValid ? 1 : 0.5
                }
              ]}
              onPress={handleAuth}
              disabled={!isFormValid || isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <Ionicons name="refresh" size={20} color="white" style={styles.spinning} />
                  <Text style={styles.authButtonText}>
                    {isSignUp ? 'Creating Account...' : 'Signing In...'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.authButtonText}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Toggle Auth Mode */}
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={toggleAuthMode}
              activeOpacity={0.7}
            >
              <Text style={[styles.toggleText, { color: theme.colors.primary }]}>
                {isSignUp 
                  ? 'Already have an account? Sign In' 
                  : "Don't have an account? Sign Up"
                }
              </Text>
            </TouchableOpacity>

            {/* Info Text */}
            <Text style={[styles.infoText, { color: theme.colors.text.tertiary }]}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>

            {/* Dev Mode Hint */}
            <Text style={[styles.devHint, { color: theme.colors.primary }]}>
              Dev Mode: Use dev@soma.app / dev123
            </Text>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 64,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#4F7FFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  passwordToggle: {
    padding: 4,
  },
  authButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#4F7FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  authButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  toggleButton: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinning: {
    marginRight: 8,
  },
  infoText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 18,
  },
  devHint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '600',
  },
}); 