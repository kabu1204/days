import { useState } from 'react'
import { View } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { toLocalIso, type Badge } from '@days/shared'
import { api } from '../../api/client'
import { badgeIcons } from '../../assets/manifest'
import { useT } from '../../i18n'
import { loadStatus, useMember } from '../../state/session'
import { Frame, Icon, TopBar, formatDate } from '../../ui'
import { NewMark } from '../../ui/Stickers'

/**
 * The badge album. Only unlocked badges are listed: there are no empty
 * slots and no progress, so nothing reads as missing.
 */
export default function AlbumPage() {
  const t = useT()
  const me = useMember()
  const [badges, setBadges] = useState<Badge[] | null>(null)

  useDidShow(() => {
    api.badges().then(
      (r) => {
        setBadges(r.badges)
        // The list keeps its markers for this visit; the timeline marker clears.
        if (r.badges.some((b) => !b.seen)) {
          api.badgesSeen().then(() => loadStatus(true), () => undefined)
        }
      },
      () => setBadges([]),
    )
  })

  if (!me || !badges) return <View className="page muted">{t('common.loading')}</View>

  return (
    <View className="page">
      <TopBar title={t('album.title')} back />
      <View className="small muted" style={{ marginBottom: '9px' }}>{t('album.text')}</View>
      {badges.length === 0 ? (
        <Frame>
          <View className="small muted" data-testid="album-empty">{t('album.empty')}</View>
        </Frame>
      ) : (
        <View className="badge-grid">
          {badges.map((b) => (
            <Frame key={b.key} className="badge-cell">
              <View data-testid={`badge-${b.key}`} className="badge-body">
                {b.seen ? null : <NewMark label={t('common.new')} />}
                <Icon src={badgeIcons[b.key]} size={48} />
                <View className="badge-name">{t(`badge.${b.key}`)}</View>
                <View className="small muted">{t(`badge.${b.key}.text`)}</View>
                <View className="small quiet">{t('album.unlocked', { date: formatDate(toLocalIso(new Date(b.unlockedAt)).slice(0, 10), 'day') })}</View>
              </View>
            </Frame>
          ))}
        </View>
      )}
    </View>
  )
}
