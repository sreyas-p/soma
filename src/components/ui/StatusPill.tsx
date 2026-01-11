import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { statusColors } from '@/theme/colors';

interface StatusPillProps {
  status: 'connected' | 'disconnected' | 'syncing' | 'error' | 'optimal' | 'good' | 'caution' | 'critical';
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusPill: React.FC<StatusPillProps> = ({
  status = 'connected',
  text,
  size = 'md',
}) => {
  const { theme } = useTheme();

  const getStatusColor = () => {
    switch (status) {
      case 'connected':
        return statusColors.connected;
      case 'disconnected':
        return statusColors.disconnected;
      case 'syncing':
        return statusColors.syncing;
      case 'error':
        return statusColors.error;
      case 'optimal':
        return statusColors.optimal;
      case 'good':
        return statusColors.good;
      case 'caution':
        return statusColors.caution;
      case 'critical':
        return statusColors.critical;
      default:
        return statusColors.connected;
    }
  };

  const getStatusText = () => {
    if (text) return text;
    
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'syncing':
        return 'Syncing';
      case 'error':
        return 'Error';
      case 'optimal':
        return 'Optimal';
      case 'good':
        return 'Good';
      case 'caution':
        return 'Caution';
      case 'critical':
        return 'Critical';
      default:
        return 'Unknown';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: 8,
          paddingVertical: 4,
          fontSize: 10,
        };
      case 'md':
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          fontSize: 12,
        };
      case 'lg':
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          fontSize: 14,
        };
      default:
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          fontSize: 12,
        };
    }
  };

  const statusColor = getStatusColor();
  const sizeStyles = getSizeStyles();

  const styles = StyleSheet.create({
    container: {
      backgroundColor: `${statusColor}20`, // 20% opacity background
      borderRadius: theme.borderRadius.full,
      borderWidth: 1,
      borderColor: statusColor,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      paddingVertical: sizeStyles.paddingVertical,
      alignSelf: 'flex-start',
    },
    text: {
      color: statusColor,
      fontSize: sizeStyles.fontSize,
      fontWeight: '600',
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{getStatusText()}</Text>
    </View>
  );
}; 