import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
  AccessibilityInfo,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

interface HeaderButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle | ViewStyle[];
  size?: number;
  disabled?: boolean;
}

export const HeaderButton: React.FC<HeaderButtonProps> = ({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  style,
  size = 24,
  disabled = false,
}) => {
  const { theme } = useTheme();
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const focusAnimation = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    // Scale down animation for press feedback
    Animated.spring(scaleAnimation, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    // Scale back to normal
    Animated.spring(scaleAnimation, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleFocus = () => {
    // Show focus ring
    Animated.timing(focusAnimation, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleBlur = () => {
    // Hide focus ring
    Animated.timing(focusAnimation, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    if (disabled) return;
    
    // Provide haptic feedback
    onPress();
    
    // Announce action to screen reader
    AccessibilityInfo.announceForAccessibility(
      accessibilityLabel || 'Button pressed'
    );
  };

  const focusRingOpacity = focusAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const focusRingScale = focusAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.1],
  });

  const styles = StyleSheet.create({
    container: {
      position: 'relative',
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: 'transparent',
    },
    focusRing: {
      position: 'absolute',
      width: '100%',
      height: '100%',
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.colors.border.focus,
      backgroundColor: theme.colors.interactive.focus,
    },
    button: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
    },
    pressed: {
      backgroundColor: theme.colors.interactive.pressed,
    },
    disabled: {
      opacity: 0.5,
    },
  });

  return (
    <TouchableOpacity
      style={[styles.container, style, disabled && styles.disabled]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled,
      }}
    >
      {/* Focus ring */}
      <Animated.View
        style={[
          styles.focusRing,
          {
            opacity: focusRingOpacity,
            transform: [{ scale: focusRingScale }],
          },
        ]}
      />

      {/* Button content */}
      <Animated.View
        style={[
          styles.button,
          {
            transform: [{ scale: scaleAnimation }],
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={size}
          color={disabled ? theme.colors.text.disabled : theme.colors.text.primary}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}; 