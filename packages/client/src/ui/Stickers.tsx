import { Image, Text, View } from '@tarojs/components'
import { REACTION_KEYS, type StickerPlacement } from '@days/shared'
import { speechIcon, stickerIcons } from '../assets/manifest'
import { cx } from '.'

/** Decorative stickers drawn over a cover photo; positions are fractions of its size. */
export function DecorLayer(props: { stickers: StickerPlacement[]; size: 36 | 48; onTap?: (s: StickerPlacement) => void }) {
  return (
    <>
      {props.stickers
        .filter((s) => s.x !== null && s.y !== null)
        .map((s) => (
          <View
            key={s.id}
            className={cx('decor', `s${props.size}`, props.onTap && 'link')}
            data-testid={`decor-${s.key}`}
            style={{ left: `${s.x! * 100}%`, top: `${s.y! * 100}%`, backgroundImage: `url("${stickerIcons[s.key]}")` }}
            onClick={(e) => {
              if (!props.onTap) return
              e.stopPropagation()
              props.onTap(s)
            }}
          />
        ))}
    </>
  )
}

/** Reaction counts and the number of conversation lines, for cards and lists. */
export function ReactionSummary(props: { stickers: StickerPlacement[]; commentCount: number }) {
  const counts = REACTION_KEYS.map((k) => ({ k, n: props.stickers.filter((s) => s.key === k && s.x === null).length })).filter((e) => e.n > 0)
  if (!counts.length && !props.commentCount) return null
  return (
    <View className="reaction-summary" data-testid="reaction-summary">
      {counts.map(({ k, n }) => (
        <View key={k} className="item">
          <Image className="px-icon s24" src={stickerIcons[k]} mode="scaleToFill" />
          {n > 1 ? <Text>{n}</Text> : null}
        </View>
      ))}
      {props.commentCount ? (
        <View className="item" data-testid="comment-count">
          <Image className="px-icon s24" src={speechIcon} mode="scaleToFill" />
          <Text>{props.commentCount}</Text>
        </View>
      ) : null}
    </View>
  )
}

/** A small marker for items the partner added since the viewer last looked. */
export function NewMark(props: { label: string }) {
  return <Text className="new-mark" data-testid="new-mark">{props.label}</Text>
}
