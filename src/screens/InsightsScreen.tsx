import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '@/theme';
import { Card, HeaderButton } from '@/components/ui';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '@/navigation/types';

type InsightsScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Insights'>;

export const InsightsScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<InsightsScreenNavigationProp>();

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <HeaderButton
        icon="menu"
        onPress={() => navigation.openDrawer()}
        accessibilityLabel="Open navigation menu"
        accessibilityHint="Opens the main navigation drawer with app sections"
      />
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>Health Insights</Text>
      </View>
      <View style={styles.headerRight}>
        {/* Placeholder for future header actions */}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {renderHeader()}
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.section}>
        <Card style={styles.placeholderCard} variant="elevated">
          <Text style={[styles.title, { color: theme.colors.text.primary, ...theme.typography.h3 }]}>
            Health Insights
          </Text>
          <Text style={[styles.description, { color: theme.colors.text.secondary, ...theme.typography.body1 }]}>
            Coming Soon: AI-powered health insights with graphs, anomaly alerts, and explain-like-I'm-five tooltips.
          </Text>
        </Card>
      </View>
    </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: 'transparent',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    width: 50,
  },
  section: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  placeholderCard: {
    padding: 32,
    alignItems: 'center',
  },
  title: {
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    lineHeight: 22,
  },
}); 