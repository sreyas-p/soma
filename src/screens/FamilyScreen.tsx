import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import { Card, HeaderButton } from '@/components/ui';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { DrawerParamList } from '@/navigation/types';
import { FamilyMemberModal } from '@/components/ui/FamilyMemberModal';

const { width: screenWidth } = Dimensions.get('window');

type FamilyScreenNavigationProp = DrawerNavigationProp<DrawerParamList, 'Family'>;

// Mock family data
interface FamilyMember {
  id: string;
  name: string;
  age: number;
  avatar: string;
  relationship: 'son' | 'daughter';
  healthScore: number;
  agents: {
    id: string;
    name: string;
    specialty: 'nutrition' | 'fitness' | 'sleep' | 'mindfulness' | 'homework' | 'social';
    avatar: string;
    description: string;
    isActive: boolean;
  }[];
  checklists: {
    id: string;
    title: string;
    description?: string;
    type: 'homework' | 'exercise' | 'chores' | 'hygiene' | 'social' | 'custom';
    scheduledTime?: Date;
    completed: boolean;
    completedAt?: Date;
    streak: number;
  }[];
}

const mockFamilyMembers: FamilyMember[] = [
  {
    id: '1',
    name: 'Emma',
    age: 12,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=emma',
    relationship: 'daughter',
    healthScore: 85,
    agents: [
      {
        id: '1',
        name: 'Nutri',
        specialty: 'nutrition',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nutri',
        description: 'Your nutrition specialist. I help create personalized meal plans, track dietary goals, and provide healthy eating guidance.',
        isActive: true,
      },
      {
        id: '2',
        name: 'Rex',
        specialty: 'fitness',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rex',
        description: 'Your workout and exercise coach. I create custom fitness plans, guide proper form, and track your progress.',
        isActive: true,
      },
      {
        id: '3',
        name: 'Luna',
        specialty: 'sleep',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=luna',
        description: 'Your sleep and wellness guide. I help optimize your sleep patterns, relaxation techniques, and overall rest quality.',
        isActive: true,
      },
    ],
    checklists: [
      {
        id: '1',
        title: 'Eat Breakfast',
        description: 'Start the day with a healthy meal',
        type: 'hygiene',
        completed: true,
        streak: 5,
      },
      {
        id: '2',
        title: 'Brush Teeth',
        description: 'Morning and evening routine',
        type: 'hygiene',
        completed: true,
        streak: 12,
      },
      {
        id: '3',
        title: '30 Minutes of Exercise',
        description: 'Play outside or do indoor activities',
        type: 'exercise',
        completed: false,
        streak: 3,
      },
      {
        id: '4',
        title: 'Drink 8 Glasses of Water',
        description: 'Stay hydrated throughout the day',
        type: 'hygiene',
        completed: false,
        streak: 8,
      },
    ],
  },
  {
    id: '2',
    name: 'Lucas',
    age: 8,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=lucas',
    relationship: 'son',
    healthScore: 92,
    agents: [
      {
        id: '4',
        name: 'Nutri',
        specialty: 'nutrition',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nutri',
        description: 'Your nutrition specialist. I help create personalized meal plans, track dietary goals, and provide healthy eating guidance.',
        isActive: true,
      },
      {
        id: '5',
        name: 'Rex',
        specialty: 'fitness',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rex',
        description: 'Your workout and exercise coach. I create custom fitness plans, guide proper form, and track your progress.',
        isActive: true,
      },
      {
        id: '6',
        name: 'Meni',
        specialty: 'mindfulness',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=meni',
        description: 'Your mindful guidance companion. I provide meditation techniques, stress management, and mental wellness support.',
        isActive: true,
      },
    ],
    checklists: [
      {
        id: '5',
        title: 'Eat Breakfast',
        description: 'Start the day with a healthy meal',
        type: 'hygiene',
        completed: true,
        streak: 15,
      },
      {
        id: '6',
        title: 'Brush Teeth',
        description: 'Morning and evening routine',
        type: 'hygiene',
        completed: false,
        streak: 4,
      },
      {
        id: '7',
        title: '30 Minutes of Exercise',
        description: 'Play outside or do indoor activities',
        type: 'exercise',
        completed: true,
        streak: 6,
      },
      {
        id: '8',
        title: 'Drink 6 Glasses of Water',
        description: 'Stay hydrated throughout the day',
        type: 'hygiene',
        completed: false,
        streak: 9,
      },
    ],
  },
  {
    id: '3',
    name: 'Sophia',
    age: 15,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sophia',
    relationship: 'daughter',
    healthScore: 78,
    agents: [
      {
        id: '7',
        name: 'Meni',
        specialty: 'mindfulness',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=meni',
        description: 'Your mindful guidance companion. I provide meditation techniques, stress management, and mental wellness support.',
        isActive: true,
      },
      {
        id: '8',
        name: 'Nutri',
        specialty: 'nutrition',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nutri',
        description: 'Your nutrition specialist. I help create personalized meal plans, track dietary goals, and provide healthy eating guidance.',
        isActive: true,
      },
      {
        id: '9',
        name: 'Rex',
        specialty: 'fitness',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=rex',
        description: 'Your workout and exercise coach. I create custom fitness plans, guide proper form, and track your progress.',
        isActive: true,
      },
    ],
    checklists: [
      {
        id: '9',
        title: 'Eat Breakfast',
        description: 'Start the day with a healthy meal',
        type: 'hygiene',
        completed: false,
        streak: 2,
      },
      {
        id: '10',
        title: 'Practice Soccer',
        description: 'Team practice at the field',
        type: 'exercise',
        completed: true,
        streak: 7,
      },
      {
        id: '11',
        title: 'Meditation Session',
        description: '10 minutes of mindfulness',
        type: 'custom',
        completed: false,
        streak: 3,
      },
      {
        id: '12',
        title: 'Drink 8 Glasses of Water',
        description: 'Stay hydrated throughout the day',
        type: 'hygiene',
        completed: true,
        streak: 11,
      },
    ],
  },
];

export const FamilyScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<FamilyScreenNavigationProp>();
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <HeaderButton
        icon="menu"
        onPress={() => navigation.openDrawer()}
        accessibilityLabel="Open navigation menu"
        accessibilityHint="Opens the main navigation drawer with app sections"
      />
      <View style={styles.headerTitleContainer}>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>Family</Text>
      </View>
      <View style={styles.headerRight}>
        {/* Placeholder for future header actions */}
      </View>
    </View>
  );

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return theme.colors.semantic.success;
    if (score >= 75) return theme.colors.semantic.warning;
    return theme.colors.semantic.error;
  };

  const getRelationshipIcon = (relationship: 'son' | 'daughter') => {
    return relationship === 'son' ? 'male' : 'female';
  };

  const handleMemberPress = (member: FamilyMember) => {
    setSelectedMember(member);
    setModalVisible(true);
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedMember(null);
  };

  const renderFamilyMemberCard = (member: FamilyMember) => (
    <TouchableOpacity
      key={member.id}
      style={styles.memberCard}
      onPress={() => handleMemberPress(member)}
      activeOpacity={0.7}
    >
      <View style={styles.memberHeader}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: theme.colors.primaryLight }]}>
            <Ionicons
              name={getRelationshipIcon(member.relationship)}
              size={24}
              color={theme.colors.primary}
            />
          </View>
        </View>
        <View style={styles.memberInfo}>
          <Text style={[styles.memberName, { color: theme.colors.text.primary }]}>
            {member.name}
          </Text>
          <Text style={[styles.memberAge, { color: theme.colors.text.secondary }]}>
            {member.age} years old • {member.relationship}
          </Text>
        </View>
        <View style={styles.healthScoreContainer}>
          <View style={[styles.healthScoreCircle, { borderColor: getHealthScoreColor(member.healthScore) }]}>
            <Text style={[styles.healthScore, { color: getHealthScoreColor(member.healthScore) }]}>
              {member.healthScore}
            </Text>
          </View>
        </View>
      </View>
      
      <View style={styles.memberStats}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.colors.text.primary }]}>
            {member.agents.length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
            Agents
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.colors.text.primary }]}>
            {member.checklists.filter(item => item.completed).length}/{member.checklists.length}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
            Tasks
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: theme.colors.text.primary }]}>
            {Math.max(...member.checklists.map(item => item.streak))}
          </Text>
          <Text style={[styles.statLabel, { color: theme.colors.text.secondary }]}>
            Best Streak
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {renderHeader()}
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text.primary }]}>
            Your Family Members
          </Text>
          <Text style={[styles.sectionSubtitle, { color: theme.colors.text.secondary }]}>
            Tap on a family member to view their agents and checklists
          </Text>
          
          <View style={styles.membersContainer}>
            {mockFamilyMembers.map(renderFamilyMemberCard)}
          </View>
        </View>
      </ScrollView>

      <FamilyMemberModal
        visible={modalVisible}
        member={selectedMember}
        onClose={handleCloseModal}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    marginBottom: 24,
    lineHeight: 22,
  },
  membersContainer: {
    gap: 16,
  },
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginRight: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  memberAge: {
    fontSize: 14,
  },
  healthScoreContainer: {
    alignItems: 'center',
  },
  healthScoreCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  healthScore: {
    fontSize: 12,
    fontWeight: '600',
  },
  memberStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
}); 