import React from 'react';
import {
  View,
  ViewStyle,
  StyleProp,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import { useTheme } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: TouchableOpacityProps['onPress'];
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'md',
  onPress,
  disabled = false,
  style,
  testID,
}) => {
  const { theme } = useTheme();

  const getCardStyles = () => {
    const baseStyle = {
      borderRadius: theme.borderRadius.md,
      backgroundColor: theme.colors.surface,
    };

    const paddingStyles = {
      none: {},
      sm: { padding: theme.spacing.sm },
      md: { padding: theme.spacing.md },
      lg: { padding: theme.spacing.lg },
    };

    const variantStyles = {
      default: {},
      elevated: {
        shadowColor: theme.colors.text.primary,
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
      },
      outlined: {
        borderWidth: 1,
        borderColor: theme.colors.border,
      },
    };

    return {
      ...baseStyle,
      ...paddingStyles[padding],
      ...variantStyles[variant],
      opacity: disabled ? 0.6 : 1,
    };
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={[getCardStyles(), style]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.7}
        accessible={true}
        accessibilityRole="button"
        testID={testID}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[getCardStyles(), style]} testID={testID}>
      {children}
    </View>
  );
}; 