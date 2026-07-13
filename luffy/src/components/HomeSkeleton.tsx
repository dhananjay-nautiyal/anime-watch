import { View, Animated, StyleSheet, Dimensions } from 'react-native'
import { useColorScheme } from 'react-native'
import { useEffect, useRef } from 'react'
import { DarkPalette, Palette } from '@/constants/theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const CARD_W = (SCREEN_WIDTH - 48) / 3

function Pulse({ style, colors }: { style: any; colors: typeof Palette }) {
  const opacity = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [])

  return (
    <Animated.View
      style={[
        style,
        { backgroundColor: colors.surfaceVariant, opacity },
      ]}
    />
  )
}

export function BannerSkeleton({ colors }: { colors: typeof Palette }) {
  return (
    <View style={styles.banner}>
      <Pulse style={styles.bannerInner} colors={colors} />
    </View>
  )
}

export function RowSkeleton({ colors }: { colors: typeof Palette }) {
  return (
    <View style={styles.rowContainer}>
      <View style={styles.rowHeader}>
        <Pulse style={{ width: 140, height: 18, borderRadius: 4 }} colors={colors} />
      </View>
      <View style={styles.cardRow}>
        {[0, 1, 2].map(i => (
          <View key={i} style={{ width: CARD_W }}>
            <Pulse style={{ width: CARD_W, height: CARD_W * 1.33, borderRadius: 12 }} colors={colors} />
            <Pulse style={{ width: CARD_W * 0.8, height: 12, borderRadius: 4, marginTop: 6 }} colors={colors} />
          </View>
        ))}
      </View>
    </View>
  )
}

export function GridSkeleton({ colors }: { colors: typeof Palette }) {
  return (
    <View style={styles.rowContainer}>
      <View style={styles.rowHeader}>
        <Pulse style={{ width: 160, height: 18, borderRadius: 4 }} colors={colors} />
      </View>
      <View style={styles.gridRow}>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <View key={i} style={{ width: CARD_W }}>
            <Pulse style={{ width: CARD_W, height: CARD_W * 1.33, borderRadius: 12 }} colors={colors} />
            <Pulse style={{ width: CARD_W * 0.8, height: 12, borderRadius: 4, marginTop: 6 }} colors={colors} />
          </View>
        ))}
      </View>
    </View>
  )
}

export default function HomeSkeleton({ colors }: { colors: typeof Palette }) {
  return (
    <View style={styles.container}>
      <BannerSkeleton colors={colors} />
      <RowSkeleton colors={colors} />
      <RowSkeleton colors={colors} />
      <GridSkeleton colors={colors} />
      <RowSkeleton colors={colors} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  banner: {
    paddingHorizontal: 0,
    marginBottom: 8,
  },
  bannerInner: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.56,
  },
  rowContainer: {
    marginBottom: 8,
  },
  rowHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
  },
})
