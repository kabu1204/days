import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import { deviceInfo, pickImages, readLocalPhoto, type LocalPhoto } from '../../browser/photo'
import { useT } from '../../i18n'
import { Button, Frame, TopBar } from '../../ui'

/** Phase 0, test a: does the browser deliver capture time and coordinates? */
export default function LabExifPage() {
  const t = useT()
  const [rows, setRows] = useState<LocalPhoto[]>([])
  const info = deviceInfo()

  const select = async () => {
    const files = await pickImages(true)
    const read = await Promise.all(files.map((f) => readLocalPhoto(f)))
    setRows((r) => [...r, ...read])
  }
  const withTime = rows.filter((r) => r.takenAt).length
  const withCoords = rows.filter((r) => r.latitude !== null).length

  return (
    <View className="page">
      <TopBar title={t('lab.exif.title')} back />
      <View className="small muted" style={{ marginBottom: '9px' }}>{t('lab.exif.text')}</View>
      <Button kind="primary" onClick={select} testId="lab-select">{t('lab.exif.select')}</Button>

      {rows.length ? (
        <Frame>
          <View data-testid="lab-result">{t('lab.exif.result', { total: rows.length, time: withTime, coords: withCoords })}</View>
          <View className="lab-table" style={{ marginTop: '9px' }}>
            <View className="tr th">
              <Text>File</Text>
              <Text>{t('lab.exif.time')}</Text>
              <Text>{t('lab.exif.coords')}</Text>
              <Text>#</Text>
            </View>
            {rows.map((r) => (
              <View key={r.key} className="tr">
                <Text>{r.file.name} ({r.file.type || '?'}, {Math.round(r.file.size / 1024)} KB)</Text>
                <Text className={r.takenAt ? 'ok' : 'bad'}>{r.takenAt ?? t('lab.exif.absent')}</Text>
                <Text className={r.latitude !== null ? 'ok' : 'bad'}>
                  {r.latitude !== null ? `${r.latitude.toFixed(5)}, ${r.longitude!.toFixed(5)}` : t('lab.exif.absent')}
                </Text>
                <Text>{r.fieldCount}</Text>
              </View>
            ))}
          </View>
        </Frame>
      ) : null}

      <View className="section-title">{t('lab.exif.browser')}</View>
      <View className="small" style={{ wordBreak: 'break-all' }}>{info.userAgent}</View>
    </View>
  )
}
