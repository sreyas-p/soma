import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const MODAL_HEIGHT = screenHeight * 0.75;

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

interface FamilyMemberModalProps {
  visible: boolean;
  member: FamilyMember | null;
  onClose: () => void;
}

export const FamilyMemberModal: React.FC<FamilyMemberModalProps> = ({
  visible,
  member,
  onClose,
}) => {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'agents' | 'checklist'>('agents');

  if (!member) return null;

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return theme.colors.semantic.success;
    if (score >= 75) return theme.colors.semantic.warning;
    return theme.colors.semantic.error;
  };

  const getRelationshipIcon = (relationship: 'son' | 'daughter') => {
    return relationship === 'son' ? 'male' : 'female';
  };

  const getAgentIcon = (specialty: string) => {
    switch (specialty) {
      case 'homework':
        return 'library';
      case 'fitness':
        return 'fitness';
      case 'nutrition':
        return 'restaurant';
      case 'sleep':
        return 'moon';
      case 'mindfulness':
        return 'leaf';
      case 'social':
        return 'people';
      default:
        return 'chatbubble';
    }
  };

  const getAgentColor = (specialty: string) => {
    switch (specialty) {
      case 'homework':
        return '#8B5CF6'; // Purple
      case 'fitness':
        return '#10B981'; // Green
      case 'nutrition':
        return '#F59E0B'; // Amber
      case 'sleep':
        return '#3B82F6'; // Blue
      case 'mindfulness':
        return '#06B6D4'; // Cyan
      case 'social':
        return '#EC4899'; // Pink
      default:
        return theme.colors.primary;
    }
  };

  const getChecklistIcon = (type: string) => {
    switch (type) {
      case 'homework':
        return 'library';
      case 'exercise':
        return 'fitness';
      case 'chores':
        return 'home';
      case 'hygiene':
        return 'water';
      case 'social':
        return 'people';
      case 'custom':
        return 'star';
      default:
        return 'checkmark-circle';
    }
  };

  const getChecklistColor = (type: string) => {
    switch (type) {
      case 'homework':
        return '#8B5CF6';
      case 'exercise':
        return '#10B981';
      case 'chores':
        return '#F59E0B';
      case 'hygiene':
        return '#3B82F6';
      case 'social':
        return '#EC4899';
      case 'custom':
        return '#06B6D4';
      default:
        return theme.colors.primary;
    }
  };

  const renderHeader = () => (
    <View style={styles.modalHeader}>
      <View style={styles.memberInfo}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.primaryLight }]}>
          <Ionicons
            name={getRelationshipIcon(member.relationship)}
            size={28}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.memberDetails}>
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
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
      </TouchableOpacity>
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'agents' && { borderBottomColor: theme.colors.primary }
        ]}
        onPress={() => setActiveTab('agents')}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.tabText,
          { color: activeTab === 'agents' ? theme.colors.primary : theme.colors.text.secondary }
        ]}>
          Agents ({member.agents.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.tabButton,
          activeTab === 'checklist' && { borderBottomColor: theme.colors.primary }
        ]}
        onPress={() => setActiveTab('checklist')}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.tabText,
          { color: activeTab === 'checklist' ? theme.colors.primary : theme.colors.text.secondary }
        ]}>
          Checklist ({member.checklists.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderAgents = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.agentsContainer}>
        {member.agents.map((agent) => (
          <View key={agent.id} style={styles.agentCard}>
            <View style={styles.agentHeader}>
              <View style={[styles.agentAvatar, { backgroundColor: getAgentColor(agent.specialty) + '20' }]}>
                <Ionicons
                  name={getAgentIcon(agent.specialty)}
                  size={24}
                  color={getAgentColor(agent.specialty)}
                />
              </View>
              <View style={styles.agentInfo}>
                <Text style={[styles.agentName, { color: theme.colors.text.primary }]}>
                  {agent.name}
                </Text>
                <Text style={[styles.agentSpecialty, { color: theme.colors.text.secondary }]}>
                  {agent.specialty.charAt(0).toUpperCase() + agent.specialty.slice(1)} Specialist
                </Text>
              </View>
              <View style={[styles.statusIndicator, { backgroundColor: agent.isActive ? theme.colors.semantic.success : theme.colors.text.disabled }]} />
            </View>
            <Text style={[styles.agentDescription, { color: theme.colors.text.secondary }]}>
              {agent.description}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderChecklist = () => (
    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.checklistContainer}>
        {member.checklists.map((item) => (
          <View key={item.id} style={styles.checklistItem}>
            <View style={styles.checklistHeader}>
              <View style={[styles.checklistIcon, { backgroundColor: getChecklistColor(item.type) + '20' }]}>
                <Ionicons
                  name={getChecklistIcon(item.type)}
                  size={20}
                  color={getChecklistColor(item.type)}
                />
              </View>
              <View style={styles.checklistInfo}>
                <Text style={[styles.checklistTitle, { color: theme.colors.text.primary }]}>
                  {item.title}
                </Text>
                {item.description && (
                  <Text style={[styles.checklistDescription, { color: theme.colors.text.secondary }]}>
                    {item.description}
                  </Text>
                )}
              </View>
              <View style={styles.checklistStatus}>
                <View style={[
                  styles.completionIndicator,
                  { backgroundColor: item.completed ? theme.colors.semantic.success : theme.colors.border.light }
                ]}>
                  <Ionicons
                    name={item.completed ? 'checkmark' : 'ellipse-outline'}
                    size={16}
                    color={item.completed ? '#FFFFFF' : theme.colors.text.disabled}
                  />
                </View>
              </View>
            </View>
            <View style={styles.checklistFooter}>
              <View style={styles.streakContainer}>
                <Ionicons name="flame" size={14} color={theme.colors.semantic.warning} />
                <Text style={[styles.streakText, { color: theme.colors.text.secondary }]}>
                  {item.streak} day streak
                </Text>
              </View>
              <Text style={[styles.checklistType, { color: theme.colors.text.tertiary }]}>
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.colors.background }]}>
          {renderHeader()}
          {renderTabBar()}
          {activeTab === 'agents' ? renderAgents() : renderChecklist()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: MODAL_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 20,
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
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  healthScore: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  agentsContainer: {
    padding: 20,
    gap: 16,
  },
  agentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  agentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  agentInfo: {
    flex: 1,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  agentSpecialty: {
    fontSize: 14,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  agentDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  checklistContainer: {
    padding: 20,
    gap: 12,
  },
  checklistItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checklistIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checklistInfo: {
    flex: 1,
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 2,
  },
  checklistDescription: {
    fontSize: 14,
    lineHeight: 18,
  },
  checklistStatus: {
    marginLeft: 12,
  },
  completionIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklistFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakText: {
    fontSize: 12,
    marginLeft: 4,
  },
  checklistType: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
}); 