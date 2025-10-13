import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera } from '@capacitor/camera'
import { Geolocation } from '@capacitor/geolocation'
import { LocalNotifications } from '@capacitor/local-notifications'

const permissions = [
  { key: 'camera', label: '相机', desc: '用于拍摄或扫描内容' },
  { key: 'microphone', label: '麦克风', desc: '用于录制音频或语音交互' },
  { key: 'photos', label: '照片库', desc: '用于选择或保存图片/视频' },
  { key: 'geolocation', label: '定位', desc: '用于提供基于位置的服务（可选）' },
  { key: 'notifications', label: '本地通知', desc: '用于本地提醒与通知显示（可选）' },
  { key: 'speech', label: '语音识别', desc: '用于将语音转换为文本（设备支持时）' },
] as const

type PermissionKey = typeof permissions[number]['key']

export default function PermissionsPage() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Record<PermissionKey, boolean>>({
    camera: false,
    photos: false,
    geolocation: false,
    notifications: false,
    microphone: false,
    speech: false,
  })
  const [log, setLog] = useState<string[]>([])
  const anySelected = Object.values(selected).some(Boolean)

  const toggle = (k: PermissionKey) =>
    setSelected(s => ({ ...s, [k]: !s[k] }))

  const request = async () => {
    const msgs: string[] = []
    try {
      if (selected.camera && selected.photos) {
        await Camera.requestPermissions({ permissions: ['camera', 'photos'] })
        msgs.push('相机+照片库：已请求')
      } else {
        if (selected.camera) {
          await Camera.requestPermissions({ permissions: ['camera'] })
          msgs.push('相机：已请求')
        }
        if (selected.photos) {
          await Camera.requestPermissions({ permissions: ['photos'] })
          msgs.push('照片库：已请求')
        }
      }
      if (selected.geolocation) {
        await Geolocation.requestPermissions()
        msgs.push('定位：已请求')
      }
      if (selected.notifications) {
        const { display } = await LocalNotifications.requestPermissions()
        msgs.push(`本地通知：${display === 'granted' ? '允许' : '拒绝或未确定'}`)
      }

      if (selected.microphone) {
        try {
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            // 立即停止以避免占用麦克风
            stream.getTracks().forEach(t => t.stop())
            msgs.push('麦克风：已请求')
          } else {
            msgs.push('麦克风：当前环境不支持 getUserMedia')
          }
        } catch (e) {
          msgs.push(`麦克风错误：${String(e)}`)
        }
      }

      if (selected.speech) {
        try {
          const SpeechRecognition: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
          if (SpeechRecognition) {
            const rec = new SpeechRecognition()
            rec.onstart = () => {
              try { rec.stop() } catch {}
            }
            rec.start()
            msgs.push('语音识别：已尝试请求（若不支持请集成原生/插件）')
          } else {
            msgs.push('语音识别：未检测到 Web Speech API，需集成插件或原生模块')
          }
        } catch (e) {
          msgs.push(`语音识别错误：${String(e)}`)
        }
      }
    } catch (e) {
      msgs.push(`错误：${String(e)}`)
    }
    setLog(msgs)
  }

  return (
    <div style={{ padding: 20, maxWidth: 560, margin: '0 auto', color: '#eaeaea' }}>
      <div style={{ textAlign: 'center', marginTop: 32, marginBottom: 24 }}>
        <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>开始使用前，需要以下访问权限：</div>
        <div style={{ opacity: 0.7, fontSize: 14 }}>请勾选你希望授予的权限，可随时在系统设置中变更</div>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {permissions.map(p => (
          <li key={p.key} style={{
            border: '1px solid #2a2a2a',
            borderRadius: 12,
            padding: 12,
            background: '#111'
          }}>
            <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selected[p.key]}
                onChange={() => toggle(p.key)}
                style={{ width: 22, height: 22, marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>{p.label}</div>
                <div style={{ fontSize: 13, opacity: 0.7, marginTop: 4 }}>{p.desc}</div>
              </div>
            </label>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 24 }}>
        <button
          onClick={request}
          disabled={!anySelected}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            border: 'none',
            background: anySelected ? '#0B5FFF' : '#21374d',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: anySelected ? 'pointer' : 'not-allowed'
          }}
        >
          继续
        </button>
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button onClick={() => navigate('/blank')} style={{
            background: 'transparent',
            border: 'none',
            color: '#7aa0ff',
            cursor: 'pointer',
            textDecoration: 'underline'
          }}>进入空白页面</button>
        </div>
      </div>

      {log.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 12, opacity: 0.8 }}>
          {log.map((m, i) => (
            <div key={i}>{m}</div>
          ))}
        </div>
      )}
    </div>
  )
}


