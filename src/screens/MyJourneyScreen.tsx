import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated, TouchableOpacity, Alert } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/theme';
import { useNavigation } from '@react-navigation/native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const NODE_RADIUS = 28;
const NODES_PER_SCREEN = 6; // 5–7 is ideal, 6 is a sweet spot
const PATH_VERTICAL_SPACING = 90;
const PATH_HORIZONTAL_OFFSET = 40;
const MAX_HEARTS = 5;
const XP_PER_LEVEL = 100;

// Dummy journey data
const journeyNodes = [
  { id: '1', title: 'Intro', unlocked: true, completed: true },
  { id: '2', title: 'Vitals', unlocked: true, completed: true },
  { id: '3', title: 'Activity', unlocked: true, completed: false },
  { id: '4', title: 'Nutrition', unlocked: false, completed: false },
  { id: '5', title: 'Sleep', unlocked: false, completed: false },
  { id: '6', title: 'Hydration Challenge', unlocked: false, completed: false, event: true },
  { id: '7', title: 'Mindfulness', unlocked: false, completed: false },
  { id: '8', title: 'Milestone', unlocked: false, completed: false },
];

const STORAGE_KEY = 'myJourneyProgress';

export const MyJourneyScreen = () => {
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [xp, setXp] = useState(60); // Example: 60/100 XP
  const [level, setLevel] = useState(1);
  const [progress, setProgress] = useState(journeyNodes);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  // Load progress from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setHearts(parsed.hearts ?? MAX_HEARTS);
          setXp(parsed.xp ?? 0);
          setLevel(parsed.level ?? 1);
          setProgress(parsed.progress ?? journeyNodes);
        }
      } catch {}
    })();
  }, []);

  // Persist progress
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ hearts, xp, level, progress }));
    // Placeholder: trigger cloud sync here (stub)
  }, [hearts, xp, level, progress]);

  // Level-up animation
  const triggerLevelUp = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Level Up!', 'You reached a new level!');
  };

  // Simulate XP gain and level up
  const gainXp = (amount: number) => {
    let newXp = xp + amount;
    let newLevel = level;
    if (newXp >= XP_PER_LEVEL) {
      newXp -= XP_PER_LEVEL;
      newLevel += 1;
      triggerLevelUp();
    }
    setXp(newXp);
    setLevel(newLevel);
  };

  // Simulate heart loss/regain
  const loseHeart = () => setHearts(h => Math.max(0, h - 1));
  const gainHeart = () => setHearts(h => Math.min(MAX_HEARTS, h + 1));

  // SVG Path generator for winding effect
  const getPathD = () => {
    let d = '';
    for (let i = 0; i < progress.length - 1; i++) {
      const x1 = screenWidth / 2 + (i % 2 === 0 ? -PATH_HORIZONTAL_OFFSET : PATH_HORIZONTAL_OFFSET);
      const y1 = 80 + i * PATH_VERTICAL_SPACING;
      const x2 = screenWidth / 2 + ((i + 1) % 2 === 0 ? -PATH_HORIZONTAL_OFFSET : PATH_HORIZONTAL_OFFSET);
      const y2 = 80 + (i + 1) * PATH_VERTICAL_SPACING;
      d += `M${x1},${y1} Q${screenWidth / 2},${y1 + PATH_VERTICAL_SPACING / 2} ${x2},${y2} `;
    }
    return d;
  };

  // Render journey nodes
  const renderNodes = () => progress.map((node, i) => {
    const x = screenWidth / 2 + (i % 2 === 0 ? -PATH_HORIZONTAL_OFFSET : PATH_HORIZONTAL_OFFSET);
    const y = 80 + i * PATH_VERTICAL_SPACING;
    const isLocked = !node.unlocked;
    const isEvent = !!node.event;
    return (
      <G key={node.id}>
        <Circle
          cx={x}
          cy={y}
          r={NODE_RADIUS}
          fill={isEvent ? theme.colors.semantic.info : isLocked ? theme.colors.border.medium : theme.colors.primary}
          stroke={isLocked ? theme.colors.border.light : theme.colors.primaryDark}
          strokeWidth={isEvent ? 4 : 2}
          opacity={isLocked ? 0.4 : 1}
        />
        {isEvent ? (
          <Ionicons name="water" size={28} color={isLocked ? theme.colors.border.medium : theme.colors.text.inverse} style={{ position: 'absolute', left: x - 14, top: y - 14 }} />
        ) : (
          <Ionicons
            name={isLocked ? 'lock-closed' : node.completed ? 'checkmark-circle' : 'ellipse'}
            size={28}
            color={isLocked ? theme.colors.border.medium : node.completed ? theme.colors.semantic.success : theme.colors.text.inverse}
            style={{ position: 'absolute', left: x - 14, top: y - 14 }}
          />
        )}
      </G>
    );
  });

  // Animated shake for level-up
  const shake = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: [-10, 10],
  });

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header with Hamburger Menu */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="menu" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text.primary }]}>My Journey</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Hearts and XP bar */}
      <View style={styles.topBar}>
        <View style={styles.heartsContainer}>
          {[...Array(MAX_HEARTS)].map((_, i) => (
            <Ionicons
              key={i}
              name={i < hearts ? 'heart' : 'heart-outline'}
              size={24}
              color={i < hearts ? theme.colors.semantic.error : theme.colors.border.medium}
              style={{ marginRight: 4 }}
            />
          ))}
        </View>
        <View style={styles.xpBarContainer}>
          <Text style={[styles.xpLabel, { color: theme.colors.text.secondary }]}>XP</Text>
          <View style={styles.xpBarBg}>
            <Animated.View style={[styles.xpBarFill, { width: `${(xp / XP_PER_LEVEL) * 100}%`, backgroundColor: theme.colors.primary }]} />
          </View>
          <Text style={[styles.xpValue, { color: theme.colors.text.primary }]}>{xp}/{XP_PER_LEVEL}</Text>
        </View>
        <Animated.View style={{ transform: [{ translateX: shake }] }}>
          <Text style={[styles.level, { color: theme.colors.primaryDark }]}>Lv {level}</Text>
        </Animated.View>
      </View>
      {/* Journey Path */}
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: progress.length * PATH_VERTICAL_SPACING + 120 }}>
          <Svg height={progress.length * PATH_VERTICAL_SPACING + 120} width={screenWidth}>
            <Path
              d={getPathD()}
              fill="none"
              stroke={theme.colors.primaryLight}
              strokeWidth={6}
              strokeDasharray="12,8"
            />
            {renderNodes()}
          </Svg>
        </View>
      </ScrollView>
      {/* Demo controls for XP/heart (remove in prod) */}
      <View style={styles.demoBar}>
        <TouchableOpacity style={styles.demoBtn} onPress={() => gainXp(20)}>
          <Ionicons name="flash" size={20} color={theme.colors.text.inverse} />
          <Text style={styles.demoBtnText}>Gain XP</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.demoBtn} onPress={loseHeart}>
          <Ionicons name="heart-dislike" size={20} color={theme.colors.text.inverse} />
          <Text style={styles.demoBtnText}>Miss Task</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.demoBtn} onPress={gainHeart}>
          <Ionicons name="heart" size={20} color={theme.colors.text.inverse} />
          <Text style={styles.demoBtnText}>Regain Heart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  menuButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSpacer: {
    width: 44,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  heartsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  xpBarContainer: {
    flex: 1,
    marginHorizontal: 16,
    alignItems: 'center',
  },
  xpLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  xpBarBg: {
    width: 90,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 2,
  },
  xpBarFill: {
    height: 10,
    borderRadius: 5,
  },
  xpValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  level: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  demoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    zIndex: 10,
  },
  demoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginHorizontal: 4,
  },
  demoBtnText: {
    marginLeft: 6,
    fontWeight: '600',
    fontSize: 14,
  },
}); 