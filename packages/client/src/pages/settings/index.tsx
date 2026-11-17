import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Lang } from '@days/shared'
import { EXPORT_URL, api } from '../../api/client'
import { copyText, currentOrigin, downloadUrl } from '../../browser/photo'
import { getLang, setLang, useT } from '../../i18n'
import { ROUTES, clearStatus, getMapLowRes, loadStatus, setMapLowRes, useMember, useStatus } from '../../state/session'
import { Button, Field, Frame, TextInput, TopBar, useToast } from '../../ui'

export default function SettingsPage() {
  const t = useT()
  const me = useMember()
  const status = useStatus()
  const [name, setName] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [toast, showToast] = useToast()
  const [lowRes, setLowRes] = useState(getMapLowRes)

  if (!me || !status) return <View className="page muted">{t('common.loading')}</View>
  const partner = status.members.find((m) => m.id !== me.id)
  const lang = getLang()

  const chooseLang = async (next: Lang) => {
    setLang(next)
    await api.updateMe({ lang: next }).catch(() => undefined)
    loadStatus(true)
  }
  const saveName = async () => {
    const value = (name ?? '').trim()
    if (!value) return
    await api.updateMe({ displayName: value })
    await loadStatus(true)
    setName(null)
    showToast(t('common.done'))
  }
  const createLink = async () => {
    const { token } = await api.createInvitation()
    setLink(`${currentOrigin()}/#${ROUTES.invite}?token=${token}`)
  }
  const signOut = async () => {
    await api.signOut().catch(() => undefined)
    clearStatus()
    Taro.reLaunch({ url: ROUTES.signin })
  }

  return (
    <View className="page">
      <TopBar title={t('settings.title')} back={ROUTES.timeline} />

      <View className="section-title">{t('settings.profile')}</View>
      <Frame>
        <Field label={t('auth.displayName')}>
          <View className="row">
            <View className="grow">
              <TextInput name="displayName" value={name ?? me.displayName} onChange={setName} maxLength={24} />
            </View>
            <Button small kind="calm" disabled={name === null || !name.trim() || name.trim() === me.displayName} onClick={saveName} testId="save-name">
              {t('common.save')}
            </Button>
          </View>
        </Field>
        <Field label={t('settings.mapStyle')} hint={t('settings.mapStyle.hint')}>
          <View className="row">
            <Button small selected={lowRes} onClick={() => { setMapLowRes(true); setLowRes(true) }} testId="map-pixel-on">{t('settings.mapStyle.pixel')}</Button>
            <Button small selected={!lowRes} onClick={() => { setMapLowRes(false); setLowRes(false) }} testId="map-pixel-off">{t('settings.mapStyle.smooth')}</Button>
          </View>
        </Field>
        <Field label={t('settings.language')}>
          <View className="row">
            <Button small selected={lang === 'zh-CN'} onClick={() => chooseLang('zh-CN')} testId="lang-zh">中文</Button>
            <Button small selected={lang === 'en'} onClick={() => chooseLang('en')} testId="lang-en">English</Button>
          </View>
        </Field>
      </Frame>

      <View className="section-title">{t('settings.partner')}</View>
      <Frame>
        {partner ? (
          <Text data-testid="partner-joined">{t('settings.partner.joined', { name: partner.displayName })}</Text>
        ) : (
          <View>
            <View>{t('settings.partner.none')}</View>
            <View className="small muted" style={{ margin: '6px 0' }}>{t('settings.invite.text')}</View>
            <Button kind="primary" onClick={createLink} testId="create-invite">{t('settings.invite.create')}</Button>
            {link ? (
              <View style={{ marginTop: '9px' }}>
                <View className="px-input small" style={{ wordBreak: 'break-all', userSelect: 'all' }} data-testid="invite-link">{link}</View>
                <Button small onClick={async () => showToast((await copyText(link)) ? t('common.copied') : link)}>{t('common.copy')}</Button>
              </View>
            ) : null}
          </View>
        )}
      </Frame>

      <View className="section-title">{t('settings.data')}</View>
      <Frame>
        <View className="small muted" style={{ marginBottom: '6px' }}>{t('settings.export.text')}</View>
        <Button block kind="calm" onClick={() => downloadUrl(EXPORT_URL)} testId="export">{t('settings.export')}</Button>
        <Button block onClick={() => Taro.navigateTo({ url: ROUTES.importer })} testId="open-import">{t('settings.import')}</Button>
        <Button block kind="plain" onClick={() => Taro.navigateTo({ url: ROUTES.places })} testId="open-places">{t('places.title')}</Button>
        <Button block kind="plain" onClick={() => Taro.navigateTo({ url: ROUTES.trash })} testId="open-trash">{t('settings.trash')}</Button>
      </Frame>

      <View className="section-title">{t('settings.lab')}</View>
      <Frame>
        <Button block kind="plain" onClick={() => Taro.navigateTo({ url: ROUTES.labExif })}>{t('settings.lab.exif')}</Button>
        <Button block kind="plain" onClick={() => Taro.navigateTo({ url: ROUTES.labMap })}>{t('settings.lab.map')}</Button>
        <Button block kind="plain" onClick={() => Taro.navigateTo({ url: ROUTES.labPixel })}>{t('settings.lab.pixel')}</Button>
      </Frame>

      <View style={{ marginTop: '24px' }}>
        <Button onClick={signOut} testId="signout">{t('auth.signout')}</Button>
      </View>
      {toast}
    </View>
  )
}
