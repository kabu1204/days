import { useRef, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { centroid, groupPhotos, nearbyPlaces, todayLocal, type CategoryKey, type LatLon, type Place } from '@days/shared'
import { CATEGORY_KEYS } from '@days/shared'
import { api, runPool, uploadPhoto } from '../../api/client'
import { pickImages, readLocalPhoto, releaseLocalPhotos, type LocalPhoto } from '../../browser/photo'
import { useT } from '../../i18n'
import { ROUTES, getMapLowRes, timelineView, useMember, useStatus } from '../../state/session'
import { Button, CategoryIcon, DateDialog, Dialog, Frame, PlaceTag, Progress, TextInput, TopBar, cx } from '../../ui'
import { PlacePicker, choiceIcon, choiceName, resolvePlace, type PlaceChoice } from '../../ui/PlacePicker'

interface Group {
  key: string
  /** Start date of the memory; null until set for photos without a capture time. */
  date: string | null
  title: string
  category: CategoryKey
  skipped: boolean
  expanded: boolean
  items: LocalPhoto[]
  /** Mean position of the located photos, or null. */
  point: LatLon | null
  place: PlaceChoice | null
}

type Stage = 'select' | 'reading' | 'review' | 'importing' | 'done'
const PREVIEW_COUNT = 8
let groupCounter = 0

const defaultTitle = (date: string | null) => (date ? date.replace(/-/g, '.') : '')
/** A saved Place within about 100 m of the group's photos is proposed. */
const newGroup = (date: string | null, items: LocalPhoto[], places: Place[]): Group => {
  const point = centroid(items)
  const near = point ? nearbyPlaces(places, point)[0] : undefined
  return {
    key: `g${++groupCounter}`,
    date,
    title: defaultTitle(date),
    category: 'daily',
    skipped: false,
    expanded: false,
    items,
    point,
    place: near ? { kind: 'existing', place: near } : null,
  }
}

export default function ImportPage() {
  const t = useT()
  const me = useMember()
  const status = useStatus()
  const [stage, setStage] = useState<Stage>('select')
  const [groups, setGroups] = useState<Group[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [dateFor, setDateFor] = useState<string | null>(null)
  const [photoMenu, setPhotoMenu] = useState<{ group: string; index: number } | null>(null)
  const [result, setResult] = useState<{ memories: number; photos: number; failed: string[] } | null>(null)
  const [placeFor, setPlaceFor] = useState<string | null>(null)
  const all = useRef<LocalPhoto[]>([])
  const places = useRef<Place[]>([])

  if (!me) return <View className="page wide muted">{t('common.loading')}</View>

  const select = async () => {
    const files = await pickImages(true)
    if (!files.length) return
    setStage('reading')
    setProgress({ done: 0, total: files.length })
    const read: LocalPhoto[] = new Array(files.length)
    let done = 0
    await runPool(files, 4, async (file, i) => {
      read[i] = await readLocalPhoto(file, true)
      done++
      if (done % 5 === 0 || done === files.length) setProgress({ done, total: files.length })
    })
    all.current = [...all.current, ...read]
    places.current = (await api.places().catch(() => ({ places: places.current }))).places
    const proposed = groupPhotos(read).map((g) => newGroup(g.date, g.items, places.current))
    setGroups((existing) => [...existing, ...proposed])
    setStage('review')
  }

  const update = (key: string, patch: Partial<Group>) =>
    setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)))

  const mergeWithPrevious = (key: string) =>
    setGroups((gs) => {
      const i = gs.findIndex((g) => g.key === key)
      if (i <= 0) return gs
      const items = [...gs[i - 1].items, ...gs[i].items]
      const merged = { ...gs[i - 1], items, point: centroid(items) }
      return [...gs.slice(0, i - 1), merged, ...gs.slice(i + 1)]
    })

  const splitAt = (key: string, index: number) =>
    setGroups((gs) => {
      const i = gs.findIndex((g) => g.key === key)
      if (i < 0 || index <= 0) return gs
      const headItems = gs[i].items.slice(0, index)
      const head = { ...gs[i], items: headItems, point: centroid(headItems) }
      const tailItems = gs[i].items.slice(index)
      const tail = newGroup(tailItems[0].takenAt?.slice(0, 10) ?? gs[i].date, tailItems, places.current)
      tail.expanded = gs[i].expanded
      return [...gs.slice(0, i), head, tail, ...gs.slice(i + 1)]
    })

  const removePhoto = (key: string, index: number) =>
    setGroups((gs) =>
      gs
        .map((g) => {
          if (g.key !== key) return g
          const items = g.items.filter((_, j) => j !== index)
          return { ...g, items, point: centroid(items) }
        })
        .filter((g) => g.items.length > 0),
    )

  const active = groups.filter((g) => !g.skipped)
  const activePhotos = active.reduce((n, g) => n + g.items.length, 0)
  const missingDate = active.some((g) => !g.date)

  const runImport = async () => {
    setStage('importing')
    const total = activePhotos
    let done = 0
    let memories = 0
    let photos = 0
    const failed: string[] = []
    let lastMonth: string | null = null
    setProgress({ done, total })
    // New Places with the same name in one import become one Place.
    const created = new Map<string, number>()
    const placeIdOf = async (choice: PlaceChoice | null) => {
      if (choice?.kind !== 'new') return resolvePlace(choice)
      const known = created.get(choice.name)
      if (known !== undefined) return known
      const id = (await resolvePlace(choice))!
      created.set(choice.name, id)
      return id
    }
    for (const g of active) {
      const date = g.date ?? todayLocal()
      let memoryId: number
      try {
        const placeId = await placeIdOf(g.place)
        memoryId = (await api.createMemory({ title: g.title.trim() || defaultTitle(date), startDate: date, category: g.category, placeId })).id
        memories++
        lastMonth = date.slice(0, 7)
      } catch {
        failed.push(...g.items.map((p) => p.file.name))
        done += g.items.length
        setProgress({ done, total })
        continue
      }
      await runPool(g.items, 3, async (p, i) => {
        try {
          await uploadPhoto(memoryId, p.file, p, i)
          photos++
        } catch {
          failed.push(p.file.name)
        }
        setProgress({ done: ++done, total })
      })
    }
    if (lastMonth) timelineView.month = lastMonth
    releaseLocalPhotos(all.current)
    all.current = []
    setGroups([])
    setResult({ memories, photos, failed })
    setStage('done')
  }

  const dateGroup = groups.find((g) => g.key === dateFor)
  const placeGroup = groups.find((g) => g.key === placeFor)
  // Places named in this import are offered to the other groups as well.
  const pending: Place[] = groups
    .map((g) => g.place)
    .filter((c): c is Extract<PlaceChoice, { kind: 'new' }> => c?.kind === 'new')
    .filter((c, i, list) => list.findIndex((x) => x.name === c.name) === i)
    .map((c, i) => ({ ...c, id: -(i + 1), memoryCount: 0, firstDate: null, lastDate: null }))
  const menuGroup = photoMenu ? groups.find((g) => g.key === photoMenu.group) : null

  return (
    <View className="page wide">
      <TopBar title={t('import.title')} back />

      {stage === 'select' ? (
        <Frame tone="paper">
          <View>{t('import.text')}</View>
          <View className="small muted" style={{ margin: '6px 0 12px' }}>{t('import.desktopHint')}</View>
          <Button kind="primary" onClick={select} testId="import-select">{t('import.select')}</Button>
        </Frame>
      ) : null}

      {stage === 'reading' || stage === 'importing' ? (
        <Frame>
          <View data-testid="import-progress">{t(stage === 'reading' ? 'import.reading' : 'import.progress', progress)}</View>
          <Progress done={progress.done} total={progress.total} />
        </Frame>
      ) : null}

      {stage === 'review' ? (
        <>
          <View className="row between" style={{ marginBottom: '12px' }}>
            <Text data-testid="import-summary">{t('import.summary', { photos: activePhotos, groups: active.length })}</Text>
            <Button small onClick={select}>＋ {t('import.select')}</Button>
          </View>
          {groups.map((g, gi) => {
            const shown = g.expanded ? g.items : g.items.slice(0, PREVIEW_COUNT)
            const located = g.items.filter((p) => p.latitude !== null).length
            return (
              <Frame key={g.key} className={cx('import-group', g.skipped && 'skipped')}>
                <View className="import-head" data-testid="import-group">
                  <Button kind="plain" onClick={() => setDateFor(g.key)} testId="group-date">
                    {g.date ? g.date.replace(/-/g, '.') : '?'}
                  </Button>
                  <TextInput className="title-input" value={g.title} onChange={(v) => update(g.key, { title: v })} placeholder={t('memory.title.placeholder')} maxLength={80} />
                  <Button
                    kind="plain"
                    onClick={() => update(g.key, { category: CATEGORY_KEYS[(CATEGORY_KEYS.indexOf(g.category) + 1) % CATEGORY_KEYS.length] })}
                  >
                    <CategoryIcon category={g.category} />
                    <Text className="small">{t(`category.${g.category}`)}</Text>
                  </Button>
                </View>
                <View className="row wrap" style={{ marginTop: '6px' }}>
                  <Button small kind="plain" onClick={() => setPlaceFor(g.key)} testId="group-place">
                    {g.place ? <PlaceTag icon={choiceIcon(g.place)} name={choiceName(g.place)} /> : t('place.noPlace')}
                  </Button>
                </View>
                <View className="row wrap small muted" style={{ marginTop: '6px' }}>
                  <Text data-testid="group-count">{t('import.group.count', { n: g.items.length })}</Text>
                  {located ? <Text>· {located} {t('import.hasLocation')}</Text> : null}
                  {!g.date ? <Text className="bad">· {t('import.group.undated')}</Text> : null}
                  <View className="grow" />
                  {gi > 0 ? <Button small onClick={() => mergeWithPrevious(g.key)} testId="group-merge">{t('import.group.merge')}</Button> : null}
                  <Button small onClick={() => update(g.key, { skipped: !g.skipped })} testId="group-skip">
                    {t(g.skipped ? 'import.group.include' : 'import.group.skip')}
                  </Button>
                </View>
                <View className="thumb-strip">
                  {shown.map((p, i) => (
                    <View key={p.key} className="cell" data-testid="import-photo" onClick={() => setPhotoMenu({ group: g.key, index: i })}>
                      <Image src={p.preview} mode="aspectFill" lazyLoad />
                      {p.takenAt ? <Text className="tag">{p.takenAt.slice(11, 16)}</Text> : null}
                    </View>
                  ))}
                </View>
                {g.items.length > PREVIEW_COUNT ? (
                  <Button small kind="plain" onClick={() => update(g.key, { expanded: !g.expanded })}>
                    {g.expanded ? t('import.group.collapse') : `${t('import.group.expand')} (${g.items.length})`}
                  </Button>
                ) : null}
              </Frame>
            )
          })}
          <View className="sticky-bar row between">
            <Text className="small muted">{missingDate ? t('import.group.undated') : ''}</Text>
            <Button kind="primary" disabled={!active.length || missingDate} onClick={runImport} testId="import-start">
              {t('import.start', { n: active.length })}
            </Button>
          </View>
        </>
      ) : null}

      {stage === 'done' && result ? (
        <Frame tone="paper">
          <View data-testid="import-result">{t('import.finished', { memories: result.memories, photos: result.photos })}</View>
          {result.failed.length ? (
            <View className="error-text">
              {t('import.failed', { n: result.failed.length })} {result.failed.slice(0, 50).join(', ')}
            </View>
          ) : null}
          <View className="row wrap" style={{ marginTop: '12px' }}>
            <Button kind="primary" onClick={() => Taro.reLaunch({ url: ROUTES.timeline })} testId="import-open-timeline">{t('import.toTimeline')}</Button>
            <Button onClick={() => { setResult(null); setStage('select') }}>{t('import.more')}</Button>
          </View>
        </Frame>
      ) : null}

      {dateGroup ? (
        <DateDialog
          value={dateGroup.date ?? todayLocal()}
          precision="day"
          onClose={() => setDateFor(null)}
          onPick={(d) => {
            // A title that still equals the date follows the new date.
            const followsDate = dateGroup.title === defaultTitle(dateGroup.date)
            update(dateGroup.key, { date: d, title: followsDate ? defaultTitle(d) : dateGroup.title })
            setDateFor(null)
          }}
        />
      ) : null}

      {placeGroup ? (
        <PlacePicker
          places={[...places.current, ...pending]}
          point={placeGroup.point}
          tilesUrl={status?.mapTiles ?? null}
          lowRes={getMapLowRes()}
          onClose={() => setPlaceFor(null)}
          onPick={(choice) => {
            // A Place named earlier in this import is still new; it is created once.
            const named = choice?.kind === 'existing' && choice.place.id < 0 ? pending.find((p) => p.id === choice.place.id) : null
            update(placeGroup.key, {
              place: named ? { kind: 'new', name: named.name, city: named.city, icon: named.icon, latitude: named.latitude, longitude: named.longitude } : choice,
            })
            setPlaceFor(null)
          }}
        />
      ) : null}

      {photoMenu && menuGroup ? (
        <Dialog
          title={menuGroup.items[photoMenu.index]?.file.name}
          onClose={() => setPhotoMenu(null)}
          actions={<Button kind="plain" onClick={() => setPhotoMenu(null)}>{t('common.close')}</Button>}
        >
          {photoMenu.index > 0 ? (
            <Button block onClick={() => { splitAt(photoMenu.group, photoMenu.index); setPhotoMenu(null) }} testId="photo-split">
              {t('import.photo.split')}
            </Button>
          ) : null}
          <Button block onClick={() => { removePhoto(photoMenu.group, photoMenu.index); setPhotoMenu(null) }} testId="photo-remove">
            {t('import.photo.remove')}
          </Button>
        </Dialog>
      ) : null}
    </View>
  )
}
