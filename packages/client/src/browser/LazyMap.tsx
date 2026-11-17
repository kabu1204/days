import { Suspense, lazy } from 'react'
import { View } from '@tarojs/components'
import type { FootprintMapProps } from './FootprintMap'

export type { FootprintMapProps, MapPlace, MapView } from './FootprintMap'

// The map library is large; it is loaded only when a map is shown.
const Loaded = lazy(() => import('./FootprintMap').then((m) => ({ default: m.FootprintMap })))

export function LazyMap(props: FootprintMapProps) {
  return (
    <Suspense fallback={<View className={`map-box ${props.className ?? ''}`} />}>
      <Loaded {...props} />
    </Suspense>
  )
}
