import { useCallback, useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import type { Memory, Photo } from '@days/shared'
import { api, photoUrl, runPool, uploadPhoto } from '../../api/client'
import { pickImages, readLocalPhoto } from '../../browser/photo'
import { useT } from '../../i18n'
import { ROUTES, memberName, openMapAt, openTimelineAt, timelineView, useMember, useStatus } from '../../state/session'
import { Button, CategoryIcon, Confirm, Frame, PlaceTag, Progress, TopBar, formatDate, useToast } from '../../ui'
import { ImageViewer } from '../../ui/ImageViewer'

export default function MemoryDetailPage() {
  const t = useT()
  const me = useMember()
  const status = useStatus()
  const id = Number(useRouter().params.id)
  const [memory, setMemory] = useState<Memory | null>(null)
  const [viewing, setViewing] = useState<number | null>(null)
  const [confirm, setConfirm] = useState<'memory' | Photo | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [toast, showToast] = useToast()

  const load = useCallback(() => {
    timelineView.memoryId = id
    api.memory(id).then(setMemory, () => Taro.reLaunch({ url: ROUTES.timeline }))
  }, [id])

  useEffect(() => {
    if (me) load()
  }, [me, load])
  useDidShow(() => {
    if (me && memory) load()
    const notice = Taro.getStorageSync('days.notice')
    if (notice) {
      Taro.removeStorageSync('days.notice')
      showToast(notice)
    }
  })

  if (!me || !memory) return <View className="page muted">{t('common.loading')}</View>

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
    if (target === 'memory') {
      await api.deleteMemory(memory.id)
      timelineView.month = memory.startDate.slice(0, 7)
      if (Taro.getCurrentPages().length > 1) Taro.navigateBack()
      else Taro.reLaunch({ url: ROUTES.timeline })
    } else if (target) {
      await api.deletePhoto(target.id)
      setViewing(null)
      load()
    }
  }

  return (
    <View className="page">
      <TopBar title={memory.title} back>
        <Button small kind="plain" onClick={() => Taro.navigateTo({ url: `${ROUTES.edit}?id=${memory.id}` })} testId="edit-memory">
          {t('common.edit')}
        </Button>
      </TopBar>

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

      <View className="section-title">{t('memory.photos')}</View>
      {memory.photos.length === 0 ? <View className="muted small">{t('memory.noPhotos')}</View> : null}
      <View className="photo-grid">
        {memory.photos.map((p, i) => (
          <View key={p.id} className="cell" data-testid="photo-cell" onClick={() => setViewing(i)}>
            <Image src={photoUrl(p.id, 'thumb')} mode="aspectFill" lazyLoad />
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

      <View style={{ marginTop: '36px' }}>
        <Button small onClick={() => setConfirm('memory')} testId="delete-memory">{t('common.delete')}</Button>
      </View>

      {viewing !== null ? (
        <ImageViewer photos={memory.photos} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} onDelete={(p) => setConfirm(p)} />
      ) : null}
      {confirm ? (
        <Confirm
          danger
          title={confirm === 'memory' ? t('memory.delete.title') : t('viewer.delete.title')}
          text={confirm === 'memory' ? t('memory.delete.text') : t('viewer.delete.text')}
          confirmText={t('common.delete')}
          onCancel={() => setConfirm(null)}
          onConfirm={remove}
        />
      ) : null}
      {toast}
    </View>
  )
}
