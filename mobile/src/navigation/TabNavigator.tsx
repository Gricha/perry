import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { HomeScreen } from '../screens/HomeScreen'
import { WorkspaceDetailScreen } from '../screens/WorkspaceDetailScreen'
import { SessionChatScreen } from '../screens/SessionChatScreen'
import { TerminalScreen } from '../screens/TerminalScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { WorkspaceSettingsScreen } from '../screens/WorkspaceSettingsScreen'

const Stack = createNativeStackNavigator()

export function TabNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#000' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="WorkspaceDetail" component={WorkspaceDetailScreen} />
      <Stack.Screen name="WorkspaceSettings" component={WorkspaceSettingsScreen} />
      <Stack.Screen name="SessionChat" component={SessionChatScreen} />
      <Stack.Screen name="Terminal" component={TerminalScreen} />
    </Stack.Navigator>
  )
}
