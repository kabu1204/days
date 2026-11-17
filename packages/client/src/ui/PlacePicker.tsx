import { useMemo, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import {
  PLACE_ICON_KEYS,
  nearbyPlaces,
  type LatLon,
  type Place,
  type PlaceIconKey,
  type PlaceRef,
} from '@days/shared'
import { api } from '../api/client'
import { placeIcons } from '../assets/manifest'
import { LazyMap, type MapView } from '../browser/LazyMap'
import { useT } from '../i18n'
import { mapView } from '../state/session'
import { Button, Field, Frame, PlaceIcon, TextInput, cx } from './index'

/** A Place chosen in the picker. A new Place is created only when the memory is saved. */
export type PlaceChoice =
  | { kind: 'existing'; place: PlaceRef }
  | { kind: 'new'; name: string; city: string; icon: PlaceIconKey; latitude: number; longitude: number }

export function choiceName(choice: PlaceChoice | null): string {
  return !choice ? '' : choice.kind === 'existing' ? choice.place.name : choice.name
}

export function choiceIcon(choice: PlaceChoice): PlaceIconKey {
  return choice.kind === 'existing' ? choice.place.icon : choice.icon
}

/** Returns the id of the chosen Place, creating it first when it is new. */
export async function resolvePlace(choice: PlaceChoice | null): Promise<number | null> {
  if (!choice) return null
  if (choice.kind === 'existing') return choice.place.id
  const { kind: _kind, ...input } = choice
  return (await api.createPlace(input)).id
}

const formatDistance = (m: number) => `${Math.round(m)} m`

/**
 * Full-screen Place selection: Places near the photos, saved Places with a
 * search, or a point chosen on the map, which may become a new Place.
 */
export function PlacePicker(props: {
  places: Place[]
  /** Position of the photos, when known. */
  point: LatLon | null
  tilesUrl: string | null
  lowRes: boolean
  /** Opens directly at naming a new Place at `point`. */
  startWithName?: boolean
  onPick: (choice: PlaceChoice | null) => void
  onClose: () => void
}) {
  const t = useT()
  const [step, setStep] = useState<'list' | 'map' | 'name'>(props.startWithName && props.point ? 'name' : 'list')
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState<LatLon | null>(props.startWithName ? props.point : null)
  const [near, setNear] = useState<(Place & { distance: number })[] | null>(null)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [icon, setIcon] = useState<PlaceIconKey>('pin')
  const startView: MapView | null = props.point
    ? { ...props.point, zoom: 16 }
    : mapView.view
  const center = useRef<LatLon>(startView ?? { latitude: 34, longitude: 108 })

  const suggestions = props.point ? nearbyPlaces(props.places, props.point) : []
  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase()
    return props.places
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q))
      .sort((a, b) => (b.lastDate ?? '').localeCompare(a.lastDate ?? '') || a.name.localeCompare(b.name))
  }, [props.places, query])
  const mapPlaces = useMemo(() => props.places.map((p) => ({ ...p, icon: placeIcons[p.icon] ?? placeIcons.pin })), [props.places])

  const pickExisting = (place: PlaceRef) => props.onPick({ kind: 'existing', place })
  const startNaming = (point: LatLon) => {
    setTarget(point)
    setNear(null)
    setStep('name')
  }
  const usePoint = () => {
    const found = nearbyPlaces(props.places, center.current)
    if (found.length) setNear(found)
    else startNaming(center.current)
  }

  return (
    <View className="picker" data-testid="place-picker">
      <View className="topbar">
        <Button small kind="plain" onClick={step === 'list' ? props.onClose : () => setStep('list')} testId="picker-back">◀</Button>
        <Text className="h1 ellipsis">{t(step === 'name' ? 'place.new' : 'place.choose')}</Text>
      </View>

      {step === 'list' ? (
        <View className="picker-body">
          {props.point ? (
            <>
              <View className="section-title">{t('place.nearPhotos')}</View>
              <Frame>
                {suggestions.map((p) => (
                  <View key={p.id} className="place-row" data-testid="place-suggestion" onClick={() => pickExisting(p)}>
                    <PlaceIcon icon={p.icon} />
                    <Text className="grow ellipsis">{p.name}</Text>
                    <Text className="small muted">{formatDistance(p.distance)}</Text>
                  </View>
                ))}
                <Button block kind="calm" onClick={() => startNaming(props.point!)} testId="place-new-at-photos">
                  ＋ {t('place.newAtPhotos')}
                </Button>
              </Frame>
            </>
          ) : null}
          <Button block onClick={() => setStep('map')} testId="place-pick-map">{t('place.pickOnMap')}</Button>

          <View className="section-title">{t('place.saved')}</View>
          <TextInput name="placeSearch" value={query} onChange={setQuery} placeholder={t('place.search')} maxLength={40} />
          <Frame>
            {sorted.length === 0 ? <View className="small muted">{t('place.none')}</View> : null}
            {sorted.map((p) => (
              <View key={p.id} className="place-row" data-testid="place-option" onClick={() => pickExisting(p)}>
                <PlaceIcon icon={p.icon} />
                <View className="grow">
                  <View className="ellipsis">{p.name}</View>
                  {p.city ? <View className="small muted ellipsis">{p.city}</View> : null}
                </View>
                <Text className="small muted">{t('place.count', { n: p.memoryCount })}</Text>
              </View>
            ))}
          </Frame>
          <Button block kind="plain" onClick={() => props.onPick(null)} testId="place-clear">{t('place.noPlace')}</Button>
        </View>
      ) : null}

      {step === 'map' ? (
        <View className="picker-map">
          <View className="small muted">{t('place.mapHint')}</View>
          <LazyMap
            className="fill"
            places={mapPlaces}
            focus={startView}
            cluster
            crosshair
            tilesUrl={props.tilesUrl}
            lowRes={props.lowRes}
            onViewChanged={(v) => { center.current = v; setNear(null) }}
            onPlaceSelected={(p) => pickExisting(props.places.find((x) => x.id === p.id)!)}
          />
          {near ? (
            <Frame tone="paper">
              <View className="small">{t('place.nearPoint', { name: near[0].name, distance: formatDistance(near[0].distance) })}</View>
              <View className="row wrap" style={{ marginTop: '6px' }}>
                <Button kind="calm" onClick={() => pickExisting(near[0])} testId="place-use-near">{t('place.useNamed', { name: near[0].name })}</Button>
                <Button onClick={() => startNaming(center.current)} testId="place-new-anyway">{t('place.newHere')}</Button>
              </View>
            </Frame>
          ) : (
            <Button block kind="primary" onClick={usePoint} testId="place-use-point">{t('place.usePoint')}</Button>
          )}
        </View>
      ) : null}

      {step === 'name' && target ? (
        <View className="picker-body">
          <Field label={t('place.name')}>
            <TextInput name="placeName" value={name} onChange={setName} placeholder={t('place.name.placeholder')} maxLength={40} />
          </Field>
          <Field label={t('place.city')}>
            <TextInput name="placeCity" value={city} onChange={setCity} maxLength={40} />
          </Field>
          <Field label={t('place.icon')}>
            <IconGrid value={icon} onChange={setIcon} />
          </Field>
          <View className="small muted" style={{ marginBottom: '9px' }}>
            {target.latitude.toFixed(5)}, {target.longitude.toFixed(5)}
          </View>
          <Button
            block
            kind="primary"
            disabled={!name.trim()}
            onClick={() => props.onPick({ kind: 'new', name: name.trim(), city: city.trim(), icon, ...target })}
            testId="place-create"
          >
            {t('common.confirm')}
          </Button>
        </View>
      ) : null}
    </View>
  )
}

export function IconGrid(props: { value: PlaceIconKey; onChange: (icon: PlaceIconKey) => void }) {
  return (
    <Frame className="flat">
      <View className="icon-grid">
        {PLACE_ICON_KEYS.map((k) => (
          <View key={k} className={cx('icon-cell', k === props.value && 'selected')} data-testid={`place-icon-${k}`} onClick={() => props.onChange(k)}>
            <PlaceIcon icon={k} size={24} />
          </View>
        ))}
      </View>
    </Frame>
  )
}
