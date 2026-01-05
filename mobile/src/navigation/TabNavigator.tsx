import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { View, Text, StyleSheet } from 'react-native'
import { WorkspacesScreen } from '../screens/WorkspacesScreen'
import { WorkspaceDetailScreen } from '../screens/WorkspaceDetailScreen'
import { SessionsScreen } from '../screens/SessionsScreen'
import { SessionDetailScreen } from '../screens/SessionDetailScreen'
import { SettingsScreen } from '../screens/SettingsScreen'

const Tab = createBottomTabNavigator()
const WorkspacesStack = createNativeStackNavigator()
const SessionsStack = createNativeStackNavigator()

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    WorkspacesTab: '▣',
    SessionsTab: '◈',
    Settings: '⚙',
  }
  return (
    <View style={styles.iconContainer}>
      <Text style={[styles.icon, focused && styles.iconFocused]}>{icons[name] || '?'}</Text>
    </View>
  )
}

function WorkspacesStackNavigator() {
  return (
    <WorkspacesStack.Navigator screenOptions={{ headerShown: false }}>
      <WorkspacesStack.Screen name="WorkspacesList" component={WorkspacesScreen} />
      <WorkspacesStack.Screen name="WorkspaceDetail" component={WorkspaceDetailScreen} />
      <WorkspacesStack.Screen name="SessionDetail" component={SessionDetailScreen} />
    </WorkspacesStack.Navigator>
  )
}

function SessionsStackNavigator() {
  return (
    <SessionsStack.Navigator screenOptions={{ headerShown: false }}>
      <SessionsStack.Screen name="SessionsList" component={SessionsScreen} />
      <SessionsStack.Screen name="SessionDetail" component={SessionDetailScreen} />
    </SessionsStack.Navigator>
  )
}

export function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: '#0a84ff',
        tabBarInactiveTintColor: '#8e8e93',
        headerStyle: {
          backgroundColor: '#000',
          borderBottomWidth: 1,
          borderBottomColor: '#1c1c1e',
        },
        headerTintColor: '#fff',
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#1c1c1e',
        },
      })}
    >
      <Tab.Screen
        name="WorkspacesTab"
        component={WorkspacesStackNavigator}
        options={{ title: 'Workspaces', headerShown: false }}
      />
      <Tab.Screen
        name="SessionsTab"
        component={SessionsStackNavigator}
        options={{ title: 'Sessions', headerShown: false }}
      />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  )
}

const styles = StyleSheet.create({
  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8e8e93',
  },
  iconFocused: {
    color: '#0a84ff',
  },
})
