import { Image, Text, View } from '@tarojs/components'
import type { Memory } from '@days/shared'
import { photoUrl } from '../api/client'
import { useT } from '../i18n'
import { Button, CategoryIcon, cx, formatDate } from './index'

/** One memory in a list of memories at a Place. */
export function MemoryRow(props: {
  memory: Memory
  highlight?: boolean
  /** In selection mode the row shows a check box instead of the timeline button. */
  selecting?: boolean
  checked?: boolean
  onOpen: () => void
  onTimeline?: () => void
}) {
  const t = useT()
  const m = props.memory
  return (
    <View
      id={`memory-row-${m.id}`}
      className={cx('memory-row', props.highlight && 'selected', props.checked && 'checked')}
      data-testid="place-memory"
      onClick={props.onOpen}
    >
      <View className="thumb">
        {m.photos.length ? <Image src={photoUrl(m.photos[0].id, 'thumb')} mode="aspectFill" lazyLoad /> : <CategoryIcon category={m.category} size={36} />}
      </View>
      <View className="grow">
        <View className="ellipsis" data-testid="place-memory-title">{m.title}</View>
        <View className="small muted">{formatDate(m.startDate, m.datePrecision, m.endDate)}</View>
      </View>
      {props.selecting ? (
        <Text className="check">{props.checked ? '■' : '□'}</Text>
      ) : props.onTimeline ? (
        <Button small onClick={props.onTimeline} testId="to-timeline">{t('map.toTimeline')}</Button>
      ) : null}
    </View>
  )
}
