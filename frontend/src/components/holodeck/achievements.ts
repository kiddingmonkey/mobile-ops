/**
 * 徽章数据模型 + 触发逻辑
 * 纯本地存储，无排行榜、无 PvP、无社交比较
 * 仅在完成工作后被动解锁，不能通过点击刷新获取
 */

export interface Badge {
  id: string
  name: string
  desc: string
  icon: 'shield' | 'moon' | 'flame' | 'compass' | 'anchor' | 'nebula' | 'crown'
  tier: 'bronze' | 'silver' | 'gold' | 'mythic'
  unlockedAt?: number
}

export interface BadgeProgress {
  totalAlertsResolved: number
  totalOpsExecuted: number
  nightOpsCount: number  // 22:00 - 06:00 之间的操作
  criticalHandled: number
  distinctClustersManaged: number
  daysActive: number  // 累计活跃天数
  lastActiveDay?: string  // YYYY-MM-DD
}

const BADGE_STORAGE = 'holodeck_badges_v1'
const PROGRESS_STORAGE = 'holodeck_badge_progress_v1'

export const BADGE_CATALOG: Omit<Badge, 'unlockedAt'>[] = [
  {
    id: 'firewatch_10',
    name: '守夜人',
    desc: '成功处理 10 次告警',
    icon: 'shield',
    tier: 'bronze',
  },
  {
    id: 'firewatch_100',
    name: '防火墙大师',
    desc: '成功处理 100 次告警',
    icon: 'shield',
    tier: 'gold',
  },
  {
    id: 'moon_commander',
    name: '月下指挥官',
    desc: '在深夜（22:00 - 06:00）执行首次操作',
    icon: 'moon',
    tier: 'silver',
  },
  {
    id: 'red_alert_survivor',
    name: '红色风暴',
    desc: '首次处理 P0 级严重告警',
    icon: 'flame',
    tier: 'gold',
  },
  {
    id: 'red_alert_veteran',
    name: '烈焰老兵',
    desc: '累计处理 10 次 P0 级告警',
    icon: 'flame',
    tier: 'mythic',
  },
  {
    id: 'star_navigator',
    name: '星域领航',
    desc: '首次点击星图选择集群',
    icon: 'compass',
    tier: 'bronze',
  },
  {
    id: 'multi_cluster',
    name: '磐石',
    desc: '管理超过 3 个集群',
    icon: 'anchor',
    tier: 'silver',
  },
  {
    id: 'week_streak',
    name: '恒星轨道',
    desc: '连续活跃 7 天',
    icon: 'nebula',
    tier: 'gold',
  },
  {
    id: 'holodeck_pioneer',
    name: '全息先驱',
    desc: '首次进入全息舰桥模式',
    icon: 'crown',
    tier: 'bronze',
  },
]

export function loadProgress(): BadgeProgress {
  try {
    const s = localStorage.getItem(PROGRESS_STORAGE)
    if (s) return JSON.parse(s)
  } catch {}
  return {
    totalAlertsResolved: 0,
    totalOpsExecuted: 0,
    nightOpsCount: 0,
    criticalHandled: 0,
    distinctClustersManaged: 0,
    daysActive: 0,
  }
}

export function saveProgress(p: BadgeProgress) {
  localStorage.setItem(PROGRESS_STORAGE, JSON.stringify(p))
}

export function loadBadges(): Record<string, Badge> {
  try {
    const s = localStorage.getItem(BADGE_STORAGE)
    if (s) return JSON.parse(s)
  } catch {}
  return {}
}

export function saveBadges(badges: Record<string, Badge>) {
  localStorage.setItem(BADGE_STORAGE, JSON.stringify(badges))
}

/**
 * 记录一次工作事件，可能触发新徽章解锁
 * 返回新解锁的徽章列表（用于弹窗通知）
 */
export function recordEvent(
  event:
    | { type: 'alert_resolved'; severity?: string }
    | { type: 'op_executed' }
    | { type: 'cluster_selected'; clusterId: number }
    | { type: 'holodeck_entered' }
    | { type: 'cluster_count_seen'; count: number }
): Badge[] {
  const progress = loadProgress()
  const badges = loadBadges()
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  const hour = new Date().getHours()

  // 更新每日活跃
  if (progress.lastActiveDay !== today) {
    progress.daysActive += 1
    progress.lastActiveDay = today
  }

  switch (event.type) {
    case 'alert_resolved':
      progress.totalAlertsResolved += 1
      if (event.severity === 'critical') progress.criticalHandled += 1
      break
    case 'op_executed':
      progress.totalOpsExecuted += 1
      if (hour >= 22 || hour < 6) progress.nightOpsCount += 1
      break
    case 'cluster_selected':
      // 追踪不同集群
      try {
        const seenKey = 'holodeck_seen_clusters'
        const seen = new Set<number>(JSON.parse(localStorage.getItem(seenKey) || '[]'))
        seen.add(event.clusterId)
        localStorage.setItem(seenKey, JSON.stringify([...seen]))
        progress.distinctClustersManaged = seen.size
      } catch {}
      break
    case 'cluster_count_seen':
      progress.distinctClustersManaged = Math.max(
        progress.distinctClustersManaged,
        event.count
      )
      break
  }

  saveProgress(progress)

  // 检查每个徽章的解锁条件
  const newlyUnlocked: Badge[] = []
  const unlock = (id: string) => {
    if (badges[id]) return
    const spec = BADGE_CATALOG.find(b => b.id === id)
    if (!spec) return
    const b: Badge = { ...spec, unlockedAt: now }
    badges[id] = b
    newlyUnlocked.push(b)
  }

  if (event.type === 'holodeck_entered') unlock('holodeck_pioneer')
  if (event.type === 'cluster_selected') unlock('star_navigator')

  if (progress.totalAlertsResolved >= 10) unlock('firewatch_10')
  if (progress.totalAlertsResolved >= 100) unlock('firewatch_100')

  if (progress.nightOpsCount >= 1) unlock('moon_commander')

  if (progress.criticalHandled >= 1) unlock('red_alert_survivor')
  if (progress.criticalHandled >= 10) unlock('red_alert_veteran')

  if (progress.distinctClustersManaged >= 3) unlock('multi_cluster')

  if (progress.daysActive >= 7) unlock('week_streak')

  if (newlyUnlocked.length) saveBadges(badges)
  return newlyUnlocked
}

export const TIER_COLOR: Record<Badge['tier'], string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  mythic: '#E879F9',
}
