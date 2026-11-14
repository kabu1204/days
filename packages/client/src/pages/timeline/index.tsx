import { useCallback, useEffect, useRef, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { pad2, todayLocal, type Memory, type TimelineSummary } from '@days/shared'
import { api, photoUrl } from '../../api/client'
import { logo } from '../../assets/manifest'
import { useT } from '../../i18n'
import { ROUTES, timelineView, useMember } from '../../state/session'
import { Button, CategoryIcon, Frame, Icon, cx, formatDate } from '../../ui'

export default function TimelinePage() {
  const t = useT()
  const me = useMember()
  const [summary, setSummary] = useState<TimelineSummary | null>(null)
  const [month, setMonth] = useState<string>(timelineView.month ?? todayLocal().slice(0, 7))
  const [memories, setMemories] = useState<Memory[] | null>(null)
  const latest = useRef(month)

  const loadMonth = useCallback((m: string) => {
    latest.current = m
    timelineView.month = m
    setMonth(m)
    setMemories(null)
    api.month(m).then((r) => {
      // A slower answer for a month that is no longer selected is ignored.
      if (latest.current === m) setMemories(r.memories)
    }, () => undefined)
  }, [])

  const refresh = useCallback(() => {
    api.summary().then((s) => {
      setSummary(s)
      let target = timelineView.month
      if (!target) {
        // First visit: open the most recent month that has memories.
        const last = s.years[s.years.length - 1]
        if (last) {
          const idx = last.months.reduce((acc, n, i) => (n > 0 ? i : acc), 0)
          target = `${last.year}-${pad2(idx + 1)}`
        } else {
          target = todayLocal().slice(0, 7)
        }
      }
      loadMonth(target)
    }, () => undefined)
  }, [loadMonth])

  useEffect(() => {
    if (me) refresh()
  }, [me, refresh])
  // Returning from the editor or detail page shows the current data.
  useDidShow(() => {
    if (me && summary) refresh()
  })

  if (!me || !summary) return <View className="page muted">{t('common.loading')}</View>

  const year = Number(month.slice(0, 4))
  const monthIndex = Number(month.slice(5, 7)) - 1
  const thisYear = Number(todayLocal().slice(0, 4))
  const years = [...summary.years]
  for (const y of [thisYear, year]) {
    if (!years.some((e) => e.year === y)) years.push({ year: y, total: 0, months: new Array(12).fill(0) })
  }
  years.sort((a, b) => a.year - b.year)
  const current = years.find((y) => y.year === year)!
  const empty = summary.years.length === 0

  const selectYear = (y: number) => {
    const entry = years.find((e) => e.year === y)!
    const firstLit = entry.months.findIndex((n) => n > 0)
    loadMonth(`${y}-${pad2((firstLit >= 0 ? firstLit : monthIndex) + 1)}`)
  }

  return (
    <View className="page">
      <View className="topbar">
        <Icon src={logo} size={36} />
        <Text className="h1">{t('app.name')}</Text>
        <Button small kind="plain" onClick={() => Taro.navigateTo({ url: ROUTES.settings })} testId="open-settings">
          {t('settings.title')}
        </Button>
      </View>

      {empty ? (
        <Frame tone="paper">
          <View className="h1">{t('timeline.empty.title')}</View>
          <View className="muted" style={{ margin: '6px 0 12px' }}>{t('timeline.empty.text')}</View>
          <View className="row wrap">
            <Button kind="primary" onClick={() => Taro.navigateTo({ url: ROUTES.edit })}>{t('timeline.new')}</Button>
            <Button onClick={() => Taro.navigateTo({ url: ROUTES.importer })}>{t('settings.import')}</Button>
          </View>
        </Frame>
      ) : (
        <>
          <View className="years">
            {years.map((y) => (
              <View
                key={y.year}
                className={cx('px-frame year-badge', y.year === year && 'selected')}
                data-testid={`year-${y.year}`}
                onClick={() => selectYear(y.year)}
              >
                <Text className="y">{y.year}</Text>
                <Text className="n">{y.total > 0 ? y.total : '·'}</Text>
              </View>
            ))}
          </View>

          <Frame className="ruler">
            {current.months.map((n, i) => (
              <View
                key={i}
                className={cx('ruler-cell', n > 0 && 'lit', i === monthIndex && 'selected')}
                data-testid={`month-${i + 1}`}
                onClick={() => loadMonth(`${year}-${pad2(i + 1)}`)}
              >
                <View className="lamp" />
                <Text>{i + 1}</Text>
              </View>
            ))}
          </Frame>

          <View className="month-title">
            <Text className="h1">{year}.{pad2(monthIndex + 1)}</Text>
          </View>

          {memories === null ? (
            <View className="muted">{t('common.loading')}</View>
          ) : memories.length === 0 ? (
            <View className="muted" data-testid="quiet-month">{t('timeline.quiet')}</View>
          ) : (
            <View>
              {memories.map((m) => (
                <Frame key={m.id} className="card" onClick={() => Taro.navigateTo({ url: `${ROUTES.detail}?id=${m.id}` })}>
                  {m.photos.length > 0 ? (
                    <View className="cover">
                      <Image className="cover-img" src={photoUrl(m.photos[0].id, 'medium')} mode="aspectFill" lazyLoad />
                      {m.photos.length > 1 ? <Text className="count">{m.photos.length}</Text> : null}
                    </View>
                  ) : (
                    <View className="no-cover">
                      <CategoryIcon category={m.category} size={48} />
                    </View>
                  )}
                  <View className="caption">
                    <CategoryIcon category={m.category} />
                    <View className="grow">
                      <View className="title ellipsis" data-testid="card-title">{m.title}</View>
                      <View className="date">{formatDate(m.startDate, m.datePrecision, m.endDate)}</View>
                    </View>
                  </View>
                </Frame>
              ))}
            </View>
          )}
        </>
      )}

      <View className="fab">
        <Button kind="primary" onClick={() => Taro.navigateTo({ url: `${ROUTES.edit}?month=${month}` })} testId="new-memory">
          ＋ {t('timeline.new')}
        </Button>
      </View>
    </View>
  )
}
