import { useEffect, useState } from 'react'
import { Text, View } from '@tarojs/components'
import { BODY_KEYS, CATEGORY_KEYS, HEADPIECE_KEYS } from '@days/shared'
import { petSheet, stickerIcons } from '../../assets/manifest'
import { frameStyle } from '../../browser/sprites'
import { partnerLook } from '../../ui/Characters'
import { deviceInfo } from '../../browser/photo'
import { useT } from '../../i18n'
import { Button, CategoryIcon, Frame, TopBar } from '../../ui'

/** Phase 0, test c: is pixel art sharp at all screen sizes? */
export default function LabPixelPage() {
  const t = useT()
  const [frame, setFrame] = useState(0)
  const info = deviceInfo()
  useEffect(() => {
    const timer = setInterval(() => setFrame((f) => (f + 1) % 4), 125)
    return () => clearInterval(timer)
  }, [])

  return (
    <View className="page">
      <TopBar title={t('lab.pixel.title')} back />
      <View className="small muted">{t('lab.pixel.text')}</View>
      <View className="small" style={{ margin: '6px 0 12px' }} data-testid="lab-dpr">
        {t('lab.pixel.dpr', { dpr: info.dpr, w: info.width, h: info.height })}
      </View>

      {[12, 16, 18, 24, 36].map((size) => (
        <View key={size} style={{ fontSize: `${size}px`, lineHeight: 1.4, marginBottom: '6px' }}>
          <Text className="muted" style={{ fontSize: '12px' }}>{size}px </Text>
          {t('lab.pixel.sample')}
        </View>
      ))}

      <Frame>
        <View>{t('lab.pixel.dialog')}</View>
        <View className="row" style={{ marginTop: '9px' }}>
          <Button kind="primary">{t('common.confirm')}</Button>
          <Button>{t('common.cancel')}</Button>
        </View>
      </Frame>

      <View style={{ margin: '18px 0' }}>
        {[1, 2, 3, 4, 6].map((scale) => (
          <View key={scale} className="row" style={{ marginBottom: '6px', alignItems: 'flex-end' }}>
            <View className="sprite" data-testid={`sprite-${scale}`} style={frameStyle(partnerLook('cream', 'rosette'), scale, 4, frame)} />
            <View className="sprite" style={frameStyle(partnerLook('peach', 'top-hat'), scale, 6, frame)} />
            <View className="sprite" style={frameStyle(petSheet, scale, 5, frame)} />
          </View>
        ))}
      </View>

      <View className="row wrap" style={{ marginBottom: '18px' }} data-testid="lab-looks">
        {BODY_KEYS.map((b, i) => (
          <View key={b} className="sprite" style={frameStyle(partnerLook(b, HEADPIECE_KEYS[i % HEADPIECE_KEYS.length]), 2, 0, frame % 2)} />
        ))}
      </View>

      <View className="row wrap" style={{ marginBottom: '18px' }}>
        {Object.entries(stickerIcons).map(([k, src]) => (
          <View key={k} className="sprite" style={{ width: '48px', height: '48px', backgroundImage: `url("${src}")`, backgroundSize: '100% 100%' }} />
        ))}
      </View>

      <View className="row wrap" style={{ marginBottom: '18px' }}>
        {CATEGORY_KEYS.map((c) => <CategoryIcon key={c} category={c} size={36} />)}
      </View>

      <View className="row">
        <View className="checker" />
        <View className="checker fine" />
      </View>
    </View>
  )
}
