import { NavigatorScreenParams } from '@react-navigation/native';

// Main drawer navigation params
export type DrawerParamList = {
  Home: undefined;
  AIAgents: undefined;
  HardwareConnection: undefined;
  Insights: undefined;
  DailyChecklist: undefined;
  MyJourney: undefined;
  Settings: undefined;
  Family: undefined;
  ConnectedDevices: undefined;
};

// Stack navigation params for screens that need sub-navigation
export type RootStackParamList = {
  Auth: undefined;
  Main: NavigatorScreenParams<DrawerParamList>;
  AgentChat: { agentId: string; agentName: string };
  DeviceDetails: { deviceId: string };
  InsightDetails: { insightId: string };
  Profile: undefined;
};

// Auth stack params
export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  OAuth: { provider: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
} 