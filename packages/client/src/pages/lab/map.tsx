import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { categoryIcons, logo } from '../../assets/manifest'
import { FootprintMap, type MapPlace } from '../../browser/FootprintMap'
import { useT } from '../../i18n'
import { Button, Field, TextInput, TopBar, useToast } from '../../ui'

const STORAGE_KEY = 'days.lab.tiles'
// Two sample places (WGS-84) so that markers can be judged at different zoom levels.
const PLACES: MapPlace[] = [
  { id: 1, name: 'A', latitude: 31.2304, longitude: 121.4737, icon: logo },
  { id: 2, name: 'B', latitude: 30.2431, longitude: 120.1503, icon: categoryIcons.walk },
]

/** Phase 0, test b: map appearance and loading speed inside a Taro H5 page. */
export default function LabMapPage() {
  const t = useT()
  const [draft, setDraft] = useState<string>(() => Taro.getStorageSync(STORAGE_KEY) || '')
  const [tilesUrl, setTilesUrl] = useState<string | null>(draft || null)
  const [lowRes, setLowRes] = useState(false)
  const [loadTime, setLoadTime] = useState<number | null>(null)
  const [focus, setFocus] = useState({ latitude: 30.8, longitude: 120.9, zoom: 7 })
  const [toast, showToast] = useToast()

  const load = () => {
    const url = draft.trim()
    Taro.setStorageSync(STORAGE_KEY, url)
    setLoadTime(null)
    setTilesUrl(url || null)
  }

  return (
    <View className="page wide">
      <TopBar title={t('lab.map.title')} back />
      <View className="small muted">{t('lab.map.text')}</View>
      <Field label={t('lab.map.url')}>
        <View className="row">
          <View className="grow">
            <TextInput value={draft} onChange={setDraft} placeholder="/tiles/region.pmtiles" maxLength={500} />
          </View>
          <Button kind="primary" onClick={load} testId="map-load">{t('lab.map.load')}</Button>
        </View>
      </Field>
      <View className="row wrap" style={{ marginBottom: '9px' }}>
        <Button small selected={lowRes} onClick={() => { setLoadTime(null); setLowRes(!lowRes) }} testId="map-lowres">{t('lab.map.lowres')}</Button>
        {loadTime !== null ? <Text className="small" data-testid="map-load-time">{t('lab.map.loadTime', { ms: loadTime })}</Text> : null}
      </View>
      <FootprintMap
        places={PLACES}
        focus={focus}
        tilesUrl={tilesUrl}
        lowRes={lowRes}
        onLoaded={setLoadTime}
        onError={() => showToast(t('lab.map.failed'))}
        onPlaceSelected={(p) => setFocus({ latitude: p.latitude, longitude: p.longitude, zoom: 12 })}
      />
      {toast}
    </View>
  )
}
