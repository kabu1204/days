import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import type { Place } from '@days/shared'
import { api } from '../../api/client'
import { useT } from '../../i18n'
import { ROUTES, useMember } from '../../state/session'
import { Button, Frame, PlaceIcon, TopBar, formatDate } from '../../ui'

/** All saved Places, by name. */
export default function PlacesPage() {
  const t = useT()
  const me = useMember()
  const [places, setPlaces] = useState<Place[] | null>(null)

  useDidShow(() => {
    api.places().then((r) => setPlaces(r.places), () => undefined)
  })

  if (!me || !places) return <View className="page muted">{t('common.loading')}</View>

  return (
    <View className="page">
      <TopBar title={t('places.title')} back>
        <Button small kind="plain" onClick={() => Taro.navigateTo({ url: ROUTES.map })} testId="open-map">{t('map.title')}</Button>
      </TopBar>
      <View className="small muted" style={{ marginBottom: '9px' }}>{t('places.text')}</View>
      <Frame>
        {places.length === 0 ? <View className="small muted" data-testid="places-empty">{t('place.none')}</View> : null}
        {places.map((p) => (
          <View key={p.id} className="place-row" data-testid="places-item" onClick={() => Taro.navigateTo({ url: `${ROUTES.place}?id=${p.id}` })}>
            <PlaceIcon icon={p.icon} size={24} />
            <View className="grow">
              <View className="ellipsis" data-testid="places-name">{p.name}</View>
              <View className="small muted ellipsis">
                {[p.city, p.lastDate ? formatDate(p.lastDate, 'day') : ''].filter(Boolean).join(' · ')}
              </View>
            </View>
            <Text className="small muted">{t('place.count', { n: p.memoryCount })}</Text>
          </View>
        ))}
      </Frame>
    </View>
  )
}
