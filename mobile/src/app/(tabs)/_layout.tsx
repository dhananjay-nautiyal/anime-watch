import { Tabs } from 'expo-router'
import { useColorScheme, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { Palette, DarkPalette, BottomTabHeight } from '@/constants/theme'

type IconName = keyof typeof MaterialCommunityIcons.glyphMap

const TAB_ICONS: Record<string, { focused: IconName; unfocused: IconName }> = {
  index: { focused: 'home', unfocused: 'home-outline' },
  search: { focused: 'magnify', unfocused: 'magnify' },
  watchlist: { focused: 'bookmark', unfocused: 'bookmark-outline' },
  favorites: { focused: 'heart', unfocused: 'heart-outline' },
  profile: { focused: 'account', unfocused: 'account-outline' },
}

export default function TabLayout() {
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'
  const colors = isDark ? DarkPalette : Palette
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceContainer,
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'android' ? BottomTabHeight + insets.bottom : BottomTabHeight + 12,
          paddingBottom: Platform.OS === 'android' ? 8 + insets.bottom : 0,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarHideOnKeyboard: true,
        tabBarIcon: ({ focused, color, size }) => {
          const set = TAB_ICONS[route.name] ?? { focused: 'circle', unfocused: 'circle-outline' }
          const name = focused ? set.focused : set.unfocused
          return <MaterialCommunityIcons name={name} size={size} color={color} />
        },
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home tab',
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarAccessibilityLabel: 'Search tab',
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: 'Watchlist',
          tabBarAccessibilityLabel: 'Watchlist tab',
        }}
      />
      <Tabs.Screen
        name="favorites"
        options={{
          title: 'Favorites',
          tabBarAccessibilityLabel: 'Favorites tab',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile tab',
        }}
      />
    </Tabs>
  )
}
