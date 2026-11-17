import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import type { LatLon, Memory, Place, PlaceIconKey } from '@days/shared'
import { ApiFailure, api } from '../../api/client'
import { placeIcons } from '../../assets/manifest'
import { LazyMap } from '../../browser/LazyMap'
import { errorText, useT } from '../../i18n'
import { ROUTES, getMapLowRes, openMapAt, openTimelineAt, useMember, useStatus } from '../../state/session'
import { Button, Confirm, Dialog, Field, Frame, PlaceIcon, TextInput, TopBar, useToast } from '../../ui'
import { MemoryRow } from '../../ui/MemoryRow'
import { IconGrid } from '../../ui/PlacePicker'

type DialogState = null | 'edit' | 'merge' | 'split' | 'delete' | { mergeInto: Place }

/** One Place: its memories oldest first, and rename, move, merge, separate, and delete. */
export default function PlacePage() {
  const t = useT()
  const me = useMember()
  const status = useStatus()
  const id = Number(useRouter().params.id)
  const [place, setPlace] = useState<Place | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [others, setOthers] = useState<Place[]>([])
  const [dialog, setDialog] = useState<DialogState>(null)
  const [selecting, setSelecting] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [draft, setDraft] = useState({ name: '', city: '', icon: 'pin' as PlaceIconKey })
  const [error, setError] = useState('')
  const [toast, showToast] = useToast()
  const center = useRef<LatLon | null>(null)
  const [lowRes] = useState(getMapLowRes)

  const load = useCallback(() => {
    api.placeMemories(id).then(
      (r) => {
        setPlace(r.place)
        setMemories(r.memories)
      },
      () => Taro.reLaunch({ url: ROUTES.places }),
    )
  }, [id])

  useEffect(() => {
    if (me) load()
  }, [me, load])
  useDidShow(() => {
    if (me && place) load()
  })

  const marker = useMemo(() => (place ? [{ ...place, icon: placeIcons[place.icon] ?? placeIcons.pin }] : []), [place])
  if (!me || !place) return <View className="page muted">{t('common.loading')}</View>

  const fail = (err: unknown) => setError(errorText(t, err instanceof ApiFailure ? err.code : undefined))
  const close = () => {
    setDialog(null)
    setError('')
  }

  const openEdit = () => {
    setDraft({ name: place.name, city: place.city, icon: place.icon })
    center.current = null
    setDialog('edit')
  }
  const saveEdit = async () => {
    try {
      const moved = center.current ? { latitude: center.current.latitude, longitude: center.current.longitude } : {}
      setPlace(await api.updatePlace(place.id, { name: draft.name.trim(), city: draft.city.trim(), icon: draft.icon, ...moved }))
      close()
      showToast(t('common.done'))
    } catch (err) {
      fail(err)
    }
  }
  const openMerge = async () => {
    const all = (await api.places()).places
    setOthers(all.filter((p) => p.id !== place.id))
    setDialog('merge')
  }
  const merge = async (into: Place) => {
    try {
      await api.mergePlace(place.id, into.id)
      Taro.redirectTo({ url: `${ROUTES.place}?id=${into.id}` })
    } catch (err) {
      fail(err)
    }
  }
  const split = async () => {
    try {
      const created = await api.splitPlace(place.id, { memoryIds: [...checked], name: draft.name.trim() })
      Taro.redirectTo({ url: `${ROUTES.place}?id=${created.id}` })
    } catch (err) {
      fail(err)
    }
  }
  const remove = async () => {
    await api.deletePlace(place.id).catch(() => undefined)
    if (Taro.getCurrentPages().length > 1) Taro.navigateBack()
    else Taro.reLaunch({ url: ROUTES.places })
  }
  const toggle = (memoryId: number) => {
    const next = new Set(checked)
    if (next.has(memoryId)) next.delete(memoryId)
    else next.add(memoryId)
    setChecked(next)
  }

  let year = ''
  return (
    <View className="page">
      <TopBar title={place.name} back>
        <Button small kind="plain" onClick={openEdit} testId="edit-place">{t('common.edit')}</Button>
      </TopBar>

      <Frame>
        <View className="row">
          <PlaceIcon icon={place.icon} size={36} />
          <View className="grow">
            {place.city ? <View>{place.city}</View> : null}
            <View className="small muted" data-testid="place-count">{t('place.count', { n: place.memoryCount })}</View>
          </View>
          <Button small onClick={() => openMapAt(place.id)} testId="place-on-map">{t('place.onMap')}</Button>
        </View>
        <LazyMap className="short" places={marker} focus={{ latitude: place.latitude, longitude: place.longitude, zoom: 15 }} tilesUrl={status?.mapTiles ?? null} lowRes={lowRes} />
      </Frame>

      <View className="row between">
        <View className="section-title">{t('place.memories')}</View>
        {selecting ? <Text className="small" data-testid="selected-count">{t('place.selected', { n: checked.size })}</Text> : null}
      </View>
      {memories.length === 0 ? <View className="small muted">{t('place.empty')}</View> : null}
      {memories.map((m) => {
        const y = m.startDate.slice(0, 4)
        const header = y !== year ? <View className="year-divider">{(year = y)}</View> : null
        return (
          <View key={m.id}>
            {header}
            <MemoryRow
              memory={m}
              selecting={selecting}
              checked={checked.has(m.id)}
              onOpen={() => (selecting ? toggle(m.id) : Taro.navigateTo({ url: `${ROUTES.detail}?id=${m.id}` }))}
              onTimeline={() => openTimelineAt(m)}
            />
          </View>
        )
      })}

      {selecting ? (
        <View className="sticky-bar row between">
          <Button kind="plain" onClick={() => { setSelecting(false); setChecked(new Set()) }}>{t('common.cancel')}</Button>
          <Button
            kind="primary"
            disabled={checked.size === 0}
            onClick={() => { setDraft({ ...draft, name: '' }); setDialog('split') }}
            testId="split-confirm"
          >
            {t('place.split.create')}
          </Button>
        </View>
      ) : (
        <View className="row wrap" style={{ marginTop: '24px' }}>
          {memories.length > 1 ? <Button small onClick={() => setSelecting(true)} testId="place-split">{t('place.split')}</Button> : null}
          <Button small onClick={openMerge} testId="place-merge">{t('place.merge')}</Button>
          <Button small onClick={() => setDialog('delete')} testId="place-delete">{t('common.delete')}</Button>
        </View>
      )}

      {dialog === 'edit' ? (
        <Dialog
          title={t('place.edit')}
          onClose={close}
          actions={
            <>
              <Button kind="plain" onClick={close}>{t('common.cancel')}</Button>
              <Button kind="calm" disabled={!draft.name.trim()} onClick={saveEdit} testId="place-save">{t('common.save')}</Button>
            </>
          }
        >
          <Field label={t('place.name')}>
            <TextInput name="placeName" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} maxLength={40} />
          </Field>
          <Field label={t('place.city')}>
            <TextInput name="placeCity" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} maxLength={40} />
          </Field>
          <Field label={t('place.icon')}>
            <IconGrid value={draft.icon} onChange={(icon) => setDraft({ ...draft, icon })} />
          </Field>
          <Field label={t('place.position')} hint={t('place.position.hint')}>
            <LazyMap
              className="short"
              places={[]}
              crosshair
              focus={{ latitude: place.latitude, longitude: place.longitude, zoom: 16 }}
              tilesUrl={status?.mapTiles ?? null}
              lowRes={lowRes}
              onViewChanged={(v) => {
                // The first report is the starting position, not a change.
                if (Math.abs(v.latitude - place.latitude) > 1e-6 || Math.abs(v.longitude - place.longitude) > 1e-6) center.current = v
              }}
            />
          </Field>
          {error ? <View className="error-text">{error}</View> : null}
        </Dialog>
      ) : null}

      {dialog === 'merge' ? (
        <Dialog title={t('place.merge')} text={t('place.merge.text')} onClose={close} actions={<Button kind="plain" onClick={close}>{t('common.cancel')}</Button>}>
          {others.length === 0 ? <View className="small muted">{t('place.none')}</View> : null}
          <View className="dialog-list">
            {others.map((p) => (
              <View key={p.id} className="place-row" data-testid="merge-target" onClick={() => setDialog({ mergeInto: p })}>
                <PlaceIcon icon={p.icon} />
                <Text className="grow ellipsis">{p.name}</Text>
                <Text className="small muted">{t('place.count', { n: p.memoryCount })}</Text>
              </View>
            ))}
          </View>
        </Dialog>
      ) : null}

      {dialog && typeof dialog === 'object' ? (
        <Confirm
          title={t('place.merge.confirm', { from: place.name, into: dialog.mergeInto.name })}
          text={t('place.merge.confirmText', { n: place.memoryCount })}
          onCancel={close}
          onConfirm={() => merge(dialog.mergeInto)}
        />
      ) : null}

      {dialog === 'split' ? (
        <Dialog
          title={t('place.split.title', { n: checked.size })}
          onClose={close}
          actions={
            <>
              <Button kind="plain" onClick={close}>{t('common.cancel')}</Button>
              <Button kind="calm" disabled={!draft.name.trim()} onClick={split} testId="split-save">{t('common.save')}</Button>
            </>
          }
        >
          <View className="small muted" style={{ marginBottom: '9px' }}>{t('place.split.text')}</View>
          <Field label={t('place.name')}>
            <TextInput name="splitName" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} maxLength={40} />
          </Field>
          {error ? <View className="error-text">{error}</View> : null}
        </Dialog>
      ) : null}

      {dialog === 'delete' ? (
        <Confirm danger title={t('place.delete.title')} text={t('place.delete.text')} confirmText={t('common.delete')} onCancel={close} onConfirm={remove} />
      ) : null}
      {toast}
    </View>
  )
}

