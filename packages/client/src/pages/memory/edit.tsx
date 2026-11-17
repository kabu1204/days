import { useEffect, useState } from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import {
  CATEGORY_KEYS,
  centroid,
  isValidMonth,
  nearbyPlaces,
  normalizeStartDate,
  todayLocal,
  type CategoryKey,
  type DatePrecision,
  type LatLon,
  type Place,
} from '@days/shared'
import { ApiFailure, api, runPool, uploadPhoto } from '../../api/client'
import { pickImages, readLocalPhoto, releaseLocalPhotos, type LocalPhoto } from '../../browser/photo'
import { errorText, useT } from '../../i18n'
import { ROUTES, getMapLowRes, timelineView, useMember, useStatus } from '../../state/session'
import { Button, CategoryIcon, DateDialog, Field, Frame, PlaceTag, Progress, TextArea, TextInput, TopBar, cx, formatDate } from '../../ui'
import { PlacePicker, choiceIcon, choiceName, resolvePlace, type PlaceChoice } from '../../ui/PlacePicker'

export default function EditMemoryPage() {
  const t = useT()
  const me = useMember()
  const status = useStatus()
  const params = useRouter().params
  const id = params.id ? Number(params.id) : null

  const defaultDate = () => {
    const today = todayLocal()
    const m = params.month
    return isValidMonth(m) && m !== today.slice(0, 7) ? `${m}-01` : today
  }

  const [ready, setReady] = useState(id === null)
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<CategoryKey>('daily')
  const [precision, setPrecision] = useState<DatePrecision>('day')
  const [startDate, setStartDate] = useState(defaultDate)
  const [endDate, setEndDate] = useState<string | null>(null)
  const [dateTouched, setDateTouched] = useState(false)
  const [dateFromPhoto, setDateFromPhoto] = useState(false)
  const [photos, setPhotos] = useState<LocalPhoto[]>([])
  const [picker, setPicker] = useState<'start' | 'end' | null>(null)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [places, setPlaces] = useState<Place[]>([])
  const [place, setPlace] = useState<PlaceChoice | null>(null)
  /** Position of the photos already saved with an existing memory. */
  const [savedPoint, setSavedPoint] = useState<LatLon | null>(null)
  const [placePicker, setPlacePicker] = useState<null | 'list' | 'name'>(null)

  useEffect(() => {
    if (!me || id === null) return
    api.memory(id).then((m) => {
      setTitle(m.title)
      setNote(m.note)
      setCategory(m.category)
      setPrecision(m.datePrecision)
      setStartDate(m.startDate)
      setEndDate(m.endDate)
      setPlace(m.place ? { kind: 'existing', place: m.place } : null)
      setSavedPoint(centroid(m.photos))
      setReady(true)
    }, () => Taro.navigateBack())
  }, [me, id])

  useEffect(() => {
    if (me) api.places().then((r) => setPlaces(r.places), () => undefined)
  }, [me])

  // A saved Place within about 100 m of the photos is offered.
  const point = centroid(photos) ?? savedPoint
  const suggestion = !place && point ? nearbyPlaces(places, point)[0] ?? null : null

  useEffect(() => () => releaseLocalPhotos(photos), []) // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = async () => {
    const files = await pickImages(true)
    if (!files.length) return
    const read = await Promise.all(files.map((f) => readLocalPhoto(f)))
    const all = [...photos, ...read]
    setPhotos(all)
    // The date follows the earliest photo until the user chooses one.
    if (!dateTouched) {
      const dates = all.map((p) => p.takenAt).filter((d): d is string => !!d).sort()
      if (dates.length) {
        setStartDate(dates[0].slice(0, 10))
        setPrecision('day')
        setDateFromPhoto(true)
      }
    }
  }

  const save = async () => {
    if (!title.trim()) return setError(t('memory.titleRequired'))
    const start = normalizeStartDate(startDate, precision)
    const body = { title: title.trim(), note, category, datePrecision: precision, startDate: start, endDate: endDate && endDate >= start ? endDate : null }
    setBusy(true)
    setError('')
    try {
      const placeId = await resolvePlace(place)
      const memory = id === null ? await api.createMemory({ ...body, placeId }) : await api.updateMemory(id, { ...body, placeId })
      let failed = 0
      if (photos.length) {
        let done = 0
        setProgress({ done, total: photos.length })
        await runPool(photos, 3, async (p, i) => {
          try {
            await uploadPhoto(memory.id, p.file, p, i)
          } catch {
            failed++
          }
          setProgress({ done: ++done, total: photos.length })
        })
      }
      timelineView.month = memory.startDate.slice(0, 7)
      if (failed) Taro.setStorageSync('days.notice', t('memory.uploadFailed', { n: failed }))
      if (id === null) Taro.redirectTo({ url: `${ROUTES.detail}?id=${memory.id}` })
      else Taro.navigateBack()
    } catch (err) {
      setError(errorText(t, err instanceof ApiFailure ? err.code : undefined))
      setBusy(false)
      setProgress(null)
    }
  }

  if (!me || !ready) return <View className="page muted">{t('common.loading')}</View>

  return (
    <View className="page">
      <TopBar title={id === null ? t('memory.new') : t('memory.edit')} back />

      {id === null ? (
        <Field label={t('memory.photos')}>
          <View className="photo-grid">
            {photos.map((p) => (
              <View key={p.key} className="cell">
                <Image src={p.preview} mode="aspectFill" />
                <View className="remove" onClick={() => setPhotos(photos.filter((x) => x.key !== p.key))}>✕</View>
              </View>
            ))}
            <View className="cell add" onClick={addPhotos} data-testid="add-photos">＋</View>
          </View>
        </Field>
      ) : null}

      <Field label={t('memory.title')}>
        <TextInput name="title" value={title} onChange={setTitle} placeholder={t('memory.title.placeholder')} maxLength={80} />
      </Field>

      <Field label={t('memory.date')} hint={dateFromPhoto && !dateTouched ? t('memory.dateFromPhoto') : undefined}>
        <View className="row wrap">
          <Button kind="plain" onClick={() => setPicker('start')} testId="pick-start">{formatDate(normalizeStartDate(startDate, precision), precision)}</Button>
          <Button small selected={precision === 'day'} onClick={() => setPrecision('day')} testId="precision-day">{t('memory.precision.day')}</Button>
          <Button small selected={precision === 'month'} onClick={() => { setPrecision('month'); setEndDate(null) }} testId="precision-month">{t('memory.precision.month')}</Button>
        </View>
      </Field>

      {precision === 'day' ? (
        <Field label={t('memory.endDate')}>
          <View className="row wrap">
            <Button kind="plain" onClick={() => setPicker('end')} testId="pick-end">
              {endDate ? formatDate(endDate, 'day') : t('memory.endDate.none')}
            </Button>
            {endDate ? <Button small onClick={() => setEndDate(null)}>{t('memory.endDate.clear')}</Button> : null}
          </View>
        </Field>
      ) : null}

      <Field label={t('memory.place')}>
        <View className="row wrap">
          <Button kind="plain" onClick={() => setPlacePicker('list')} testId="pick-place">
            {place ? <PlaceTag icon={choiceIcon(place)} name={choiceName(place)} testId="chosen-place" /> : t('place.noPlace')}
          </Button>
          {place ? <Button small onClick={() => setPlace(null)} testId="clear-place">{t('place.clear')}</Button> : null}
        </View>
        {suggestion ? (
          <View className="suggest" data-testid="place-suggest">
            <Text className="small">{t('place.suggest', { name: suggestion.name })}</Text>
            <Button small kind="calm" onClick={() => setPlace({ kind: 'existing', place: suggestion })} testId="place-suggest-use">
              {t('place.useNamed', { name: suggestion.name })}
            </Button>
          </View>
        ) : !place && point ? (
          <View className="suggest" data-testid="place-suggest">
            <Text className="small">{t('place.photosLocated')}</Text>
            <Button small kind="calm" onClick={() => setPlacePicker('name')} testId="place-suggest-new">{t('place.newAtPhotos')}</Button>
          </View>
        ) : null}
      </Field>

      <Field label={t('memory.category')}>
        <Frame className="flat">
          <View className="category-grid">
            {CATEGORY_KEYS.map((c) => (
              <View key={c} className={cx('category-cell', c === category && 'selected')} data-testid={`category-${c}`} onClick={() => setCategory(c)}>
                <CategoryIcon category={c} />
                <Text>{t(`category.${c}`)}</Text>
              </View>
            ))}
          </View>
        </Frame>
      </Field>

      <Field label={t('memory.note')}>
        <TextArea name="note" value={note} onChange={setNote} placeholder={t('memory.note.placeholder')} />
      </Field>

      {error ? <View className="error-text" data-testid="form-error">{error}</View> : null}
      {progress ? (
        <View>
          <View className="small muted">{t('memory.uploading', progress)}</View>
          <Progress done={progress.done} total={progress.total} />
        </View>
      ) : null}
      <Button block kind="primary" disabled={busy} onClick={save} testId="save">{t('common.save')}</Button>

      {placePicker !== null ? (
        <PlacePicker
          places={places}
          point={point}
          tilesUrl={status?.mapTiles ?? null}
          lowRes={getMapLowRes()}
          startWithName={placePicker === 'name'}
          onClose={() => setPlacePicker(null)}
          onPick={(choice) => {
            setPlace(choice)
            setPlacePicker(null)
          }}
        />
      ) : null}
      {picker === 'start' ? (
        <DateDialog
          value={startDate}
          precision={precision}
          onClose={() => setPicker(null)}
          onPick={(d) => {
            setStartDate(d)
            setDateTouched(true)
            if (endDate && endDate < d) setEndDate(null)
            setPicker(null)
          }}
        />
      ) : null}
      {picker === 'end' ? (
        <DateDialog
          value={endDate ?? startDate}
          precision="day"
          min={startDate}
          onClose={() => setPicker(null)}
          onPick={(d) => {
            setEndDate(d === startDate ? null : d)
            setPicker(null)
          }}
        />
      ) : null}
    </View>
  )
}
