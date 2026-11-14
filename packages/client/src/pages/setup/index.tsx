import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { api } from '../../api/client'
import { getLang, useT } from '../../i18n'
import { loadStatus, ROUTES } from '../../state/session'
import { AuthForm } from '../../ui/AuthForm'

export default function SetupPage() {
  const t = useT()
  useEffect(() => {
    loadStatus(true).then((s) => {
      if (s.me) Taro.reLaunch({ url: ROUTES.timeline })
      else if (s.initialized) Taro.reLaunch({ url: ROUTES.signin })
    })
  }, [])
  return (
    <AuthForm
      title={t('auth.setup.title')}
      text={t('auth.setup.text')}
      submitText={t('auth.setup.submit')}
      withDisplayName
      withSetupToken
      onSubmit={async (v) => {
        await api.setup({ username: v.username, password: v.password, displayName: v.displayName, setupToken: v.setupToken || undefined })
        // The language chosen on this page becomes the account's language.
        await api.updateMe({ lang: getLang() }).catch(() => undefined)
        await loadStatus(true)
        Taro.reLaunch({ url: ROUTES.settings })
      }}
    />
  )
}
