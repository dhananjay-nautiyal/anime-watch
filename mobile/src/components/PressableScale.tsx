import { useRef, memo } from 'react'
import { Animated, TouchableWithoutFeedback, type ViewProps } from 'react-native'
import * as Haptics from 'expo-haptics'

interface Props extends ViewProps {
  onPress?: () => void
  onLongPress?: () => void
  scaleTo?: number
  haptics?: boolean
  hapticType?: 'light' | 'medium' | 'heavy' | 'selection'
  disabled?: boolean
  children: React.ReactNode
}

function PressableScale({
  onPress,
  onLongPress,
  scaleTo = 0.96,
  haptics = false,
  hapticType = 'light',
  disabled = false,
  children,
  style,
  hitSlop,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: scaleTo,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start()
    if (haptics) {
      const typeMap = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
        selection: Haptics.ImpactFeedbackStyle.Light,
      }
      if (hapticType === 'selection') {
        Haptics.selectionAsync()
      } else {
        Haptics.impactAsync(typeMap[hapticType])
      }
    }
  }

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 100,
      useNativeDriver: true,
    }).start()
  }

  return (
    <TouchableWithoutFeedback
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      hitSlop={hitSlop}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  )
}

export default memo(PressableScale)
