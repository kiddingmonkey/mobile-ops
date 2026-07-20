import { useEffect, useMemo, useState } from 'react'
import { SearchBar, PullToRefresh, Selector, Tag, Button, Toast, InfiniteScroll } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'
import { api, friendlyApiError } from '@/api/client'
import { hapticLight } from '@/utils/haptics'

type DialingTask = {
  dialingTaskId: string
  dialingTaskName: string
  applicationName?: string
  description?: string
  monitorPointName?: string
  monitorPointIp?: string
  executionInterval?: number
  isactive?: string
  notificationEnable?: string
  offReason?: string
  ownerName?: string
  formalTypeDesc?: string
  syncedAt: string
}

const activeOptions = [
  { label: '全部', value: 'all' },
  { label: '启用', value: '1' },
  { label: '停用', value: '0' },
]
const notifOptions = [
  { label: '全部', value: 'all' },
  { label: '通知开', value: '1' },
  { label: '通知关', value: '0' },
]

export default function DialingPage() {
  const nav = useNavigate()
  const [keyword, setKeyword] = useState('')
  const [isactive, setIsactive] = useState<string>('all')
  const [notif, setNotif] = useState<string>('all')
  const [items, setItems] = useState<DialingTask[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<{
    startedAt: string
    finishedAt?: string
    success: boolean
    errorMessage?: string
  } | null>(null)

  const load = async (reset: boolean, overrides?: { keyword?: string; isactive?: string; notif?: string }) => {
    if (loading) return
    setLoading(true)
    setErr(null)
    const kw = overrides?.keyword !== undefined ? overrides.keyword : keyword
    const ia = overrides?.isactive !== undefined ? overrides.isactive : isactive
    const nt = overrides?.notif !== undefined ? overrides.notif : notif
    try {
      const nextPage = reset ? 1 : page
      const params: any = { page: nextPage, page_size: 30 }
      if (kw) params.keyword = kw
      if (ia && ia !== 'all') params.isactive = ia
      if (nt && nt !== 'all') params.notification_enable = nt
      const r = await api.listDialingTasks(params)
      const merged = reset ? r.items : [...items, ...r.items]
      setItems(merged)
      setTotal(r.total)
      setPage(nextPage + 1)
      setHasMore(merged.length < r.total)
    } catch (e) {
      setErr(friendlyApiError(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
    loadSyncStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSyncStatus = async () => {
    try {
      const r = await api.getDialingSyncStatus()
      setSyncStatus(r.lastSync)
    } catch (e) {
      // 静默失败不影响主功能
    }
  }

  const onFilter = (nextIsactive: string, nextNotif: string) => {
    setIsactive(nextIsactive)
    setNotif(nextNotif)
    load(true, { isactive: nextIsactive, notif: nextNotif })
  }

  const onSync = async () => {
    Toast.show({ icon: 'loading', content: '同步中', duration: 0 })
    try {
      await api.syncDialingTasks()
      Toast.clear()
      Toast.show({ icon: 'success', content: '已刷新' })
      load(true)
      loadSyncStatus()
    } catch (e) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
    }
  }

  const activeCount = useMemo(() => items.filter(t => t.isactive === '1').length, [items])
  const notifOffCount = useMemo(() => items.filter(t => t.notificationEnable === '0').length, [items])

  return (
    <div className="page">
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 10px) 12px 8px', background: 'var(--bg-primary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>拨测任务</div>
          <Button size="mini" onClick={onSync}>同步</Button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
          共 {total} 项 · 启用 {activeCount} · 通知关 {notifOffCount}
        </div>
        {syncStatus && (
          <div style={{
            fontSize: 10, marginBottom: 8, padding: '4px 8px', borderRadius: 6,
            background: syncStatus.success ? 'rgba(0, 200, 100, 0.05)' : 'rgba(255, 80, 80, 0.08)',
            border: `1px solid ${syncStatus.success ? 'var(--success)' : 'var(--danger)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ color: syncStatus.success ? 'var(--success)' : 'var(--danger)' }}>
              {syncStatus.success ? '✓' : '✗'} 最后同步: {new Date(syncStatus.startedAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            {syncStatus.errorMessage && (
              <span style={{ fontSize: 9, color: 'var(--text-tertiary)', maxWidth: '60%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {syncStatus.errorMessage}
              </span>
            )}
          </div>
        )}
        <SearchBar
          placeholder="搜索拨测名 / 描述"
          value={keyword}
          onChange={setKeyword}
          onSearch={() => load(true)}
        />
        <div style={{ display: 'flex', gap: 6, marginTop: 6, overflowX: 'auto', paddingBottom: 4 }}>
          <Selector
            columns={3}
            options={activeOptions}
            value={[isactive]}
            onChange={arr => onFilter(arr[0] || 'all', notif)}
            style={{ '--padding': '4px 8px', flexShrink: 0 } as any}
          />
          <Selector
            columns={3}
            options={notifOptions}
            value={[notif]}
            onChange={arr => onFilter(isactive, arr[0] || 'all')}
            style={{ '--padding': '4px 8px', flexShrink: 0 } as any}
          />
        </div>
      </div>

      {err && (
        <div style={{ padding: '8px 12px', color: 'var(--danger)', fontSize: 12 }}>
          {err}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px 80px' }}>
        <PullToRefresh onRefresh={() => load(true)}>
          {items.map(t => (
            <div
              key={t.dialingTaskId}
              onClick={() => { hapticLight(); nav(`/dialing/${t.dialingTaskId}`) }}
              style={{
                background: 'var(--bg-elevated)', borderRadius: 10, padding: 12,
                marginBottom: 8, cursor: 'pointer',
                borderLeft: `3px solid ${t.notificationEnable === '0' ? 'var(--text-tertiary)' : t.isactive === '1' ? 'var(--success)' : 'var(--danger)'}`
              }}
            >
              <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                {t.formalTypeDesc && <Tag color="primary" fill="outline">{t.formalTypeDesc}</Tag>}
                {t.isactive === '1' ? <Tag color="success">启用</Tag> : <Tag color="danger">停用</Tag>}
                {t.notificationEnable === '0' && <Tag color="default">通知关</Tag>}
                {t.executionInterval && <Tag color="default">{t.executionInterval}s</Tag>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>{t.dialingTaskName}</div>
              {t.description && t.description !== t.dialingTaskName && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t.description}</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {t.monitorPointName && <span>📍 {t.monitorPointName}</span>}
                {t.ownerName && <span>👤 {t.ownerName}</span>}
              </div>
              {t.offReason && (
                <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>⚠️ {t.offReason}</div>
              )}
            </div>
          ))}
          <InfiniteScroll loadMore={() => load(false)} hasMore={hasMore} />
        </PullToRefresh>
      </div>
    </div>
  )
}
