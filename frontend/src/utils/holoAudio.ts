/**
 * 3D 舰桥音效系统
 *
 * 预设音效：
 * - console-hover: 控制台悬停
 * - console-click: 控制台点击
 * - panel-open: 面板打开
 * - panel-close: 面板关闭
 * - alert-critical: 紧急告警出现
 * - alert-warning: 警告告警
 * - ambient-bridge: 舰桥环境音（循环）
 *
 * 所有音效用 Web Audio API 合成，不需要外部文件
 */

class HolodeckAudioEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private enabled = true
  private ambientSource: AudioBufferSourceNode | null = null

  constructor() {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('holodeck_audio_enabled')
      this.enabled = stored !== '0'
    }
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.3
      this.masterGain.connect(this.ctx.destination)
    }
    return this.ctx
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('holodeck_audio_enabled', enabled ? '1' : '0')
    }
    if (!enabled) this.stopAmbient()
  }

  isEnabled() {
    return this.enabled
  }

  /**
   * 控制台悬停音效：短促高频 beep
   */
  consoleHover() {
    if (!this.enabled) return
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08)
    osc.connect(gain)
    gain.connect(this.masterGain!)
    osc.start()
    osc.stop(ctx.currentTime + 0.08)
  }

  /**
   * 控制台点击音效：低频 + 高频叠加，模拟全息触控
   */
  consoleClick() {
    if (!this.enabled) return
    const ctx = this.getContext()
    // 低频 thump
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(150, ctx.currentTime)
    osc1.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15)
    gain1.gain.setValueAtTime(0.25, ctx.currentTime)
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
    osc1.connect(gain1)
    gain1.connect(this.masterGain!)
    osc1.start()
    osc1.stop(ctx.currentTime + 0.15)

    // 高频 click
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.type = 'square'
    osc2.frequency.setValueAtTime(2400, ctx.currentTime)
    gain2.gain.setValueAtTime(0.1, ctx.currentTime)
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
    osc2.connect(gain2)
    gain2.connect(this.masterGain!)
    osc2.start()
    osc2.stop(ctx.currentTime + 0.05)
  }

  /**
   * 面板打开音效：上升音阶
   */
  panelOpen() {
    if (!this.enabled) return
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(600, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12)
    osc.connect(gain)
    gain.connect(this.masterGain!)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
  }

  /**
   * 面板关闭音效：下降音阶
   */
  panelClose() {
    if (!this.enabled) return
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
    osc.connect(gain)
    gain.connect(this.masterGain!)
    osc.start()
    osc.stop(ctx.currentTime + 0.1)
  }

  /**
   * 紧急告警音效：刺耳的双音调警报
   */
  alertCritical() {
    if (!this.enabled) return
    const ctx = this.getContext()
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'square'
      const startTime = ctx.currentTime + i * 0.3
      osc.frequency.setValueAtTime(800, startTime)
      osc.frequency.setValueAtTime(1200, startTime + 0.08)
      osc.frequency.setValueAtTime(800, startTime + 0.16)
      gain.gain.setValueAtTime(0, startTime)
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02)
      gain.gain.setValueAtTime(0.2, startTime + 0.14)
      gain.gain.linearRampToValueAtTime(0, startTime + 0.16)
      osc.connect(gain)
      gain.connect(this.masterGain!)
      osc.start(startTime)
      osc.stop(startTime + 0.16)
    }
  }

  /**
   * 警告告警音效：柔和的双音提示
   */
  alertWarning() {
    if (!this.enabled) return
    const ctx = this.getContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(500, ctx.currentTime)
    osc.frequency.setValueAtTime(700, ctx.currentTime + 0.1)
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)
    osc.connect(gain)
    gain.connect(this.masterGain!)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  }

  /**
   * 舰桥环境音：低频嗡鸣 + 偶尔的 beep（循环播放）
   */
  startAmbient() {
    if (!this.enabled || this.ambientSource) return
    const ctx = this.getContext()

    // 创建环境音 buffer（2 秒循环）
    const duration = 2
    const sampleRate = ctx.sampleRate
    const buffer = ctx.createBuffer(1, duration * sampleRate, sampleRate)
    const data = buffer.getChannelData(0)

    // 低频嗡鸣 + 随机 beep
    for (let i = 0; i < data.length; i++) {
      const t = i / sampleRate
      // 60Hz 嗡鸣
      data[i] = Math.sin(2 * Math.PI * 60 * t) * 0.02
      // 随机 beep
      if (Math.random() < 0.0001) {
        data[i] += Math.sin(2 * Math.PI * 1800 * t) * 0.05
      }
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0.08
    source.connect(gain)
    gain.connect(this.masterGain!)
    source.start()
    this.ambientSource = source
  }

  stopAmbient() {
    if (this.ambientSource) {
      this.ambientSource.stop()
      this.ambientSource = null
    }
  }
}

export const holoAudio = new HolodeckAudioEngine()
