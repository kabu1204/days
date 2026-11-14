// Browser-only: the map component. Everything that depends on MapLibre GL is
// confined to this file. Inputs: places, focus target, sprite position.
// Outputs: place selected, view changed.
import { useEffect, useRef } from 'react'
import { View } from '@tarojs/components'
import maplibregl, { type StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'

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
  focus: MapView
  /** Position of the avatar sprite (used from Phase 3). */
  sprite?: { latitude: number; longitude: number; icon: string } | null
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

function markerElement(icon: string, title: string): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pixel-marker'
  el.style.backgroundImage = `url("${icon}")`
  el.title = title
  return el
}

export function FootprintMap(props: FootprintMapProps) {
  const container = useRef<HTMLElement | null>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const markers = useRef<maplibregl.Marker[]>([])
  const callbacks = useRef(props)
  callbacks.current = props

  // The map is created once per tile source and resolution setting.
  useEffect(() => {
    if (!container.current) return
    if (!protocolRegistered) {
      maplibregl.addProtocol('pmtiles', new Protocol().tile)
      protocolRegistered = true
    }
    const started = performance.now()
    const instance = new maplibregl.Map({
      container: container.current,
      style: retroStyle(props.tilesUrl),
      center: [props.focus.longitude, props.focus.latitude],
      zoom: props.focus.zoom,
      attributionControl: false,
      pixelRatio: props.lowRes ? 1 / 3 : undefined,
      dragRotate: false,
      pitchWithRotate: false,
    })
    instance.touchZoomRotate.disableRotation()
    if (props.tilesUrl) instance.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap' }))
    instance.once('idle', () => callbacks.current.onLoaded?.(Math.round(performance.now() - started)))
    instance.on('error', (e) => callbacks.current.onError?.(e.error?.message ?? 'error'))
    instance.on('moveend', () => {
      const c = instance.getCenter()
      callbacks.current.onViewChanged?.({ latitude: c.lat, longitude: c.lng, zoom: instance.getZoom() })
    })
    map.current = instance
    return () => {
      markers.current = []
      map.current = null
      instance.remove()
    }
  }, [props.tilesUrl, props.lowRes]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    markers.current.forEach((m) => m.remove())
    markers.current = props.places.map((place) => {
      const el = markerElement(place.icon, place.name)
      el.addEventListener('click', () => callbacks.current.onPlaceSelected?.(place))
      return new maplibregl.Marker({ element: el }).setLngLat([place.longitude, place.latitude]).addTo(instance)
    })
    if (props.sprite) {
      markers.current.push(
        new maplibregl.Marker({ element: markerElement(props.sprite.icon, '') })
          .setLngLat([props.sprite.longitude, props.sprite.latitude])
          .addTo(instance),
      )
    }
  }, [props.places, props.sprite, props.tilesUrl, props.lowRes])

  useEffect(() => {
    map.current?.easeTo({ center: [props.focus.longitude, props.focus.latitude], zoom: props.focus.zoom, duration: 400 })
  }, [props.focus.latitude, props.focus.longitude, props.focus.zoom])

  return <View className={`map-box ${props.lowRes ? 'lowres' : ''} ${props.className ?? ''}`} ref={container as any} data-testid="map" />
}
