# Saved Pages - Removed from Hamburger Menu

## Overview
These pages have been removed from the hamburger menu navigation but are still accessible programmatically through the app. They remain fully functional and can be accessed via deep linking or other navigation methods.

## Removed Pages

### 1. Home Dashboard
- **File**: `src/screens/HomeScreen.tsx`
- **Purpose**: Main dashboard with vitals, medications, and activity overview
- **Status**: ✅ Still accessible programmatically
- **Reason for removal**: Simplified navigation to focus on core features
- **Note**: Was previously the default landing page, now AIAgents is the default

### 2. Hardware Connection
- **File**: `src/screens/HardwareConnectionScreen.tsx`
- **Purpose**: Device management, HealthKit integration, Bluetooth connections
- **Status**: ✅ Still accessible programmatically
- **Reason for removal**: Advanced feature, not needed in main navigation

### 3. Health Insights
- **File**: `src/screens/InsightsScreen.tsx`
- **Purpose**: AI-powered health analytics and trend analysis
- **Status**: ✅ Still accessible programmatically
- **Reason for removal**: Coming soon feature, not yet fully implemented

### 4. My Health Journey
- **File**: `src/screens/MyJourneyScreen.tsx`
- **Purpose**: Gamification system with milestones and achievements
- **Status**: ✅ Still accessible programmatically
- **Reason for removal**: Future feature, not yet fully implemented

### 5. Family (Already Hidden)
- **File**: `src/screens/FamilyScreen.tsx`
- **Purpose**: Family member management and care coordination
- **Status**: ✅ Still accessible programmatically
- **Reason for removal**: Temporarily hidden, planned for future release

## Current Menu Items

The hamburger menu now only shows these 3 essential pages:

1. **AI Agents** - AI health copilots and chat (⭐ **Default landing page after login**)
2. **Daily Checklist** - Task management and progress tracking
3. **Settings** - App preferences and account management

## Default Landing Page

**Changed from Home Dashboard to AI Agents**: After login and onboarding, users now land directly on the AI Agents page instead of the Home dashboard. This provides immediate access to the core AI health copilot functionality.

## How to Access Removed Pages

### Programmatic Access
```typescript
// Example: Navigate to Home screen programmatically
navigation.navigate('Home');

// Example: Navigate to Hardware Connection
navigation.navigate('HardwareConnection');
```

### Deep Linking
The pages can still be accessed via deep links if configured in the app.

### Future Updates
These pages can be easily re-added to the menu by updating the `drawerItems` array in `src/navigation/DrawerNavigator.tsx`.

## Files Modified

- `src/navigation/DrawerNavigator.tsx` - Updated drawer items array
- `saved-pages/README.md` - This documentation file

## Reverting Changes

To restore all pages to the menu, simply update the `drawerItems` array in `DrawerNavigator.tsx` to include all the original items.
