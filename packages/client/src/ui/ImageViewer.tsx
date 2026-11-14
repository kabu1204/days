import { useEffect, useRef, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Photo } from '@days/shared'
import { photoUrl } from '../api/client'
import { useT } from '../i18n'
import { Button } from './index'

const MAX_SCALE = 6
/** Above this magnification the medium copy is no longer sharp enough. */
const ORIGINAL_AT_SCALE = 2

interface Point {
  clientX: number
  clientY: number
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
}

/**
 * Full-screen photo viewer with a pixel frame. Supports pinch zoom, pan,
 * double tap, and swipe between photos. The medium copy is shown first; the
 * original is loaded when requested or when the photo is magnified.
 */
export function ImageViewer(props: {
  photos: Photo[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
  onDelete?: (photo: Photo) => void
}) {
  const t = useT()
  const photo = props.photos[props.index]
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const [original, setOriginal] = useState<Record<number, 'loading' | 'ready' | 'failed'>>({})
  const gesture = useRef({ mode: 'none' as 'none' | 'pan' | 'pinch', startDist: 1, startScale: 1, startX: 0, startY: 0, originX: 0, originY: 0, dx: 0, moved: false, lastTap: 0 })

  useEffect(() => setView({ scale: 1, x: 0, y: 0 }), [props.index])

  if (!photo) return null

  const info = Taro.getSystemInfoSync()
  const stageW = info.windowWidth - 24
  const stageH = info.windowHeight - 120
  const fit = Math.min(stageW / photo.width, stageH / photo.height)
  const w = Math.max(1, Math.round(photo.width * fit))
  const h = Math.max(1, Math.round(photo.height * fit))

  const clamp = (scale: number, x: number, y: number) => {
    const s = Math.min(MAX_SCALE, Math.max(1, scale))
    const limX = Math.max(0, (w * s - stageW) / 2 + 24)
    const limY = Math.max(0, (h * s - stageH) / 2 + 24)
    return s === 1 ? { scale: 1, x: 0, y: 0 } : { scale: s, x: Math.min(limX, Math.max(-limX, x)), y: Math.min(limY, Math.max(-limY, y)) }
  }
  const requestOriginal = () => setOriginal((o) => (o[photo.id] ? o : { ...o, [photo.id]: 'loading' }))
  const apply = (scale: number, x: number, y: number) => {
    const next = clamp(scale, x, y)
    setView(next)
    if (next.scale >= ORIGINAL_AT_SCALE) requestOriginal()
  }
  const go = (delta: number) => {
    const next = props.index + delta
    if (next >= 0 && next < props.photos.length) props.onIndex(next)
  }

  const onTouchStart = (e: any) => {
    const ts: Point[] = e.touches
    const g = gesture.current
    if (ts.length >= 2) {
      g.mode = 'pinch'
      g.startDist = distance(ts[0], ts[1]) || 1
      g.startScale = view.scale
    } else if (ts.length === 1) {
      g.mode = 'pan'
      g.startX = ts[0].clientX
      g.startY = ts[0].clientY
      g.originX = view.x
      g.originY = view.y
      g.dx = 0
      g.moved = false
    }
  }
  const onTouchMove = (e: any) => {
    const ts: Point[] = e.touches
    const g = gesture.current
    if (g.mode === 'pinch' && ts.length >= 2) {
      apply(g.startScale * (distance(ts[0], ts[1]) / g.startDist), view.x, view.y)
    } else if (g.mode === 'pan' && ts.length === 1) {
      const dx = ts[0].clientX - g.startX
      const dy = ts[0].clientY - g.startY
      g.dx = dx
      if (Math.abs(dx) + Math.abs(dy) > 8) g.moved = true
      if (view.scale > 1) apply(view.scale, g.originX + dx, g.originY + dy)
    }
  }
  const onTouchEnd = () => {
    const g = gesture.current
    if (g.mode === 'pan') {
      if (!g.moved) {
        const now = Date.now()
        if (now - g.lastTap < 320) {
          apply(view.scale > 1 ? 1 : 2.5, 0, 0)
          g.lastTap = 0
        } else g.lastTap = now
      } else if (view.scale === 1 && Math.abs(g.dx) > 60) {
        go(g.dx < 0 ? 1 : -1)
      }
    }
    g.mode = 'none'
  }

  const state = original[photo.id]
  const showOriginal = state === 'loading' || state === 'ready'
  const taken = photo.takenAt ? photo.takenAt.replace('T', ' ').slice(0, 16) : ''

  return (
    <View className="viewer" data-testid="viewer">
      <View className="bar">
        <Button small kind="plain" onClick={props.onClose} testId="viewer-close">✕</Button>
        <Text className="grow small">{props.index + 1} / {props.photos.length}</Text>
        <Button small kind="plain" onClick={() => apply(view.scale / 1.5, view.x, view.y)} testId="zoom-out">－</Button>
        <Button small kind="plain" onClick={() => apply(view.scale * 1.5, view.x, view.y)} testId="zoom-in">＋</Button>
        <Button small selected={state === 'ready'} onClick={requestOriginal} testId="viewer-original">{t('viewer.original')}</Button>
        {props.onDelete ? (
          <Button small kind="primary" onClick={() => props.onDelete!(photo)} testId="viewer-delete">{t('common.delete')}</Button>
        ) : null}
      </View>
      <View className="stage" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        <View
          className="stage-frame"
          data-testid="viewer-frame"
          data-scale={view.scale.toFixed(2)}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
        >
          <Image
            key={`${photo.id}-${showOriginal ? 'o' : 'm'}`}
            src={photoUrl(photo.id, showOriginal ? 'original' : 'medium')}
            style={{ width: `${w}px`, height: `${h}px` }}
            mode="scaleToFill"
            data-testid="viewer-image"
            onLoad={() => showOriginal && setOriginal((o) => ({ ...o, [photo.id]: 'ready' }))}
            // Some original formats cannot be shown by every browser; the medium copy remains.
            onError={() => showOriginal && setOriginal((o) => ({ ...o, [photo.id]: 'failed' }))}
          />
        </View>
        {props.index > 0 ? (
          <View className="nav prev"><Button kind="plain" onClick={() => go(-1)} testId="viewer-prev">◀</Button></View>
        ) : null}
        {props.index < props.photos.length - 1 ? (
          <View className="nav next"><Button kind="plain" onClick={() => go(1)} testId="viewer-next">▶</Button></View>
        ) : null}
      </View>
      <View className="info">
        {state === 'loading' ? t('viewer.loadingOriginal') : `${taken}${taken ? ' · ' : ''}${photo.width} × ${photo.height}`}
      </View>
    </View>
  )
}
