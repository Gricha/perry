import { useState, useEffect } from 'react'
import { StatusBar } from 'expo-status-bar'
import { View, ActivityIndicator } from 'react-native'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { TabNavigator } from './src/navigation/TabNavigator'
import { NetworkProvider, ConnectionBanner } from './src/lib/network'
import { SetupScreen } from './src/screens/SetupScreen'
import { loadServerConfig, isConfigured } from './src/lib/api'

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
    card: '#000',
    text: '#fff',
    border: '#2c2c2e',
    notification: '#ff3b30',
  },
}

function AppContent() {
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(false)

  useEffect(() => {
    loadServerConfig().then(() => {
      setConfigured(isConfigured())
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0a84ff" />
        <StatusBar style="light" />
      </View>
    )
  }

  if (!configured) {
    return (
      <>
        <SetupScreen onComplete={() => setConfigured(true)} />
        <StatusBar style="light" />
      </>
    )
  }

  return (
    <NetworkProvider>
      <NavigationContainer theme={DarkTheme}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <ConnectionBanner />
          <TabNavigator />
        </View>
      </NavigationContainer>
      <StatusBar style="light" />
    </NetworkProvider>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
