/**
 * 舰长事件反应系统
 * - 全局事件总线：任何组件都可 fireCaptainReaction(event)
 * - HolodeckCaptain 订阅，弹出 3s 临时台词气泡，优先级高于常态 mood 台词
 * - 每种事件有多个台词候选，按 silhouette 提供不同性格版本
 */

import { SilhouetteId } from './CaptainSilhouettes'

export type ReactionEvent =
  | { type: 'silence_success'; alertName?: string; severity?: string }
  | { type: 'silence_failed'; alertName?: string }
  | { type: 'scale_success'; delta: number; poolName?: string }
  | { type: 'scale_failed'; poolName?: string }
  | { type: 'badge_unlocked'; badgeName: string }
  | { type: 'cluster_selected'; clusterName?: string }
  | { type: 'greeting' }

export interface Reaction {
  text: string
  ttl?: number  // 显示毫秒，默认 3500
  emphasis?: boolean // 是否加强调（高亮 + 边框脉冲）
}

const EVENT_KEY = '__holodeck_captain_reaction__'

// —— 台词库：per silhouette · per event
type ReactionMap = Partial<Record<SilhouetteId, string[]>>

const LIB: Record<ReactionEvent['type'], ReactionMap & { _default: string[] }> = {
  silence_success: {
    _default: ['星域已清理，指挥官。', '威胁标记已消除。', '目标已进入静默状态。'],
    lyra: ['漂亮的一击，指挥官。', '干净利落。数据流恢复稳定。', '已按您的意愿处理。'],
    mio: ['嘿嘿，搞定了！', '一键 KO！痛快！', '哼哼，这种小场面交给我们就行~'],
    scarlet: ['清除完毕。', '目标沉默。', '下一个。'],
    nova: ['星辰归位，秩序重现。', '波动已被抚平。', '异响已散入虚空。'],
  },
  silence_failed: {
    _default: ['静默指令未能生效，指挥官。', '通讯出现干扰，请再试一次。'],
    lyra: ['信号被拦截了…请稍后再试。', '指令未送达，可能是链路问题。'],
    mio: ['诶？没成功？让我再试一次！', '奇怪，明明按下去了…'],
    scarlet: ['未命中。', '再来。'],
    nova: ['连接被虚空吞没了…请稍待。'],
  },
  scale_success: {
    _default: ['增援已投放到位。', '节点池已重整完毕。'],
    lyra: ['增援已到位。舰队规模已按您的意愿调整。', '轨道运输已完成。'],
    mio: ['空降完成！新伙伴上线啦~', '嘿嘿，节点小队报到！'],
    scarlet: ['部署完成。', '增援已就位。'],
    nova: ['星辰重新排列，能量流已扩展。'],
  },
  scale_failed: {
    _default: ['扩容指令被拒，指挥官。请检查配额。', '节点池调整未能完成。'],
    lyra: ['轨道运输被打断了，请检查配额或预检报告。'],
    mio: ['诶，被打回来了…是不是配额不够？'],
    scarlet: ['部署失败。检查权限。'],
    nova: ['星辰未能对齐，能量流受阻。'],
  },
  badge_unlocked: {
    _default: ['解锁了新徽章：{name}。恭喜您，指挥官。'],
    lyra: ['解锁了「{name}」。这份荣誉您当之无愧。'],
    mio: ['哇！「{name}」到手啦！好厉害好厉害！'],
    scarlet: ['「{name}」·记录在案。'],
    nova: ['星辰赠予了您「{name}」的印记。'],
  },
  cluster_selected: {
    _default: ['正在切入 {name} 星系。'],
    lyra: ['{name} 已被锁定，指挥官。'],
    mio: ['出发！去 {name} 看看~'],
    scarlet: ['{name}·就位。'],
    nova: ['{name} 的星流已向您敞开。'],
  },
  greeting: {
    _default: ['系统在线，随时听候差遣。'],
    lyra: ['一切系统在线，指挥官。请下令。'],
    mio: ['指挥官！我今天也超有干劲的！'],
    scarlet: ['就位。'],
    nova: ['星流已归位，等候您的指引。'],
  },
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function textForEvent(event: ReactionEvent, silhouette?: SilhouetteId): string {
  const entry = LIB[event.type]
  const pool = (silhouette && entry[silhouette]) || entry._default
  let text = pick(pool)

  if (event.type === 'badge_unlocked') {
    text = text.replace('{name}', event.badgeName)
  } else if (event.type === 'cluster_selected') {
    text = text.replace('{name}', event.clusterName || '目标')
  }
  return text
}

/**
 * 触发反应（任意组件调用）
 */
export function fireCaptainReaction(event: ReactionEvent) {
  try {
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: event }))
  } catch {}
}

/**
 * 订阅反应事件（由 HolodeckCaptain 使用）
 */
export function subscribeCaptainReaction(cb: (event: ReactionEvent) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail as ReactionEvent
    if (detail) cb(detail)
  }
  window.addEventListener(EVENT_KEY, handler)
  return () => window.removeEventListener(EVENT_KEY, handler)
}
