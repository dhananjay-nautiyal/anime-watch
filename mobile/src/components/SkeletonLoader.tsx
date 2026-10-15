import { memo, useRef, useEffect } from 'react'
import { Animated, type ViewStyle } from 'react-native'
import { useColorScheme } from 'react-native'
import { Palette, DarkPalette, BorderRadius } from '@/constants/theme'

interface Props {
  width?: number | string
  height?: number
  borderRadius?: number
  style?: ViewStyle
}

function SkeletonLoader({ width = '100%', height = 16, borderRadius = BorderRadius.sm, style }: Props) {
  const opacity = useRef(new Animated.Value(0.3)).current
  const colorScheme = useColorScheme()
  const colors = colorScheme === 'dark' ? DarkPalette : Palette

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [opacity])

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: colors.surfaceVariant, opacity },
        style,
      ]}
    />
  )
}

export default memo(SkeletonLoader)
