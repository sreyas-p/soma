import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { useHealthKit } from '@/hooks/useHealthKit';

interface HealthPermissionRequestProps {
  onPermissionGranted?: () => void;
  onPermissionDenied?: () => void;
}

export const HealthPermissionRequest: React.FC<HealthPermissionRequestProps> = ({
  onPermissionGranted,
  onPermissionDenied,
}) => {
  const { theme } = useTheme();
  const {
    isAvailable,
    isConnected,
    isConnecting,
    connect,
    error
  } = useHealthKit();

  const [isRequesting, setIsRequesting] = useState(false);

  const handleConnect = async () => {
    if (!isAvailable) {
      Alert.alert(
        'HealthKit Not Available',
        'Apple Health is only available on iOS devices.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsRequesting(true);

    try {
      const success = await connect();

      if (success) {
        Alert.alert(
          'Connected to Apple Health!',
          'Your health data is now being synced with the app.',
          [
            {
              text: 'Great!',
              onPress: () => onPermissionGranted?.()
            }
          ]
        );
      } else {
        Alert.alert(
          'Connection Failed',
          'Unable to connect to Apple Health. Please check your permissions and try again.',
          [
            { text: 'OK', onPress: () => onPermissionDenied?.() }
          ]
        );
      }
    } catch (err) {
      Alert.alert(
        'Error',
        'An unexpected error occurred while connecting to Apple Health.',
        [
          { text: 'OK', onPress: () => onPermissionDenied?.() }
        ]
      );
    } finally {
      setIsRequesting(false);
    }
  };

  if (isConnected) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.semantic.success + '20' }]}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.success }]}>
          <Ionicons name="checkmark-circle" size={24} color="white" />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.colors.semantic.success }]}>
            Connected to Apple Health
          </Text>
          <Text style={[styles.description, { color: theme.colors.text.secondary }]}>
            Your health data is being synced automatically
          </Text>
        </View>
      </View>
    );
  }

  if (!isAvailable) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.semantic.warning + '20' }]}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.warning }]}>
          <Ionicons name="alert-circle" size={24} color="white" />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: theme.colors.semantic.warning }]}>
            Apple Health Not Available
          </Text>
          <Text style={[styles.description, { color: theme.colors.text.secondary }]}>
            This feature is only available on iOS devices
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.primary + '20' }]}>
      <View style={[styles.iconContainer, { backgroundColor: theme.colors.primary }]}>
        <Ionicons name="heart" size={24} color="white" />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: theme.colors.primary }]}>
          Connect to Apple Health
        </Text>
        <Text style={[styles.description, { color: theme.colors.text.secondary }]}>
          Sync your health data to get personalized insights and recommendations
        </Text>

        <TouchableOpacity
          style={[styles.connectButton, { backgroundColor: theme.colors.primary }]}
          onPress={handleConnect}
          disabled={isRequesting || isConnecting}
        >
          {isRequesting || isConnecting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Ionicons name="link" size={16} color="white" />
              <Text style={styles.connectButtonText}>Connect Now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Error Display */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: theme.colors.semantic.error + '20' }]}>
          <Ionicons name="alert-circle" size={16} color={theme.colors.semantic.error} />
          <Text style={[styles.errorText, { color: theme.colors.semantic.error }]}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  connectButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
  },
});
