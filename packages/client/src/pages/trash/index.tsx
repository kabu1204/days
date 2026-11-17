import { useCallback, useEffect, useState } from 'react'
import { Image, View } from '@tarojs/components'
import type { Memory } from '@days/shared'
import { api, photoUrl, type TrashComment, type TrashPhoto } from '../../api/client'
import { useT } from '../../i18n'
import { memberName, useMember, useStatus } from '../../state/session'
import { Button, Frame, TopBar, formatDate } from '../../ui'

export default function TrashPage() {
  const t = useT()
  const me = useMember()
  const status = useStatus()
  const [data, setData] = useState<{ memories: Memory[]; photos: TrashPhoto[]; comments: TrashComment[] } | null>(null)
  const load = useCallback(() => {
    api.trash().then(setData, () => undefined)
  }, [])
  useEffect(() => {
    if (me) load()
  }, [me, load])

  if (!me || !data) return <View className="page muted">{t('common.loading')}</View>
  const empty = !data.memories.length && !data.photos.length && !data.comments.length

  return (
    <View className="page">
      <TopBar title={t('trash.title')} back />
      <View className="small muted">{t('trash.text')}</View>
      {empty ? <View className="muted" style={{ marginTop: '18px' }} data-testid="trash-empty">{t('trash.empty')}</View> : null}

      {data.memories.length ? <View className="section-title">{t('trash.memories')}</View> : null}
      {data.memories.map((m) => (
        <Frame key={m.id}>
          <View className="row">
            <View className="grow">
              <View className="ellipsis">{m.title}</View>
              <View className="small muted">
                {formatDate(m.startDate, m.datePrecision, m.endDate)} · {t('timeline.photos', { n: m.photos.length })}
              </View>
            </View>
            <Button small kind="calm" onClick={() => api.restoreMemory(m.id).then(load)} testId="restore-memory">{t('common.restore')}</Button>
          </View>
        </Frame>
      ))}

      {data.photos.length ? <View className="section-title">{t('trash.photos')}</View> : null}
      {data.photos.map((p) => (
        <Frame key={p.id}>
          <View className="row">
            <Image src={photoUrl(p.id, 'thumb')} mode="aspectFill" style={{ width: '48px', height: '48px', flex: 'none' }} />
            <View className="grow small muted ellipsis">{t('trash.photoOf', { title: p.memoryTitle })}</View>
            <Button small kind="calm" onClick={() => api.restorePhoto(p.id).then(load)} testId="restore-photo">{t('common.restore')}</Button>
          </View>
        </Frame>
      ))}

      {data.comments.length ? <View className="section-title">{t('trash.comments')}</View> : null}
      {data.comments.map((c) => (
        <Frame key={c.id}>
          <View className="row">
            <View className="grow">
              <View className="ellipsis" data-testid="trash-comment">{c.text}</View>
              <View className="small muted ellipsis">{memberName(status, c.authorId)} · {t('trash.commentOf', { title: c.memoryTitle })}</View>
            </View>
            {c.authorId === me.id ? (
              <Button small kind="calm" onClick={() => api.restoreComment(c.id).then(load)} testId="restore-comment">{t('common.restore')}</Button>
            ) : null}
          </View>
        </Frame>
      ))}
    </View>
  )
}
