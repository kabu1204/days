import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import {
  COMMENT_MAX_LENGTH,
  DECOR_KEYS,
  REACTION_KEYS,
  type Comment,
  type DecorKey,
  type MemoryDetail,
  type Photo,
  type ReactionKey,
  type StickerPlacement,
} from '@days/shared'
import { ApiFailure, api, photoUrl, runPool, uploadPhoto } from '../../api/client'
import { stickerIcons } from '../../assets/manifest'
import { pickImages, readLocalPhoto } from '../../browser/photo'
import { errorText, useT } from '../../i18n'
import { ROUTES, memberName, openMapAt, openTimelineAt, timelineView, useMember, useStatus } from '../../state/session'
import { Button, CategoryIcon, Confirm, Frame, PlaceTag, Progress, TextArea, TopBar, cx, formatDate, useToast } from '../../ui'
import { Portrait } from '../../ui/Characters'
import { ImageViewer } from '../../ui/ImageViewer'
import { DecorLayer, NewMark } from '../../ui/Stickers'

type Pending = { kind: 'memory' } | { kind: 'photo'; photo: Photo } | { kind: 'comment'; comment: Comment }

export default function MemoryDetailPage() {
  const t = useT()
  const me = useMember()
  const status = useStatus()
  const id = Number(useRouter().params.id)
  const [memory, setMemory] = useState<MemoryDetail | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<Pending | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [decorating, setDecorating] = useState(false)
  const [decorKey, setDecorKey] = useState<DecorKey>(DECOR_KEYS[0])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [toast, showToast] = useToast()
  // Items by the partner after this time are marked as new while the page is open.
  const seenBefore = useRef<string | null>(null)
  const cover = useRef<HTMLElement | null>(null)

  const load = useCallback(() => {
    timelineView.memoryId = id
    return api.memory(id).then(
      (m) => {
        if (seenBefore.current === null) {
          seenBefore.current = m.seenAt
          api.seen(id).catch(() => undefined)
        }
        setMemory(m)
      },
      () => {
        Taro.reLaunch({ url: ROUTES.timeline })
      },
    )
  }, [id])

  useEffect(() => {
    if (me) load()
  }, [me, load])
  useDidShow(() => {
    if (me && memory) load().then(() => api.seen(id).catch(() => undefined))
    const notice = Taro.getStorageSync('days.notice')
    if (notice) {
      Taro.removeStorageSync('days.notice')
      showToast(notice)
    }
  })

  const fail = (e: unknown) => showToast(errorText(t, e instanceof ApiFailure ? e.code : undefined))

  // Placing a decorative sticker needs the tap position, which the native event gives.
  const placing = useRef({ decorating, decorKey })
  placing.current = { decorating, decorKey }
  const hasCover = !!memory && memory.photos.length > 0
  useEffect(() => {
    const el = cover.current
    if (!el) return
    const onClick = (ev: MouseEvent) => {
      // A tap on a placed sticker removes it instead (handled by the sticker).
      if (!placing.current.decorating || (ev.target as HTMLElement).closest?.('.decor')) return
      const rect = el.getBoundingClientRect()
      const x = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width))
      const y = Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height))
      api.addSticker(id, { key: placing.current.decorKey, x, y }).then(load, fail)
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [hasCover, id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!me || !memory) return <View className="page muted">{t('common.loading')}</View>

  const since = seenBefore.current ?? memory.seenAt
  const isNew = (by: number, at: string) => by !== me.id && at > since
  const uploaders = new Set(memory.photos.map((p) => p.uploadedBy))

  const addPhotos = async () => {
    const files = await pickImages(true)
    if (!files.length) return
    let done = 0
    let failed = 0
    setProgress({ done, total: files.length })
    const base = memory.photos.reduce((max, p) => Math.max(max, p.sortOrder + 1), 0)
    await runPool(files, 3, async (file, i) => {
      try {
        const local = await readLocalPhoto(file, true)
        await uploadPhoto(memory.id, file, local, base + i)
      } catch {
        failed++
      }
      setProgress({ done: ++done, total: files.length })
    })
    setProgress(null)
    if (failed) showToast(t('memory.uploadFailed', { n: failed }))
    load()
  }

  const remove = async () => {
    const target = confirm
    setConfirm(null)
    if (!target) return
    try {
      if (target.kind === 'memory') {
        await api.deleteMemory(memory.id)
        timelineView.month = memory.startDate.slice(0, 7)
        if (Taro.getCurrentPages().length > 1) Taro.navigateBack()
        else Taro.reLaunch({ url: ROUTES.timeline })
        return
      }
      if (target.kind === 'photo') {
        await api.deletePhoto(target.photo.id)
        setViewing(null)
      } else {
        await api.deleteComment(target.comment.id)
      }
      load()
    } catch (e) {
      fail(e)
    }
  }

  const toggleReaction = (key: ReactionKey) => {
    const mine = memory.stickers.find((s) => s.key === key && s.x === null && s.placedBy === me.id)
    ;(mine ? api.deleteSticker(mine.id) : api.addSticker(memory.id, { key })).then(load, fail)
  }

  const removeDecor = (s: StickerPlacement) => {
    api.deleteSticker(s.id).then(load, fail)
  }

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await api.addComment(memory.id, text)
      setDraft('')
      await load()
    } catch (e) {
      fail(e)
    } finally {
      setSending(false)
    }
  }

  const decorCount = memory.stickers.filter((s) => s.x !== null).length

  return (
    <View className="page">
      <TopBar title={memory.title} back>
        <Button small kind="plain" onClick={() => Taro.navigateTo({ url: `${ROUTES.edit}?id=${memory.id}` })} testId="edit-memory">
          {t('common.edit')}
        </Button>
      </TopBar>

      {hasCover ? (
        <View className="px-frame polaroid">
          <View
            className={cx('cover', decorating && 'decorating')}
            data-testid="detail-cover"
            ref={cover as any}
            onClick={() => {
              if (!decorating) setViewing(0)
            }}
          >
            <Image className="cover-img" src={photoUrl(memory.photos[0].id, 'medium')} mode="aspectFill" />
            <DecorLayer stickers={memory.stickers} size={48} onTap={decorating ? removeDecor : undefined} />
          </View>
          <View className="row" style={{ marginTop: '6px' }}>
            <View className="grow small muted">{decorating ? t('sticker.decorate.hint') : ''}</View>
            <Button small kind={decorating ? 'calm' : 'plain'} onClick={() => setDecorating(!decorating)} testId="decorate">
              {decorating ? t('sticker.done') : t('sticker.decorate')}
            </Button>
          </View>
          {decorating ? (
            <View className="sticker-tray" data-testid="sticker-tray">
              {DECOR_KEYS.map((k) => (
                <View
                  key={k}
                  className={cx('tray-item', k === decorKey && 'selected')}
                  data-testid={`tray-${k}`}
                  onClick={() => setDecorKey(k)}
                >
                  <Image className="px-icon s36" src={stickerIcons[k]} mode="scaleToFill" />
                </View>
              ))}
              <Text className="small muted">{decorCount} / 20</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Frame>
        <View className="row">
          <CategoryIcon category={memory.category} size={36} />
          <View className="grow">
            <View data-testid="memory-date">{formatDate(memory.startDate, memory.datePrecision, memory.endDate)}</View>
            <View className="small muted">
              {t(`category.${memory.category}`)} · {t('memory.by', { name: memberName(status, memory.createdBy) })}
            </View>
          </View>
        </View>
        <View className="row wrap" style={{ marginTop: '6px' }}>
          {memory.place ? (
            <PlaceTag icon={memory.place.icon} name={memory.place.name} onClick={() => openMapAt(memory.place!.id, memory.id)} testId="memory-place" />
          ) : null}
          <View className="grow" />
          <Button small kind="plain" onClick={() => openTimelineAt(memory)} testId="detail-to-timeline">{t('map.toTimeline')}</Button>
        </View>
        {memory.note ? <View className="note" data-testid="memory-note">{memory.note}</View> : null}
      </Frame>

      <View className="section-title">{t('sticker.react')}</View>
      <View className="reactions">
        {REACTION_KEYS.map((k) => {
          const placed = memory.stickers.filter((s) => s.key === k && s.x === null)
          const mine = placed.some((s) => s.placedBy === me.id)
          return (
            <View key={k} className={cx('reaction', mine && 'mine')} data-testid={`reaction-${k}`} onClick={() => toggleReaction(k)}>
              <Image className="px-icon s36" src={stickerIcons[k]} mode="scaleToFill" />
              {placed.map((s) => (
                <Portrait key={s.id} status={status} memberId={s.placedBy} size="small" />
              ))}
            </View>
          )
        })}
      </View>

      <View className="section-title">{t('memory.photos')}</View>
      {memory.photos.length === 0 ? <View className="muted small">{t('memory.noPhotos')}</View> : null}
      <View className="photo-grid">
        {memory.photos.map((p, i) => (
          <View key={p.id} className="cell" data-testid="photo-cell" onClick={() => setViewing(i)}>
            <Image src={photoUrl(p.id, 'thumb')} mode="aspectFill" lazyLoad />
            {uploaders.size > 1 ? (
              <View className="uploader" data-testid="photo-uploader">
                <Portrait status={status} memberId={p.uploadedBy} size="small" />
              </View>
            ) : null}
            {isNew(p.uploadedBy, p.createdAt) ? <NewMark label={t('common.new')} /> : null}
          </View>
        ))}
        <View className="cell add" onClick={addPhotos} data-testid="add-photos">＋</View>
      </View>
      {progress ? (
        <View>
          <Text className="small muted">{t('memory.uploading', progress)}</Text>
          <Progress done={progress.done} total={progress.total} />
        </View>
      ) : null}

      <View className="section-title">{t('comment.title')}</View>
      {memory.comments.length === 0 ? <View className="muted small">{t('comment.empty')}</View> : null}
      {memory.comments.map((c) => (
        <View key={c.id} className="dialogue" data-testid="comment">
          <Portrait status={status} memberId={c.authorId} />
          <View className="grow">
            <View className="who">
              <Text className="name">{memberName(status, c.authorId)}</Text>
              <Text className="when">{c.createdAt.slice(0, 10).replace(/-/g, '.')}</Text>
              {isNew(c.authorId, c.createdAt) ? <NewMark label={t('common.new')} /> : null}
            </View>
            <View className="text" data-testid="comment-text">{c.text}</View>
          </View>
          {c.authorId === me.id ? (
            <View className="remove" data-testid="comment-delete" onClick={() => setConfirm({ kind: 'comment', comment: c })}>×</View>
          ) : null}
        </View>
      ))}
      <View className="say">
        <TextArea value={draft} onChange={setDraft} placeholder={t('comment.placeholder')} maxLength={COMMENT_MAX_LENGTH} name="comment" />
        <Button kind="primary" disabled={!draft.trim() || sending} onClick={send} testId="comment-send">{t('comment.send')}</Button>
      </View>

      <View style={{ marginTop: '36px' }}>
        <Button small onClick={() => setConfirm({ kind: 'memory' })} testId="delete-memory">{t('common.delete')}</Button>
      </View>

      {viewing !== null ? (
        <ImageViewer
          photos={memory.photos}
          index={viewing}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onDelete={(p) => setConfirm({ kind: 'photo', photo: p })}
        />
      ) : null}
      {confirm ? (
        <Confirm
          danger
          title={confirm.kind === 'memory' ? t('memory.delete.title') : confirm.kind === 'photo' ? t('viewer.delete.title') : t('comment.delete.title')}
          text={confirm.kind === 'memory' ? t('memory.delete.text') : confirm.kind === 'photo' ? t('viewer.delete.text') : t('comment.delete.text')}
          confirmText={t('common.delete')}
          onCancel={() => setConfirm(null)}
          onConfirm={remove}
        />
      ) : null}
      {toast}
    </View>
  )
}
