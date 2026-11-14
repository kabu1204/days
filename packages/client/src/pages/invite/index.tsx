import { useEffect, useState } from 'react'
import { View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { api } from '../../api/client'
import { getLang, useT } from '../../i18n'
import { loadStatus, ROUTES } from '../../state/session'
import { AuthForm } from '../../ui/AuthForm'
import { Button, Frame } from '../../ui'

export default function InvitePage() {
  const t = useT()
  const token = useRouter().params.token ?? ''
  const [valid, setValid] = useState<boolean | null>(null)

  useEffect(() => {
    if (!token) return setValid(false)
    api.checkInvitation(token).then((r) => setValid(r.valid), () => setValid(false))
  }, [token])

  if (valid === null) return <View className="page muted">{t('common.loading')}</View>
  if (!valid) {
    return (
      <View className="page">
        <Frame>
          <View data-testid="invite-invalid">{t('auth.invite.invalid')}</View>
          <View style={{ marginTop: '12px' }}>
            <Button onClick={() => Taro.reLaunch({ url: ROUTES.signin })}>{t('auth.signin')}</Button>
          </View>
        </Frame>
      </View>
    )
  }
  return (
    <AuthForm
      title={t('auth.invite.title')}
      text={t('auth.invite.text')}
      submitText={t('auth.invite.submit')}
      withDisplayName
      onSubmit={async (v) => {
        await api.acceptInvitation(token, { username: v.username, password: v.password, displayName: v.displayName })
        // The language chosen on this page becomes the account's language.
        await api.updateMe({ lang: getLang() }).catch(() => undefined)
        await loadStatus(true)
        Taro.reLaunch({ url: ROUTES.timeline })
      }}
    />
  )
}
