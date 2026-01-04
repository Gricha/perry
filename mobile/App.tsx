import { StatusBar } from 'expo-status-bar'
import { View } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { TabNavigator } from './src/navigation/TabNavigator'
import { NetworkProvider, ConnectionBanner } from './src/lib/network'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30000,
    },
  },
})

const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0a84ff',
    background: '#000',
    card: '#1c1c1e',
    text: '#fff',
    border: '#2c2c2e',
    notification: '#ff3b30',
  },
}

function AppContent() {
  const insets = useSafeAreaInsets()
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={{ paddingTop: insets.top }}>
        <ConnectionBanner />
      </View>
      <TabNavigator />
      <StatusBar style="light" />
    </View>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NetworkProvider>
          <NavigationContainer theme={DarkTheme}>
            <AppContent />
          </NavigationContainer>
        </NetworkProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
