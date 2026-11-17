import { useCallback, useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import type { Memory, Place } from '@days/shared'
import { api } from '../../api/client'
import { placeIcons } from '../../assets/manifest'
import { scrollToId } from '../../browser/dom'
import { LazyMap, type MapView } from '../../browser/LazyMap'
import { useT } from '../../i18n'
import { ROUTES, getMapLowRes, mapView, openTimelineAt, timelineView, useMember, useStatus } from '../../state/session'
import { Button, Frame, PlaceIcon, TopBar, formatDate } from '../../ui'
import { partyMembers } from '../../ui/Characters'
import { MemoryRow } from '../../ui/MemoryRow'

const dateSpan = (p: Place) =>
  !p.firstDate || !p.lastDate ? '' : p.firstDate === p.lastDate ? formatDate(p.firstDate, 'day') : `${formatDate(p.firstDate, 'day')} – ${formatDate(p.lastDate, 'day')}`

/**
 * The map view: every Place with memories, grouped at low zoom levels. A
 * selected Place lists its memories oldest first; each can be opened, or
 * shown in its month on the timeline.
 */
export default function MapPage() {
  const t = useT()
  const me = useMember()
  const status = useStatus()
  const params = useRouter().params
  const [places, setPlaces] = useState<Place[] | null>(null)
  const [selected, setSelected] = useState<number | null>(params.place ? Number(params.place) : mapView.placeId)
  const [highlight] = useState<number | null>(params.memory ? Number(params.memory) : timelineView.memoryId)
  const [list, setList] = useState<{ place: Place; memories: Memory[] } | null>(null)
  const [focus, setFocus] = useState<MapView | null | undefined>(undefined)
  const [lowRes] = useState(getMapLowRes)

  const loadPlaces = useCallback(() => api.places().then((r) => setPlaces(r.places), () => undefined), [])

  // The first view: the selected Place, else the last view, else all Places.
  useEffect(() => {
    if (!me) return
    const start = async () => {
      let placeId = selected
      if (placeId === null && highlight !== null) {
        placeId = (await api.memory(highlight).catch(() => null))?.placeId ?? null
        setSelected(placeId)
      }
      const all = (await api.places()).places
      setPlaces(all)
      const place = all.find((p) => p.id === placeId)
      setFocus(place ? { latitude: place.latitude, longitude: place.longitude, zoom: Math.max(mapView.view?.zoom ?? 14, 13) } : mapView.view)
    }
    start().catch(() => setFocus(null))
  }, [me]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mapView.placeId = selected
    if (selected === null) return setList(null)
    api.placeMemories(selected).then(
      (r) => {
        setList(r)
        if (highlight !== null && r.memories.some((m) => m.id === highlight)) scrollToId(`memory-row-${highlight}`)
      },
      () => setSelected(null),
    )
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  useDidShow(() => {
    if (!places) return
    loadPlaces()
    if (selected !== null) api.placeMemories(selected).then(setList, () => setSelected(null))
  })

  const shown = useMemo(
    () => (places ?? []).filter((p) => p.memoryCount > 0).map((p) => ({ ...p, icon: placeIcons[p.icon] ?? placeIcons.pin })),
    [places],
  )

  const standing = (places ?? []).find((p) => p.id === selected)
  const party = useMemo(
    () => (standing ? { latitude: standing.latitude, longitude: standing.longitude, sheets: partyMembers(status).map((m) => m.sheet) } : null),
    [standing?.latitude, standing?.longitude, status], // eslint-disable-line react-hooks/exhaustive-deps
  )

  if (!me || !places || focus === undefined) return <View className="page muted">{t('common.loading')}</View>

  const place = list?.place
  return (
    <View className="page">
      <TopBar title={t('map.title')} back>
        <Button small kind="plain" onClick={() => Taro.navigateTo({ url: ROUTES.places })} testId="open-places">{t('places.title')}</Button>
      </TopBar>
      {!status?.mapTiles ? <View className="small muted">{t('map.noTiles')}</View> : null}
      {shown.length === 0 ? <Frame tone="paper"><View data-testid="map-empty">{t('map.empty')}</View></Frame> : null}

      <LazyMap
        className="main"
        places={shown}
        focus={focus}
        selectedId={selected}
        party={party}
        cluster
        controls
        tilesUrl={status?.mapTiles ?? null}
        lowRes={lowRes}
        onPlaceSelected={(p) => setSelected(p.id)}
        onViewChanged={(v) => { mapView.view = v }}
      />

      {place ? (
        <Frame className="place-panel">
          <View className="row">
            <PlaceIcon icon={place.icon} size={36} />
            <View className="grow">
              <View className="h1 ellipsis" data-testid="map-place-name">{place.name}</View>
              <View className="small muted">
                {[place.city, t('place.count', { n: place.memoryCount }), dateSpan(place)]
                  .filter(Boolean)
                  .join(' · ')}
              </View>
            </View>
            <Button small kind="plain" onClick={() => Taro.navigateTo({ url: `${ROUTES.place}?id=${place.id}` })} testId="open-place">
              {t('map.placeDetails')}
            </Button>
          </View>
          <View className="memory-list">
            {list!.memories.map((m) => (
              <MemoryRow
                key={m.id}
                memory={m}
                highlight={m.id === highlight}
                onOpen={() => Taro.navigateTo({ url: `${ROUTES.detail}?id=${m.id}` })}
                onTimeline={() => openTimelineAt(m)}
              />
            ))}
          </View>
        </Frame>
      ) : shown.length ? (
        <Text className="small muted">{t('map.hint')}</Text>
      ) : null}
    </View>
  )
}
