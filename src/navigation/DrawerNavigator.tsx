import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TouchableWithoutFeedback,
  Animated,
  Dimensions,
  Pressable,
  Platform,
  Modal,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useAuth } from '@/contexts/AuthContext';
import { DrawerParamList } from './types';

// Import screens
import {
  HomeScreen,
  HardwareConnectionScreen,
  HealthTrendsScreen,
  InsightsScreen,
  DailyChecklistScreen,
  MyJourneyScreen,
  SettingsScreen,
  ConnectedDevicesScreen,
  FoodScannerScreen,
  // FamilyScreen, // Temporarily hidden from menu
} from '@/screens';

const Drawer = createDrawerNavigator<DrawerParamList>();
const { width: screenWidth } = Dimensions.get('window');

// Navigation items with icons only - Main pages shown in menu
// The checklist is now the home page with embedded AI agents
// Apple Health is now integrated into Settings page
// REMOVED FROM MENU (but still accessible programmatically):
// - Home: Home Dashboard (was default)
// - AIAgents: Now embedded in checklist
// - HardwareConnection: Hardware Connection  
// - Insights: Health Insights
// - MyJourney: My Health Journey
// - ConnectedDevices: Now in Settings
// - Family: Family (already hidden)
const drawerItems = [
  { name: 'DailyChecklist', icon: 'checkmark-circle', label: 'My Checklist' },
  { name: 'FoodScanner', icon: 'scan', label: 'Food Scanner' },
  { name: 'HealthTrends', icon: 'analytics', label: 'Health Trends' },
  { name: 'Settings', icon: 'settings', label: 'Settings' },
] as const;

interface CustomDrawerContentProps {
  state: any;
  navigation: any;
  descriptors: any;
}

const CustomDrawerContent: React.FC<CustomDrawerContentProps> = (props) => {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { user, signOut } = useAuth();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [longPressedIndex, setLongPressedIndex] = useState<number | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const animationValues = useRef(
    drawerItems.map(() => new Animated.Value(0))
  ).current;
  const labelOpacity = useRef(new Animated.Value(0)).current;

  // Theme toggle handler with smooth cycling
  const handleThemeToggle = () => {
    const nextTheme = themeMode === 'system' ? 'dark' : 
                    themeMode === 'dark' ? 'light' : 'system';
    setThemeMode(nextTheme);
  };

  // Logout handlers
  const handleLogoutPress = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutModal(false);
    signOut();
  };

  const handleLogoutCancel = () => {
    setShowLogoutModal(false);
  };

  const getThemeIcon = () => {
    switch (themeMode) {
      case 'dark': return 'moon';
      case 'light': return 'sunny';
      default: return 'phone-portrait';
    }
  };

  const getThemeLabel = () => {
    switch (themeMode) {
      case 'dark': return 'Dark Mode';
      case 'light': return 'Light Mode';
      default: return 'Auto Theme';
    }
  };

  // Handle long press to show label
  const handleLongPressIn = (index: number) => {
    setLongPressedIndex(index);
    
    // Animate label appearance
    Animated.timing(labelOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleLongPressOut = () => {
    setLongPressedIndex(null);
    
    // Animate label disappearance
    Animated.timing(labelOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Handle press animations
  const handlePressIn = (index: number) => {
    Animated.spring(animationValues[index], {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (index: number) => {
    Animated.spring(animationValues[index], {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const styles = StyleSheet.create({
    drawerContainer: {
      flex: 1,
    },
    blurContainer: {
      flex: 1,
      backgroundColor: Platform.OS === 'ios' ? 'transparent' : `${theme.colors.background}CC`,
    },
    drawerContent: {
      flex: 1,
      paddingTop: 60,
      paddingHorizontal: 24,
    },
    userSection: {
      alignItems: 'center',
      paddingVertical: 32,
      marginBottom: 24,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border.light,
    },
    avatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    avatarText: {
      ...theme.typography.h3,
      color: theme.colors.onPrimary,
      fontWeight: theme.typography.h3.fontWeight,
    },
    userName: {
      ...theme.typography.cardTitle,
      color: theme.colors.text.primary,
      marginBottom: 4,
    },

    navigationSection: {
      flex: 1,
      paddingVertical: 16,
    },
    navItem: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 56,
      height: 56,
      borderRadius: 16,
      marginBottom: 16,
      position: 'relative',
    },
    navItemActive: {
      backgroundColor: theme.colors.primary,
    },
    navItemInactive: {
      backgroundColor: 'transparent',
    },
    navItemPressed: {
      backgroundColor: theme.colors.interactive.pressed,
    },
    labelContainer: {
      position: 'absolute',
      left: 72,
      top: '50%',
      backgroundColor: theme.colors.text.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      marginTop: -16,
      shadowColor: theme.colors.text.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    labelText: {
      ...theme.typography.caption,
      color: theme.colors.text.inverse,
      fontSize: 12,
    },
    labelArrow: {
      position: 'absolute',
      left: -8,
      top: '50%',
      marginTop: -4,
      width: 0,
      height: 0,
      borderTopWidth: 4,
      borderBottomWidth: 4,
      borderRightWidth: 8,
      borderTopColor: 'transparent',
      borderBottomColor: 'transparent',
      borderRightColor: theme.colors.text.primary,
    },
    bottomSection: {
      paddingVertical: 24,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border.light,
    },
    themeToggle: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 56,
      height: 56,
      borderRadius: 16,
      backgroundColor: theme.colors.interactive.hover,
      marginBottom: 16,
    },
    expoIndicator: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.colors.semantic.success,
      borderRadius: 12,
      alignSelf: 'center',
    },
    expoText: {
      ...theme.typography.caption,
      fontSize: 10,
      fontWeight: '600',
    },
    // Logout Modal Styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: theme.colors.background,
      borderRadius: 16,
      padding: 24,
      margin: 20,
      minWidth: 280,
      shadowColor: theme.colors.text.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    modalTitle: {
      ...theme.typography.h4,
      color: theme.colors.text.primary,
      textAlign: 'center',
      marginBottom: 16,
    },
    modalMessage: {
      ...theme.typography.body2,
      color: theme.colors.text.secondary,
      textAlign: 'center',
      marginBottom: 24,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelButton: {
      backgroundColor: theme.colors.interactive.hover,
    },
    logoutButton: {
      backgroundColor: theme.colors.semantic.error,
    },
    cancelButtonText: {
      ...theme.typography.button,
      color: theme.colors.text.primary,
    },
    logoutButtonText: {
      ...theme.typography.button,
      color: theme.colors.text.inverse,
    },
  });

  return (
    <View style={styles.drawerContainer}>
      {/* Blurred backdrop */}
      <BlurView
        intensity={Platform.OS === 'ios' ? 100 : 50}
        style={styles.blurContainer}
        tint={theme.mode === 'dark' ? 'dark' : 'light'}
      >
        <DrawerContentScrollView
          {...props}
          contentContainerStyle={styles.drawerContent}
          showsVerticalScrollIndicator={false}
        >
          {/* User Profile Section - Clickable for Logout */}
          <TouchableOpacity
            style={styles.userSection}
            onPress={handleLogoutPress}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <Text style={styles.userName}>{user?.name || 'User'}</Text>
          </TouchableOpacity>

          {/* Navigation Items - Icons Only */}
          <View style={styles.navigationSection}>
            {drawerItems.map((item, index) => {
              const isActive = props.state.index === index;
              const animatedScale = animationValues[index].interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0.95],
              });

              return (
                <View key={item.name}>
                  <Pressable
                    style={[
                      styles.navItem,
                      isActive ? styles.navItemActive : styles.navItemInactive,
                    ]}
                    onPress={() => {
                      props.navigation.navigate(item.name);
                      props.navigation.closeDrawer();
                    }}
                    onPressIn={() => handlePressIn(index)}
                    onLongPress={() => handleLongPressIn(index)}
                    onPressOut={() => {
                      handlePressOut(index);
                      if (longPressedIndex === index) {
                        handleLongPressOut();
                      }
                    }}
                  >
                    <Animated.View style={{ transform: [{ scale: animatedScale }] }}>
                      <Ionicons
                        name={item.icon as any}
                        size={24}
                        color={
                          isActive 
                            ? theme.colors.onPrimary 
                            : theme.colors.text.primary
                        }
                      />
                    </Animated.View>

                    {/* Label on Long Press */}
                    {longPressedIndex === index && (
                      <Animated.View 
                        style={[
                          styles.labelContainer,
                          { opacity: labelOpacity }
                        ]}
                      >
                        <View style={styles.labelArrow} />
                        <Text style={styles.labelText}>{item.label}</Text>
                      </Animated.View>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* Bottom Section */}
          <View style={styles.bottomSection}>
            {/* Theme Toggle */}
            <TouchableOpacity
              style={styles.themeToggle}
              onPress={handleThemeToggle}
              activeOpacity={0.7}
            >
              <Ionicons
                name={getThemeIcon()}
                size={24}
                color={theme.colors.text.primary}
              />
            </TouchableOpacity>

            {/* Expo Go Compatibility Indicator */}
            <View style={styles.expoIndicator}>
              <Text style={styles.expoText}>EXPO GO READY</Text>
            </View>
          </View>
        </DrawerContentScrollView>
      </BlurView>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleLogoutCancel}
      >
        <TouchableWithoutFeedback onPress={handleLogoutCancel}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Logout</Text>
                <Text style={styles.modalMessage}>
                  Are you sure you want to logout? You'll need to sign in again to access your health data.
                </Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={handleLogoutCancel}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.logoutButton]}
                    onPress={handleLogoutConfirm}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.logoutButtonText}>Logout</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};

export const DrawerNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'slide',
        drawerStyle: {
          width: screenWidth * 0.28, // Narrow drawer for icon-only design
          backgroundColor: 'transparent',
        },
        overlayColor: 'transparent', // Let BlurView handle the overlay
        sceneContainerStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      {/* DailyChecklist is now the default home page with embedded AI agents */}
      <Drawer.Screen name="DailyChecklist" component={DailyChecklistScreen} />
      <Drawer.Screen name="FoodScanner" component={FoodScannerScreen} />
      <Drawer.Screen name="HealthTrends" component={HealthTrendsScreen} />
      <Drawer.Screen name="ConnectedDevices" component={ConnectedDevicesScreen} />
      <Drawer.Screen name="Settings" component={SettingsScreen} />
      {/* Hidden pages - accessible programmatically but not in menu */}
      <Drawer.Screen name="Home" component={HomeScreen} />
      <Drawer.Screen name="HardwareConnection" component={HardwareConnectionScreen} />
      <Drawer.Screen name="Insights" component={InsightsScreen} />
      <Drawer.Screen name="MyJourney" component={MyJourneyScreen} />
      {/* <Drawer.Screen name="Family" component={FamilyScreen} /> // Temporarily hidden */}
    </Drawer.Navigator>
  );
}; 