import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { api } from '../../api/client'
import { useT } from '../../i18n'
import { loadStatus, ROUTES } from '../../state/session'
import { AuthForm } from '../../ui/AuthForm'

export default function SignInPage() {
  const t = useT()
  useEffect(() => {
    loadStatus(true).then((s) => {
      if (s.me) Taro.reLaunch({ url: ROUTES.timeline })
      else if (!s.initialized) Taro.reLaunch({ url: ROUTES.setup })
    })
  }, [])
  return (
    <AuthForm
      title={t('auth.signin.title')}
      submitText={t('auth.signin')}
      onSubmit={async (v) => {
        await api.signIn(v.username, v.password)
        await loadStatus(true)
        Taro.reLaunch({ url: ROUTES.timeline })
      }}
    />
  )
}
