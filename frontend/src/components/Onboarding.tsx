import { useState } from 'react'
import { Swiper, Button } from 'antd-mobile'
import './Onboarding.css'

const slides = [
  {
    title: '欢迎使用 CloudPilot',
    desc: '手机运维 K8s 集群，随时随地响应告警',
    icon: '☁️'
  },
  {
    title: '实时监控与日志',
    desc: 'CPU/内存/网络图表，日志流实时推送',
    icon: '📊'
  },
  {
    title: '快捷操作',
    desc: '重启、扩容、YAML 编辑，一键搞定',
    icon: '🔧'
  },
  {
    title: '智能告警',
    desc: '震动 + TTS 语音播报，第一时间响应',
    icon: '🔔'
  }
]

export default function Onboarding({ onFinish }: { onFinish: () => void }) {
  const [current, setCurrent] = useState(0)

  return (
    <div className="onboarding">
      <Swiper
        style={{ '--height': '100vh' }}
        onIndexChange={setCurrent}
        indicator={() => null}
      >
        {slides.map((slide, i) => (
          <Swiper.Item key={i}>
            <div className="onboarding-slide">
              <div className="slide-icon">{slide.icon}</div>
              <h2>{slide.title}</h2>
              <p>{slide.desc}</p>
            </div>
          </Swiper.Item>
        ))}
      </Swiper>
      <div className="onboarding-footer">
        <div className="dots">
          {slides.map((_, i) => (
            <span key={i} className={i === current ? 'dot active' : 'dot'} />
          ))}
        </div>
        {current === slides.length - 1 ? (
          <Button block color="primary" size="large" onClick={onFinish}>
            开始使用
          </Button>
        ) : (
          <Button block fill="none" onClick={() => setCurrent(slides.length - 1)}>
            跳过
          </Button>
        )}
      </div>
    </div>
  )
}
