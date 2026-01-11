import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase, TABLES } from '@/lib/supabase';
import { User, OnboardingData } from '@/types';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Local storage keys for offline auth
const LOCAL_USERS_KEY = '@soma_local_users';
const LOCAL_CURRENT_USER_KEY = '@soma_current_user';

interface LocalUser {
  id: string;
  email: string;
  password: string; // In production, this should be hashed
  createdAt: string;
  onboardingComplete: boolean;
  userData?: User;
}

interface ProfileUpdateData {
  name?: string;
  age?: number;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  weight?: number;
  height?: number;
  goals?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  clearSession: () => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: ProfileUpdateData) => Promise<{ success: boolean; error?: string }>;
  isOnboardingComplete: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  
  // Ref to track if we're using local auth (checked synchronously to avoid race conditions)
  const isUsingLocalAuth = useRef(false);

  // Dev mode: bypass auth when backend is down
  // Always enabled for now - can be restricted later
  const DEV_MODE = true; // Always allow dev mode for testing
  const DEV_EMAIL = 'dev@soma.app';
  const DEV_PASSWORD = 'dev123';

  // Helper functions for local storage auth
  const getLocalUsers = async (): Promise<LocalUser[]> => {
    try {
      const usersJson = await AsyncStorage.getItem(LOCAL_USERS_KEY);
      return usersJson ? JSON.parse(usersJson) : [];
    } catch (error) {
      console.error('Error getting local users:', error);
      return [];
    }
  };

  const saveLocalUsers = async (users: LocalUser[]): Promise<void> => {
    try {
      await AsyncStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    } catch (error) {
      console.error('Error saving local users:', error);
    }
  };

  const saveCurrentUser = async (localUser: LocalUser): Promise<void> => {
    try {
      await AsyncStorage.setItem(LOCAL_CURRENT_USER_KEY, JSON.stringify(localUser));
    } catch (error) {
      console.error('Error saving current user:', error);
    }
  };

  const loadCurrentUser = async (): Promise<LocalUser | null> => {
    try {
      const userJson = await AsyncStorage.getItem(LOCAL_CURRENT_USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    } catch (error) {
      console.error('Error loading current user:', error);
      return null;
    }
  };

  const clearCurrentUser = async (): Promise<void> => {
    try {
      await AsyncStorage.removeItem(LOCAL_CURRENT_USER_KEY);
    } catch (error) {
      console.error('Error clearing current user:', error);
    }
  };

  const createLocalUser = (email: string, password: string, onboardingComplete: boolean = false): LocalUser => {
    const userId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return {
      id: userId,
      email: email.toLowerCase(),
      password, // In production, hash this
      createdAt: new Date().toISOString(),
      onboardingComplete,
      userData: {
        id: userId,
        name: '',
        email: email.toLowerCase(),
        username: email.split('@')[0],
        goals: '',
        physicalTherapy: '',
        age: 0,
        gender: 'prefer_not_to_say',
        weight: 0,
        height: 0,
        healthScore: 85,
        preferences: {
          units: 'imperial',
          notifications: true,
          dataSharing: false,
        },
      },
    };
  };

  const createMockSession = (localUser: LocalUser): Session => {
    return {
      access_token: `local-token-${localUser.id}`,
      token_type: 'bearer',
      expires_in: 3600 * 24 * 7, // 7 days
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
      refresh_token: `local-refresh-${localUser.id}`,
      user: {
        id: localUser.id,
        email: localUser.email,
        aud: 'authenticated',
        role: 'authenticated',
        email_confirmed_at: localUser.createdAt,
        phone: '',
        confirmed_at: localUser.createdAt,
        last_sign_in_at: new Date().toISOString(),
        app_metadata: {},
        user_metadata: {},
        identities: [],
        created_at: localUser.createdAt,
        updated_at: new Date().toISOString(),
      },
    } as Session;
  };

  // Helper function to check if error is a network error
  const isNetworkError = (error: any): boolean => {
    if (!error) return false;
    const errorMessage = error.message?.toLowerCase() || '';
    const errorString = String(error).toLowerCase();
    return (
      errorMessage.includes('network') ||
      errorMessage.includes('fetch') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorString.includes('network') ||
      errorString.includes('fetch') ||
      errorString.includes('connection')
    );
  };

  // Load authentication state on app start
  useEffect(() => {
    // Check for local user FIRST and set the flag before anything else
    const checkLocalUserFirst = async () => {
      const localUser = await loadCurrentUser();
      if (localUser) {
        console.log('✅ Found locally stored user:', localUser.email);
        isUsingLocalAuth.current = true; // Set this IMMEDIATELY
      }
      return localUser;
    };
    
    const initAuth = async () => {
      // First, check for locally stored user
      const localUser = await checkLocalUserFirst();
      if (localUser) {
        if (localUser.userData) {
          setUser(localUser.userData);
        }
        setSession(createMockSession(localUser));
        setIsOnboardingComplete(localUser.onboardingComplete);
        setIsLoading(false);
        return;
      }

      // Then try Supabase with timeout
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 3000);
      });

      try {
        const sessionPromise = supabase.auth.getSession();
        const result = await Promise.race([sessionPromise, timeoutPromise]);
        
        if (!result) {
          console.warn('⚠️ Backend timeout - ready for local auth');
          setIsLoading(false);
          return;
        }

        const { data: { session }, error } = result;
        
        if (error) {
          if (isNetworkError(error)) {
            console.warn('⚠️ Network error getting session - local auth available');
          } else {
            console.error('Auth session error:', error);
          }
          setIsLoading(false);
          return;
        }
        
        setSession(session);
        
        if (session?.user) {
          try {
            await loadUserProfile(session.user.id);
          } catch (profileError) {
            if (isNetworkError(profileError)) {
              console.warn('⚠️ Network error loading profile - continuing without profile');
            } else {
              console.error('Error loading user profile:', profileError);
            }
          }
        } else {
          setUser(null);
          setIsOnboardingComplete(false);
        }
        setIsLoading(false);
      } catch (error) {
        if (isNetworkError(error)) {
          console.warn('⚠️ Network error getting session - local auth available');
        } else {
          console.error('Auth session error:', error);
        }
        setIsLoading(false);
      }
    };

    // Pre-check for local user to set flag before subscription fires
    loadCurrentUser().then(localUser => {
      if (localUser) {
        isUsingLocalAuth.current = true;
        console.log('🔒 Pre-set isUsingLocalAuth to true');
      }
    });

    initAuth();

    // Listen for auth changes from Supabase
    // IMPORTANT: Don't let Supabase overwrite local sessions
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log('🔔 Auth state change event:', event, 'session:', !!newSession, 'isUsingLocalAuth:', isUsingLocalAuth.current);
        
        // Check synchronously if we're using local auth - don't let Supabase events affect us
        if (isUsingLocalAuth.current) {
          console.log('🔔 Ignoring Supabase auth change - using local session (sync check)');
          return;
        }
        
        // Also check async in case the flag hasn't been set yet due to race condition
        const localUser = await loadCurrentUser();
        if (localUser) {
          console.log('🔔 Ignoring Supabase auth change - found local user (async check)');
          isUsingLocalAuth.current = true;
          // Restore local session state if it was overwritten
          if (localUser.userData) {
            setUser(localUser.userData);
          }
          setSession(createMockSession(localUser));
          setIsOnboardingComplete(localUser.onboardingComplete);
          setIsLoading(false);
          return;
        }
        
        try {
          // Only update state if this is a real Supabase session change
          setSession(newSession);
          
          if (newSession?.user) {
            await loadUserProfile(newSession.user.id);
          } else {
            setUser(null);
            setIsOnboardingComplete(false);
          }
        } catch (error) {
          if (isNetworkError(error)) {
            console.warn('⚠️ Network error in auth state change:', error);
          } else {
            console.error('Error in auth state change:', error);
          }
        } finally {
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      // Check if user has completed onboarding - get the most recent entry
      const { data: onboardingData, error: onboardingError } = await supabase
        .from(TABLES.ONBOARDING_DATA)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      // Handle network errors gracefully
      if (onboardingError && isNetworkError(onboardingError)) {
        console.warn('⚠️ Network error loading onboarding data - skipping');
        return;
      }

      if (onboardingError) {
        if (onboardingError.code === 'PGRST116') {
          // User hasn't completed onboarding yet - set minimal user and mark onboarding as incomplete
          const { data: { user: authUser } } = await supabase.auth.getUser();
          if (authUser) {
            const minimalUser: User = {
              id: userId,
              name: '',
              email: authUser.email || '',
              username: '',
              goals: '',
              physicalTherapy: '',
              age: 0,
              gender: 'prefer_not_to_say',
              weight: 0,
              height: 0,
              healthScore: 85,
              preferences: {
                units: 'imperial',
                notifications: true,
                dataSharing: false,
              },
            };
            setUser(minimalUser);
            setIsOnboardingComplete(false);
          }
          return;
        } else {
          console.error('Error loading onboarding data:', onboardingError);
          return;
        }
      }

      if (onboardingData) {
        // User has completed onboarding, load full profile
        let { data: profileData, error: profileError } = await supabase
          .from(TABLES.USER_PROFILES)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (profileError) {
          if (isNetworkError(profileError)) {
            console.warn('⚠️ Network error loading profile - skipping');
            return;
          }
          
          if (profileError.code === 'PGRST116') {
            // Profile is missing, create it from onboarding data
            const { error: createProfileError } = await supabase
              .from(TABLES.USER_PROFILES)
              .insert({
                user_id: userId,
                name: onboardingData.name,
                username: onboardingData.name.toLowerCase().replace(/\s+/g, ''),
                health_score: 85,
                preferences: {
                  units: 'imperial',
                  notifications: true,
                  dataSharing: false,
                },
              });

            if (createProfileError) {
              if (isNetworkError(createProfileError)) {
                console.warn('⚠️ Network error creating profile - skipping');
                return;
              }
              console.error('Failed to create missing profile:', createProfileError);
              return;
            }

            // Now load the newly created profile
            const { data: newProfileData, error: newProfileError } = await supabase
              .from(TABLES.USER_PROFILES)
              .select('*')
              .eq('user_id', userId)
              .single();

            if (newProfileError) {
              console.error('Error loading newly created profile:', newProfileError);
              return;
            }

            profileData = newProfileData;
          } else {
            console.error('Error loading user profile:', profileError);
            return;
          }
        }

        // Convert database data to app User type
        const appUser: User = {
          id: userId,
          name: profileData.name,
          email: session?.user?.email || '',
          username: profileData.username,
          goals: onboardingData.goals,
          physicalTherapy: onboardingData.physical_therapy,
          age: onboardingData.age,
          gender: onboardingData.gender,
          weight: onboardingData.weight,
          height: onboardingData.height,
          healthScore: profileData.health_score,
          preferences: profileData.preferences,
        };

        setUser(appUser);
        setIsOnboardingComplete(true);
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const signUp = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Dev mode bypass
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();
      console.log('🔐 Sign up attempt:', { email: trimmedEmail, password: trimmedPassword, DEV_MODE, DEV_EMAIL, DEV_PASSWORD });
      
      if (DEV_MODE && trimmedEmail === DEV_EMAIL.toLowerCase() && trimmedPassword === DEV_PASSWORD) {
        console.log('✅ Dev mode signup successful');
        const mockUser: User = {
          id: 'dev-user-123',
          name: 'Dev User',
          email: DEV_EMAIL,
          username: 'devuser',
          goals: 'Test health goals',
          physicalTherapy: 'None',
          age: 30,
          gender: 'prefer_not_to_say',
          weight: 150,
          height: 68,
          healthScore: 85,
          preferences: {
            units: 'imperial',
            notifications: true,
            dataSharing: false,
          },
        };
        
        // Create a mock session for dev mode
        const mockSession: Session = {
          access_token: 'dev-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'dev-refresh-token',
          user: {
            id: 'dev-user-123',
            email: DEV_EMAIL,
            aud: 'authenticated',
            role: 'authenticated',
            email_confirmed_at: new Date().toISOString(),
            phone: '',
            confirmed_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
            identities: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        } as Session;
        
        setUser(mockUser);
        setSession(mockSession);
        setIsOnboardingComplete(true);
        setIsLoading(false);
        return { success: true };
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        // Use warn for network errors since we handle them gracefully
        if (isNetworkError(error)) {
          console.warn('⚠️ Sign up network error (will use local fallback):', error.message);
          console.log('🔄 Network error - falling back to local signup');
          return await localSignUp(trimmedEmail, trimmedPassword);
        }
        
        console.warn('Sign up error:', error.message);
        
        // Provide more user-friendly error messages
        let errorMessage = error.message;
        if (error.message.includes('already registered')) {
          errorMessage = 'This email is already registered. Please sign in instead.';
        } else if (error.message.includes('password')) {
          errorMessage = 'Password must be at least 6 characters long.';
        } else if (error.message.includes('email')) {
          errorMessage = 'Please enter a valid email address.';
        }
        return { success: false, error: errorMessage };
      }

      if (data.user) {
        // User created successfully - they will be redirected to onboarding
        console.log('✅ User created successfully:', data.user.id);
        return { success: true };
      }

      return { success: false, error: 'Failed to create user. Please try again.' };
    } catch (error) {
      // Use warn for network errors since we handle them gracefully
      if (isNetworkError(error)) {
        console.warn('⚠️ Sign up network error (will use local fallback):', error instanceof Error ? error.message : error);
        console.log('🔄 Network error - falling back to local signup');
        return await localSignUp(email.trim().toLowerCase(), password.trim());
      }
      console.warn('Sign up error:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { success: false, error: errorMsg };
    }
  };

  // Local signup function for offline use
  const localSignUp = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Please enter a valid email address.' };
      }

      // Validate password length
      if (password.length < 6) {
        return { success: false, error: 'Password must be at least 6 characters long.' };
      }

      // Check if user already exists locally
      const existingUsers = await getLocalUsers();
      const existingUser = existingUsers.find(u => u.email === email);
      
      if (existingUser) {
        return { success: false, error: 'This email is already registered. Please sign in instead.' };
      }

      // Create new local user
      const newUser = createLocalUser(email, password, false);
      existingUsers.push(newUser);
      await saveLocalUsers(existingUsers);
      await saveCurrentUser(newUser);

      // Set app state - IMPORTANT: Set all state synchronously to avoid race conditions
      console.log('🔧 Setting local signup state...', 'onboardingComplete:', false);
      if (newUser.userData) {
        setUser(newUser.userData);
      }
      const mockSession = createMockSession(newUser);
      setSession(mockSession);
      setIsOnboardingComplete(false);
      setIsLoading(false);
      isUsingLocalAuth.current = true; // Mark that we're using local auth

      console.log('✅ Local signup successful:', email, 'user:', newUser.userData?.name || 'no name', 'session:', !!mockSession);
      // Force a small delay to ensure state updates propagate
      setTimeout(() => {
        console.log('🔍 State check after local signup - should show onboarding');
      }, 100);
      return { success: true };
    } catch (error) {
      console.error('Local signup error:', error);
      return { success: false, error: 'Failed to create account locally. Please try again.' };
    }
  };

  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Dev mode bypass
      const trimmedEmail = email.trim().toLowerCase();
      const trimmedPassword = password.trim();
      console.log('🔐 Sign in attempt:', { email: trimmedEmail, password: trimmedPassword, DEV_MODE, DEV_EMAIL, DEV_PASSWORD });
      
      if (DEV_MODE && trimmedEmail === DEV_EMAIL.toLowerCase() && trimmedPassword === DEV_PASSWORD) {
        console.log('✅ Dev mode login successful');
        const mockUser: User = {
          id: 'dev-user-123',
          name: 'Dev User',
          email: DEV_EMAIL,
          username: 'devuser',
          goals: 'Test health goals',
          physicalTherapy: 'None',
          age: 30,
          gender: 'prefer_not_to_say',
          weight: 150,
          height: 68,
          healthScore: 85,
          preferences: {
            units: 'imperial',
            notifications: true,
            dataSharing: false,
          },
        };
        
        // Create a mock session for dev mode
        const mockSession: Session = {
          access_token: 'dev-token',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: 'dev-refresh-token',
          user: {
            id: 'dev-user-123',
            email: DEV_EMAIL,
            aud: 'authenticated',
            role: 'authenticated',
            email_confirmed_at: new Date().toISOString(),
            phone: '',
            confirmed_at: new Date().toISOString(),
            last_sign_in_at: new Date().toISOString(),
            app_metadata: {},
            user_metadata: {},
            identities: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        } as Session;
        
        console.log('🔧 Setting dev mode state...');
        setUser(mockUser);
        setSession(mockSession);
        setIsOnboardingComplete(true);
        setIsLoading(false);
        console.log('✅ Dev mode state set - user:', mockUser.name, 'onboarding:', true);
        // Force a small delay to ensure state updates propagate
        setTimeout(() => {
          console.log('🔍 State check after dev login - should be ready');
        }, 100);
        return { success: true };
      } else if (DEV_MODE && trimmedEmail === DEV_EMAIL.toLowerCase()) {
        console.log('❌ Dev mode: email matches but password incorrect');
        return { success: false, error: `Dev mode: Password should be "${DEV_PASSWORD}"` };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        // Use warn for network errors since we handle them gracefully
        if (isNetworkError(error)) {
          console.warn('⚠️ Sign in network error (will use local fallback):', error.message);
          console.log('🔄 Network error - trying local signin');
          return await localSignIn(trimmedEmail, trimmedPassword);
        }
        
        console.warn('Sign in error:', error.message);
        
        // Provide more user-friendly error messages
        let errorMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage = 'Please check your email and confirm your account before signing in.';
        }
        return { success: false, error: errorMessage };
      }

      if (data.user) {
        // User signed in successfully, profile will be loaded by auth state change
        // The loadUserProfile function will handle whether they need onboarding or go to dashboard
        console.log('✅ User signed in successfully:', data.user.id);
        return { success: true };
      }

      return { success: false, error: 'Failed to sign in. Please try again.' };
    } catch (error) {
      // Use warn for network errors since we handle them gracefully
      if (isNetworkError(error)) {
        console.warn('⚠️ Sign in network error (will use local fallback):', error instanceof Error ? error.message : error);
        console.log('🔄 Network error - trying local signin');
        return await localSignIn(email.trim().toLowerCase(), password.trim());
      }
      console.warn('Sign in error:', error);
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      return { success: false, error: errorMsg };
    }
  };

  // Local signin function for offline use
  const localSignIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const users = await getLocalUsers();
      const user = users.find(u => u.email === email);

      if (!user) {
        return { success: false, error: 'No account found with this email. Please sign up first.' };
      }

      if (user.password !== password) {
        return { success: false, error: 'Invalid password. Please try again.' };
      }

      // Update and save current user
      await saveCurrentUser(user);

      // Set app state
      console.log('🔧 Setting local signin state...', 'onboardingComplete:', user.onboardingComplete);
      if (user.userData) {
        setUser(user.userData);
      }
      setSession(createMockSession(user));
      setIsOnboardingComplete(user.onboardingComplete);
      setIsLoading(false);
      isUsingLocalAuth.current = true; // Mark that we're using local auth

      console.log('✅ Local signin successful:', email, 'onboarding:', user.onboardingComplete);
      // Force a small delay to ensure state updates propagate
      setTimeout(() => {
        console.log('🔍 State check after local signin - should be ready');
      }, 100);
      return { success: true };
    } catch (error) {
      console.error('Local signin error:', error);
      return { success: false, error: 'Failed to sign in locally. Please try again.' };
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      isUsingLocalAuth.current = false; // Clear local auth flag
      await supabase.auth.signOut();
      await clearCurrentUser();
      setUser(null);
      setIsOnboardingComplete(false);
      setSession(null);
    } catch (error) {
      console.error('Sign out error:', error);
      // Still clear local state even if Supabase fails
      isUsingLocalAuth.current = false;
      await clearCurrentUser();
      setUser(null);
      setIsOnboardingComplete(false);
      setSession(null);
    }
  };

  const clearSession = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
      await clearCurrentUser();
      setUser(null);
      setIsOnboardingComplete(false);
      setSession(null);
    } catch (error) {
      console.error('Clear session error:', error);
      // Still clear local state even if Supabase fails
      await clearCurrentUser();
      setUser(null);
      setIsOnboardingComplete(false);
      setSession(null);
    }
  };

  const completeOnboarding = async (data: OnboardingData): Promise<{ success: boolean; error?: string }> => {
    console.log('🎯 completeOnboarding called with:', data.name);
    console.log('🎯 Current session:', session?.user?.id, 'access_token starts with:', session?.access_token?.substring(0, 20));
    
    if (!session?.user) {
      console.log('❌ No session or user found');
      return { success: false, error: 'No authenticated user' };
    }

    try {
      const userId = session.user.id;
      console.log('🎯 User ID:', userId);

      // Check if this is a local user (session has local token)
      const isLocalUser = session.access_token?.startsWith('local-token-');
      console.log('🎯 Is local user:', isLocalUser);

      if (isLocalUser) {
        // Update local user with onboarding data
        const users = await getLocalUsers();
        console.log('🎯 Found', users.length, 'local users');
        const userIndex = users.findIndex(u => u.id === userId);
        console.log('🎯 User index:', userIndex);
        
        if (userIndex !== -1) {
          const updatedUser: User = {
            id: userId,
            name: data.name,
            email: users[userIndex].email,
            username: data.name.toLowerCase().replace(/\s+/g, ''),
            goals: data.goals,
            physicalTherapy: data.physicalTherapy,
            age: data.age,
            gender: data.gender,
            weight: data.weight,
            height: data.height,
            healthScore: 85,
            preferences: {
              units: 'imperial',
              notifications: true,
              dataSharing: false,
            },
          };

          users[userIndex].userData = updatedUser;
          users[userIndex].onboardingComplete = true;
          await saveLocalUsers(users);
          await saveCurrentUser(users[userIndex]);

          setUser(updatedUser);
          setIsOnboardingComplete(true);

          console.log('✅ Local onboarding completed:', data.name);
          return { success: true };
        } else {
          // User not found in storage - create them now
          console.log('⚠️ Local user not found, creating new entry');
          const newLocalUser: LocalUser = {
            id: userId,
            email: session.user.email || '',
            password: '', // We don't have the password here
            createdAt: new Date().toISOString(),
            onboardingComplete: true,
            userData: {
              id: userId,
              name: data.name,
              email: session.user.email || '',
              username: data.name.toLowerCase().replace(/\s+/g, ''),
              goals: data.goals,
              physicalTherapy: data.physicalTherapy,
              age: data.age,
              gender: data.gender,
              weight: data.weight,
              height: data.height,
              healthScore: 85,
              preferences: {
                units: 'imperial',
                notifications: true,
                dataSharing: false,
              },
            },
          };
          
          users.push(newLocalUser);
          await saveLocalUsers(users);
          await saveCurrentUser(newLocalUser);

          setUser(newLocalUser.userData!);
          setIsOnboardingComplete(true);

          console.log('✅ Created new local user and completed onboarding:', data.name);
          return { success: true };
        }
      }

      // Try Supabase for remote users
      // Insert onboarding data (including comprehensive data if available)
      const comprehensiveData = (data as any).comprehensiveData;
      const insertData: any = {
        user_id: userId,
        name: data.name,
        goals: data.goals,
        physical_therapy: data.physicalTherapy,
        age: data.age,
        gender: data.gender,
        weight: data.weight,
        height: data.height,
      };
      
      // Add comprehensive data if provided
      if (comprehensiveData) {
        insertData.comprehensive_data = comprehensiveData;
        
        // Add structured historical data (genetic conditions, diseases, family history)
        if (comprehensiveData.historicalData) {
          insertData.historical_data = comprehensiveData.historicalData;
        }
        
        // Add structured recent data (current weight, height, medications)
        if (comprehensiveData.recentData) {
          insertData.recent_data = comprehensiveData.recentData;
        }
        
        // Add user goals data
        if (comprehensiveData.userGoals) {
          insertData.user_goals = comprehensiveData.userGoals;
        }
        
        // Add data source indicator
        if (comprehensiveData.dataSource) {
          insertData.data_source = comprehensiveData.dataSource;
        }
      }
      
      // Add timeout for Supabase calls
      const timeoutPromise = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
        return Promise.race([
          promise,
          new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error('Request timeout - please check your connection')), ms)
          )
        ]);
      };

      // First check if onboarding data already exists for this user
      const { data: existingData } = await timeoutPromise(
        supabase.from(TABLES.ONBOARDING_DATA).select('id').eq('user_id', userId).limit(1),
        5000
      ).catch(() => ({ data: null }));

      let onboardingError;
      if (existingData && existingData.length > 0) {
        // Update existing record
        const { error } = await timeoutPromise(
          supabase.from(TABLES.ONBOARDING_DATA).update(insertData).eq('user_id', userId),
          10000
        );
        onboardingError = error;
      } else {
        // Insert new record
        const { error } = await timeoutPromise(
          supabase.from(TABLES.ONBOARDING_DATA).insert(insertData),
          10000
        );
        onboardingError = error;
      }

      if (onboardingError) {
        console.error('Error saving onboarding data:', onboardingError);
        
        // If network error, save locally
        if (isNetworkError(onboardingError)) {
          console.log('🔄 Network error - saving onboarding locally');
          const users = await getLocalUsers();
          const userIndex = users.findIndex(u => u.id === userId);
          
          if (userIndex !== -1) {
            const updatedUser: User = {
              id: userId,
              name: data.name,
              email: users[userIndex].email,
              username: data.name.toLowerCase().replace(/\s+/g, ''),
              goals: data.goals,
              physicalTherapy: data.physicalTherapy,
              age: data.age,
              gender: data.gender,
              weight: data.weight,
              height: data.height,
              healthScore: 85,
              preferences: {
                units: 'imperial',
                notifications: true,
                dataSharing: false,
              },
            };

            users[userIndex].userData = updatedUser;
            users[userIndex].onboardingComplete = true;
            await saveLocalUsers(users);
            await saveCurrentUser(users[userIndex]);

            setUser(updatedUser);
            setIsOnboardingComplete(true);

            return { success: true };
          }
        }
        
        return { success: false, error: onboardingError.message };
      }

      // Create or update user profile (upsert to handle existing profiles)
      const { error: profileError } = await timeoutPromise(
        supabase.from(TABLES.USER_PROFILES).upsert({
          user_id: userId,
          name: data.name,
          username: data.name.toLowerCase().replace(/\s+/g, ''),
          health_score: 85,
          preferences: {
            units: 'imperial',
            notifications: true,
            data_sharing: false,
          },
        }, { onConflict: 'user_id' }),
        10000 // 10 second timeout
      );

      if (profileError) {
        console.error('Error creating user profile:', profileError);
        // If it's a duplicate key error, ignore it and continue
        if (!profileError.message?.includes('duplicate')) {
          return { success: false, error: profileError.message };
        }
      }

      // Reload user profile (with timeout)
      try {
        await timeoutPromise(loadUserProfile(userId), 10000);
      } catch (loadError) {
        console.warn('Profile load timed out, continuing anyway');
      }
      
      // Set onboarding complete immediately to trigger navigation
      setIsOnboardingComplete(true);
      
      return { success: true };
    } catch (error) {
      console.error('Error completing onboarding:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const updateProfile = async (data: ProfileUpdateData): Promise<{ success: boolean; error?: string }> => {
    console.log('📝 updateProfile called with:', data);
    
    if (!session?.user || !user) {
      return { success: false, error: 'No authenticated user' };
    }

    try {
      const userId = session.user.id;
      const isLocalUser = session.access_token?.startsWith('local-token-');

      // Update local state immediately for responsive UI
      const updatedUser: User = {
        ...user,
        name: data.name ?? user.name,
        age: data.age ?? user.age,
        gender: data.gender ?? user.gender,
        weight: data.weight ?? user.weight,
        height: data.height ?? user.height,
        goals: data.goals ?? user.goals,
      };

      if (isLocalUser) {
        // Update local user storage
        const users = await getLocalUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex !== -1) {
          users[userIndex].userData = updatedUser;
          await saveLocalUsers(users);
          await saveCurrentUser(users[userIndex]);
        }

        setUser(updatedUser);
        console.log('✅ Local profile updated:', updatedUser.name);
        return { success: true };
      }

      // Update Supabase for remote users
      // Update onboarding_data table
      const { error: onboardingError } = await supabase
        .from(TABLES.ONBOARDING_DATA)
        .update({
          name: data.name ?? user.name,
          age: data.age ?? user.age,
          gender: data.gender ?? user.gender,
          weight: data.weight ?? user.weight,
          height: data.height ?? user.height,
          goals: data.goals ?? user.goals,
        })
        .eq('user_id', userId);

      if (onboardingError) {
        console.error('Error updating onboarding data:', onboardingError);
        return { success: false, error: onboardingError.message };
      }

      // Update user_profiles table
      const { error: profileError } = await supabase
        .from(TABLES.USER_PROFILES)
        .update({
          name: data.name ?? user.name,
        })
        .eq('user_id', userId);

      if (profileError) {
        console.warn('Error updating user profile:', profileError);
        // Don't fail the whole operation if profile update fails
      }

      setUser(updatedUser);
      console.log('✅ Supabase profile updated:', updatedUser.name);
      return { success: true };
    } catch (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: 'An unexpected error occurred' };
    }
  };

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    signUp,
    signIn,
    signOut,
    clearSession,
    completeOnboarding,
    updateProfile,
    isOnboardingComplete,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 