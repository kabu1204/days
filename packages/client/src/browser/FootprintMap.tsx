// Browser-only: the map component. Everything that depends on MapLibre GL is
// confined to this file. Inputs: places, focus target, selected place, party
// position. Outputs: place selected, view changed.
import { useEffect, useRef, useState } from 'react'
import { View } from '@tarojs/components'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import { clusterPoints } from '@days/shared'
import type { Look } from '../assets/manifest'
import { Party, facingFor, tween, walkMs } from './sprites'

export interface MapPlace {
  id: number
  name: string
  latitude: number
  longitude: number
  icon: string
}

export interface MapView {
  latitude: number
  longitude: number
  zoom: number
}

export interface FootprintMapProps {
  places: MapPlace[]
  /** Initial and later view. When null, the view is fitted to all places once. */
  focus: MapView | null
  /** The place drawn as selected. */
  selectedId?: number | null
  /** Groups markers that would overlap into one numbered marker. */
  cluster?: boolean
  /** Shows zoom buttons. */
  controls?: boolean
  /** Shows a crosshair at the centre; the centre is the chosen point (see `onViewChanged`). */
  crosshair?: boolean
  /** The partners and the pet stand here, and walk when the position changes. */
  party?: { latitude: number; longitude: number; looks: Look[] } | null
  /** Address of a PMTiles file in the Protomaps basemap layout; without it only the background is drawn. */
  tilesUrl?: string | null
  /** Renders at reduced resolution and enlarges without smoothing. */
  lowRes?: boolean
  className?: string
  onPlaceSelected?: (place: MapPlace) => void
  onViewChanged?: (view: MapView) => void
  onLoaded?: (milliseconds: number) => void
  onError?: (message: string) => void
}

/** View used when there is neither a focus nor a place to fit. */
const DEFAULT_VIEW: MapView = { latitude: 34, longitude: 108, zoom: 3 }
const FIT_MAX_ZOOM = 14
/** At this zoom level a group is opened by selecting its first place instead of zooming further. */
const CLUSTER_SELECT_ZOOM = 17

let protocolRegistered = false

/** Retro palette, no text labels. Coordinates are WGS-84 throughout. */
function retroStyle(tilesUrl: string | null | undefined): StyleSpecification {
  const style: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [{ id: 'background', type: 'background', paint: { 'background-color': tilesUrl ? '#6fa3a8' : '#d9c9a3' } }],
  }
  if (!tilesUrl) return style
  style.sources.base = { type: 'vector', url: `pmtiles://${tilesUrl}` }
  style.layers.push(
    { id: 'earth', type: 'fill', source: 'base', 'source-layer': 'earth', paint: { 'fill-color': '#e9d8a6', 'fill-antialias': false } },
    { id: 'landcover', type: 'fill', source: 'base', 'source-layer': 'landcover', paint: { 'fill-color': '#c2c58a', 'fill-antialias': false } },
    { id: 'landuse', type: 'fill', source: 'base', 'source-layer': 'landuse', paint: { 'fill-color': '#b5c78f', 'fill-antialias': false, 'fill-opacity': 0.7 } },
    { id: 'water', type: 'fill', source: 'base', 'source-layer': 'water', paint: { 'fill-color': '#6fa3a8', 'fill-antialias': false } },
    { id: 'buildings', type: 'fill', source: 'base', 'source-layer': 'buildings', minzoom: 14, paint: { 'fill-color': '#d2b48c', 'fill-antialias': false } },
    {
      id: 'roads', type: 'line', source: 'base', 'source-layer': 'roads',
      paint: { 'line-color': '#fffaf0', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1, 12, 2, 16, 6] },
    },
    {
      id: 'boundaries', type: 'line', source: 'base', 'source-layer': 'boundaries',
      paint: { 'line-color': '#2b2233', 'line-width': 1, 'line-dasharray': [3, 3] },
    },
  )
  return style
}

function placeMarker(place: MapPlace, selected: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = selected ? 'pixel-marker selected' : 'pixel-marker'
  el.style.backgroundImage = `url("${place.icon}")`
  el.title = place.name
  el.setAttribute('data-testid', `map-place-${place.id}`)
  return el
}

function clusterMarker(count: number, selected: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = selected ? 'map-cluster selected' : 'map-cluster'
  el.textContent = String(count)
  el.setAttribute('data-testid', 'map-cluster')
  return el
}

function boundsOf(points: { latitude: number; longitude: number }[]): maplibregl.LngLatBounds {
  const bounds = new maplibregl.LngLatBounds()
  for (const p of points) bounds.extend([p.longitude, p.latitude])
  return bounds
}

export function FootprintMap(props: FootprintMapProps) {
  const container = useRef<HTMLElement | null>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const fitted = useRef(false)
  const party = useRef<{ map: maplibregl.Map; party: Party; marker: maplibregl.Marker; at: [number, number]; stop: () => void; looks: string } | null>(null)
  const [zoomLevel, setZoomLevel] = useState(Math.floor(props.focus?.zoom ?? DEFAULT_VIEW.zoom))
  const callbacks = useRef(props)
  callbacks.current = props

  // The map is created once per tile source and resolution setting.
  useEffect(() => {
    if (!container.current) return
    if (!protocolRegistered) {
      maplibregl.addProtocol('pmtiles', new Protocol().tile)
      protocolRegistered = true
    }
    const start = props.focus ?? DEFAULT_VIEW
    const started = performance.now()
    const instance = new maplibregl.Map({
      container: container.current,
      style: retroStyle(props.tilesUrl),
      center: [start.longitude, start.latitude],
      zoom: start.zoom,
      attributionControl: false,
      pixelRatio: props.lowRes ? 1 / 3 : undefined,
      dragRotate: false,
      pitchWithRotate: false,
    })
    instance.touchZoomRotate.disableRotation()
    if (props.controls) instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    if (props.tilesUrl) instance.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap' }))
    instance.once('idle', () => callbacks.current.onLoaded?.(Math.round(performance.now() - started)))
    instance.on('error', (e) => callbacks.current.onError?.(e.error?.message ?? 'error'))
    instance.on('zoomend', () => setZoomLevel(Math.floor(instance.getZoom())))
    instance.on('moveend', () => {
      const c = instance.getCenter()
      callbacks.current.onViewChanged?.({ latitude: c.lat, longitude: c.lng, zoom: instance.getZoom() })
    })
    map.current = instance
    fitted.current = !!props.focus
    return () => {
      markers.current = []
      map.current = null
      instance.remove()
    }
  }, [props.tilesUrl, props.lowRes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Without a focus, the view is fitted to all places once they are known.
  useEffect(() => {
    const instance = map.current
    if (!instance || fitted.current || !props.places.length) return
    fitted.current = true
    if (props.places.length === 1) {
      instance.jumpTo({ center: [props.places[0].longitude, props.places[0].latitude], zoom: 13 })
    } else {
      instance.fitBounds(boundsOf(props.places), { padding: 48, maxZoom: FIT_MAX_ZOOM, duration: 0 })
    }
    setZoomLevel(Math.floor(instance.getZoom()))
  }, [props.places, props.tilesUrl, props.lowRes])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    markers.current.forEach((m) => m.remove())
    const groups = props.cluster
      ? clusterPoints(props.places, zoomLevel)
      : props.places.map((p) => ({ latitude: p.latitude, longitude: p.longitude, items: [p] }))
    markers.current = groups.map((group) => {
      const selected = group.items.some((p) => p.id === props.selectedId)
      if (group.items.length === 1) {
        const place = group.items[0]
        const el = placeMarker(place, selected)
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          callbacks.current.onPlaceSelected?.(place)
        })
        return new maplibregl.Marker({ element: el }).setLngLat([place.longitude, place.latitude]).addTo(instance)
      }
      const el = clusterMarker(group.items.length, selected)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const bounds = boundsOf(group.items)
        const target = instance.cameraForBounds(bounds, { padding: 64, maxZoom: CLUSTER_SELECT_ZOOM + 1 })
        if (instance.getZoom() >= CLUSTER_SELECT_ZOOM || !target || (target.zoom ?? 0) <= instance.getZoom() + 0.5) {
          callbacks.current.onPlaceSelected?.(group.items[0])
        } else {
          instance.easeTo({ ...target, duration: 400 })
        }
      })
      return new maplibregl.Marker({ element: el }).setLngLat([group.longitude, group.latitude]).addTo(instance)
    })
  }, [props.places, props.selectedId, props.cluster, zoomLevel, props.tilesUrl, props.lowRes])

  // The party stands just above the marker of its position and walks to a new one.
  const looksKey = props.party ? props.party.looks.map((l) => l.map((sheet) => sheet.src).join('+')).join(',') : ''
  useEffect(() => {
    const instance = map.current
    const target = props.party
    let s = party.current
    if (s && (s.map !== instance || !target || s.looks !== looksKey)) {
      s.stop()
      s.party.destroy()
      s.marker.remove()
      party.current = s = null
    }
    if (!instance || !target) return
    const to: [number, number] = [target.longitude, target.latitude]
    if (!s) {
      const p = new Party(target.looks)
      p.el.classList.add('on-map')
      p.el.setAttribute('data-testid', 'map-party')
      const marker = new maplibregl.Marker({ element: p.el, anchor: 'bottom', offset: [0, -24] }).setLngLat(to).addTo(instance)
      party.current = { map: instance, party: p, marker, at: to, stop: () => undefined, looks: looksKey }
      return
    }
    const state = s
    state.stop()
    const from = state.at
    const a = instance.project(from)
    const b = instance.project(to)
    const distance = Math.hypot(b.x - a.x, b.y - a.y)
    if (distance < 1) {
      state.at = to
      state.marker.setLngLat(to)
      return
    }
    state.party.set('walk', facingFor(b.x - a.x, b.y - a.y))
    state.stop = tween(
      walkMs(distance),
      (t) => {
        state.at = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]
        state.marker.setLngLat(state.at)
      },
      () => state.party.set('idle', 'down'),
    )
  }, [props.party?.latitude, props.party?.longitude, looksKey, props.tilesUrl, props.lowRes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      party.current?.stop()
      party.current?.party.destroy()
      party.current = null
    },
    [],
  )

  useEffect(() => {
    if (!props.focus) return
    map.current?.easeTo({ center: [props.focus.longitude, props.focus.latitude], zoom: props.focus.zoom, duration: 400 })
  }, [props.focus?.latitude, props.focus?.longitude, props.focus?.zoom]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View className={`map-box ${props.lowRes ? 'lowres' : ''} ${props.className ?? ''}`} data-testid="map">
      <View className="map-canvas" ref={container as any} />
      {props.crosshair ? <View className="map-crosshair" data-testid="map-crosshair" /> : null}
    </View>
  )
}
