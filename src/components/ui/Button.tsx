import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle | ViewStyle[];
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
}) => {
  const { theme } = useTheme();

  const getButtonStyles = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      opacity: disabled || loading ? 0.6 : 1,
    };

    // Size styles
    const sizeStyles: Record<string, ViewStyle> = {
      sm: {
        height: 32,
        paddingHorizontal: theme.spacing.sm,
      },
      md: {
        height: 44,
        paddingHorizontal: theme.spacing.md,
      },
      lg: {
        height: 52,
        paddingHorizontal: theme.spacing.lg,
      },
    };

    // Variant styles
    const variantStyles: Record<string, ViewStyle> = {
      primary: {
        backgroundColor: theme.colors.primary,
      },
      secondary: {
        backgroundColor: theme.colors.secondary,
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: theme.colors.primary,
      },
      ghost: {
        backgroundColor: 'transparent',
      },
    };

    // Width style
    const widthStyle: ViewStyle = fullWidth ? { width: '100%' } : {};

    return {
      ...baseStyle,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...widthStyle,
    };
  };

  const getTextStyles = (): TextStyle => {
    const baseTextStyle: TextStyle = {
      fontWeight: '600',
      textAlign: 'center',
    };

    // Size-based text styles
    const sizeTextStyles: Record<string, TextStyle> = {
      sm: {
        fontSize: 14,
      },
      md: {
        fontSize: 16,
      },
      lg: {
        fontSize: 18,
      },
    };

    // Variant-based text colors
    const variantTextStyles: Record<string, TextStyle> = {
      primary: {
        color: theme.colors.onPrimary,
      },
      secondary: {
        color: theme.colors.onSecondary,
      },
      outline: {
        color: theme.colors.primary,
      },
      ghost: {
        color: theme.colors.primary,
      },
    };

    return {
      ...baseTextStyle,
      ...sizeTextStyles[size],
      ...variantTextStyles[variant],
    };
  };

  const getIconSize = (): number => {
    const iconSizes: Record<string, number> = {
      sm: 16,
      md: 18,
      lg: 20,
    };
    return iconSizes[size];
  };

  const getIconColor = (): string => {
    const iconColors: Record<string, string> = {
      primary: theme.colors.onPrimary,
      secondary: theme.colors.onSecondary,
      outline: theme.colors.primary,
      ghost: theme.colors.primary,
    };
    return iconColors[variant];
  };

  const renderContent = () => {
    if (loading) {
      return (
        <ActivityIndicator
          size="small"
          color={getIconColor()}
        />
      );
    }

    const iconElement = icon ? (
      <Ionicons
        name={icon}
        size={getIconSize()}
        color={getIconColor()}
        style={[
          iconPosition === 'left' && title ? { marginRight: theme.spacing.xs } : {},
          iconPosition === 'right' && title ? { marginLeft: theme.spacing.xs } : {},
        ]}
      />
    ) : null;

    return (
      <>
        {iconPosition === 'left' && iconElement}
        {title && (
          <Text style={getTextStyles()}>
            {title}
          </Text>
        )}
        {iconPosition === 'right' && iconElement}
      </>
    );
  };

  return (
    <TouchableOpacity
      style={[getButtonStyles(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {renderContent()}
    </TouchableOpacity>
  );
}; 