import { Tabs } from 'expo-router'
import { Platform } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { DarkPalette, BottomTabHeight } from '@/constants/theme'

export default function TabLayout() {
  const colors = DarkPalette
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceContainer,
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'android' ? BottomTabHeight : BottomTabHeight + 12,
          paddingBottom: Platform.OS === 'android' ? 8 : 0,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="home-variant" color={color} size={size} /> }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="magnify" color={color} size={size} /> }} />
      <Tabs.Screen name="library" options={{ title: 'Library', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="bookmark" color={color} size={size} /> }} />
      <Tabs.Screen name="downloads" options={{ title: 'Downloads', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="download" color={color} size={size} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <MaterialCommunityIcons name="cog" color={color} size={size} /> }} />
    </Tabs>
  )
}