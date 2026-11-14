import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import { ApiFailure } from '../api/client'
import { logo } from '../assets/manifest'
import { errorText, getLang, setLang, useT } from '../i18n'
import { Button, Field, Frame, Icon, TextInput } from './index'

export interface AuthValues {
  username: string
  password: string
  displayName: string
  setupToken: string
}

/** Shared form for the setup, sign-in, and invitation pages. */
export function AuthForm(props: {
  title: string
  text?: string
  submitText: string
  withDisplayName?: boolean
  withSetupToken?: boolean
  onSubmit: (values: AuthValues) => Promise<void>
}) {
  const t = useT()
  const [values, setValues] = useState<AuthValues>({ username: '', password: '', displayName: '', setupToken: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof AuthValues) => (v: string) => setValues((s) => ({ ...s, [k]: v }))

  const submit = async () => {
    const username = values.username.trim()
    const displayName = values.displayName.trim()
    const signUp = !!props.withDisplayName
    if (signUp && (!/^[A-Za-z0-9_.-]{3,32}$/.test(username) || values.password.length < 8 || !displayName)) {
      setError(t('error.invalid_input'))
      return
    }
    setBusy(true)
    setError('')
    try {
      await props.onSubmit({ ...values, username, displayName })
    } catch (err) {
      setError(errorText(t, err instanceof ApiFailure ? err.code : undefined))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="page">
      <View className="row between" style={{ marginBottom: '24px' }}>
        <View className="row">
          <Icon src={logo} size={36} />
          <Text className="h1">{t('app.name')}</Text>
        </View>
        <Button small kind="plain" onClick={() => setLang(getLang() === 'en' ? 'zh-CN' : 'en')} testId="lang-toggle">
          {getLang() === 'en' ? '中文' : 'English'}
        </Button>
      </View>
      <Frame>
        <View className="h1">{props.title}</View>
        {props.text ? <View className="muted small" style={{ margin: '6px 0 12px' }}>{props.text}</View> : <View style={{ height: '12px' }} />}
        {props.withDisplayName ? (
          <Field label={t('auth.displayName')}>
            <TextInput name="displayName" value={values.displayName} onChange={set('displayName')} maxLength={24} />
          </Field>
        ) : null}
        <Field label={t('auth.username')} hint={props.withDisplayName ? t('auth.username.hint') : undefined}>
          <TextInput name="username" value={values.username} onChange={set('username')} maxLength={32} />
        </Field>
        <Field label={t('auth.password')} hint={props.withDisplayName ? t('auth.password.hint') : undefined}>
          <TextInput name="password" password value={values.password} onChange={set('password')} maxLength={200} />
        </Field>
        {props.withSetupToken ? (
          <Field label={t('auth.setupToken')}>
            <TextInput name="setupToken" value={values.setupToken} onChange={set('setupToken')} maxLength={200} />
          </Field>
        ) : null}
        {error ? <View className="error-text" data-testid="form-error">{error}</View> : null}
        <Button block kind="primary" disabled={busy} onClick={submit} testId="submit">
          {busy ? t('common.loading') : props.submitText}
        </Button>
      </Frame>
    </View>
  )
}
