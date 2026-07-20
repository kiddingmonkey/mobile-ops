import { useEffect, useState } from 'react'
import { Button, Tag, Toast, Skeleton, NavBar, Dialog } from 'antd-mobile'
import { useNavigate, useParams } from 'react-router-dom'
import { api, friendlyApiError } from '@/api/client'
import { Capacitor } from '@capacitor/core'

type MonitorConfig = {
  monitorConfigId: string
  monitorConfigName?: string
  pluginName?: string
  requestUrl?: string
  extendParams?: string
  resultKeyword?: string
}

async function copyText(text: string) {
  try {
    // 优先用 navigator.clipboard；Capacitor 环境下 WebView 也支持
    if (navigator.clipboard && (window.isSecureContext || Capacitor.isNativePlatform())) {
      await navigator.clipboard.writeText(text)
    } else {
      // fallback
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    Toast.show({ icon: 'success', content: '已复制' })
  } catch (e) {
    Toast.show({ icon: 'fail', content: '复制失败' })
  }
}

export default function DialingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const nav = useNavigate()
  const [loading, setLoading] = useState(true)
  const [task, setTask] = useState<any>(null)
  const [configs, setConfigs] = useState<MonitorConfig[]>([])
  const [source, setSource] = useState<'live' | 'cache'>('cache')
  const [rerun, setRerun] = useState<any>(null)
  const [rerunning, setRerunning] = useState(false)
  const [rerunResult, setRerunResult] = useState<{
    success: boolean
    message: string
    perPoint: Record<string, string>
    elapsedMs: number
  } | null>(null)

  const onRerun = async () => {
    if (!id) return
    setRerunning(true)
    setRerunResult(null)
    Toast.show({ icon: 'loading', content: '拨测平台执行中', duration: 0 })
    try {
      const r = await api.triggerDialingRerun(id)
      Toast.clear()
      setRerunResult(r)
      Toast.show({ icon: r.success ? 'success' : 'fail', content: r.success ? '复测完成' : '复测失败' })
    } catch (e) {
      Toast.clear()
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
    } finally {
      setRerunning(false)
    }
  }

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [detail, cmds] = await Promise.all([
        api.getDialingTaskDetail(id),
        api.getDialingRerunCommand(id).catch(() => null),
      ])
      setSource(detail.source)
      // live 返回 data 是原始对象; cache 返回 { task, monitorConfigList }
      if (detail.source === 'live') {
        setTask(detail.data)
        const cfgs = Array.isArray(detail.data.monitorConfigList) ? detail.data.monitorConfigList : []
        setConfigs(cfgs)
      } else {
        setTask(detail.data.task)
        setConfigs(detail.data.monitorConfigList || [])
      }
      setRerun(cmds)
    } catch (e) {
      Toast.show({ icon: 'fail', content: friendlyApiError(e) })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const openBastion = () => {
    const url = rerun?.bastionUrl || 'https://ebgoas.iflysec.com/#/login'
    window.open(url, '_blank')
  }

  const showFullGuide = () => {
    if (!rerun) return
    const ip = rerun.targetIp || '(未知)'
    const items = rerun.commands || []
    const body = items.map((c: any, i: number) =>
      `${i + 1}. cd ${rerun.scriptDir}\n   ./${c.plugin} ${c.url} ${c.params}`
    ).join('\n\n')
    Dialog.alert({
      title: `复测指引 (${ip})`,
      content: body || '暂无脚本配置',
      confirmText: '复制全部',
      onConfirm: () => {
        const full = items.map((c: any) => `# ${c.plugin}\ncd ${rerun.scriptDir} && ./${c.plugin} ${c.url} ${c.params}`).join('\n\n')
        copyText(full)
      },
    })
  }

  if (loading) {
    return (
      <div className="page" style={{ padding: 16 }}>
        <NavBar onBack={() => nav(-1)}>拨测详情</NavBar>
        <Skeleton animated style={{ '--height': '120px', marginTop: 16 } as any} />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="page" style={{ padding: 16 }}>
        <NavBar onBack={() => nav(-1)}>拨测详情</NavBar>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)' }}>未找到该拨测任务</div>
      </div>
    )
  }

  const name = task.dialingTaskName || task.dialing_task_name || ''
  const monitorPointName = task.monitorPointName || task.monitor_point_name || ''
  const isactive = task.isactive
  const notif = task.notificationEnable ?? task.notification_enable
  const owner = task.ownerName || task.owner_name || ''
  const desc = task.description || ''
  const offReason = task.offReason || task.off_reason || ''
  const interval = task.executionInterval ?? task.execution_interval

  return (
    <div className="page">
      <NavBar onBack={() => nav(-1)} back="返回">拨测详情</NavBar>
      <div style={{ padding: 12, overflowY: 'auto', flex: 1 }}>
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{name}</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
            {isactive === '1' ? <Tag color="success">启用</Tag> : <Tag color="danger">停用</Tag>}
            {notif === '0' ? <Tag color="default">通知关</Tag> : <Tag color="primary">通知开</Tag>}
            {interval ? <Tag color="default">{interval}s</Tag> : null}
            {source === 'live' ? <Tag color="success" fill="outline">实时</Tag> : <Tag color="default" fill="outline">缓存</Tag>}
          </div>
          {desc && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>{desc}</div>}
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.8 }}>
            {monitorPointName && <div>📍 拨测点：{monitorPointName}</div>}
            {owner && <div>👤 负责人：{owner}</div>}
            {offReason && <div style={{ color: 'var(--warning)' }}>⚠️ {offReason}</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Button size="middle" color="primary" onClick={onRerun} loading={rerunning} block>
            {rerunning ? '复测中…' : '一键复测'}
          </Button>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button size="small" fill="outline" onClick={openBastion} block>登录堡垒机</Button>
          <Button size="small" fill="outline" onClick={showFullGuide} block>手动脚本</Button>
        </div>

        {rerunResult && (
          <div style={{
            background: rerunResult.success ? 'rgba(0, 200, 100, 0.08)' : 'rgba(255, 80, 80, 0.08)',
            border: `1px solid ${rerunResult.success ? 'var(--success)' : 'var(--danger)'}`,
            borderRadius: 10, padding: 12, marginBottom: 12
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              {rerunResult.success ? '✅ 复测完成' : '❌ 复测失败'}
              <span style={{ float: 'right', fontSize: 11, color: 'var(--text-tertiary)' }}>
                {(rerunResult.elapsedMs / 1000).toFixed(1)}s
              </span>
            </div>
            {Object.entries(rerunResult.perPoint || {}).map(([k, v]) => (
              <div key={k} style={{ fontSize: 12, marginBottom: 4, wordBreak: 'break-all' }}>
                <span style={{ color: 'var(--text-tertiary)' }}>{k}: </span>
                <span style={{ color: /成功|SUCCESS|OK/i.test(v) ? 'var(--success)' : 'var(--danger)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>
          复测配置 ({configs.length})
        </div>

        {configs.map((c, i) => {
          const cmd = `cd ${rerun?.scriptDir || '/data/server/desp-proxy/cmd'} && ./${c.pluginName || ''} ${c.requestUrl || ''} ${c.extendParams || ''}`
          const ip = rerun?.targetIp || ''
          return (
            <div key={c.monitorConfigId || i} style={{
              background: 'var(--bg-elevated)', borderRadius: 10, padding: 12, marginBottom: 8
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                {c.monitorConfigName || `配置 ${i + 1}`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.7, marginBottom: 8 }}>
                <div>脚本: {c.pluginName}</div>
                <div style={{ wordBreak: 'break-all' }}>URL: {c.requestUrl}</div>
                <div style={{ wordBreak: 'break-all' }}>参数: {c.extendParams}</div>
                {c.resultKeyword && <div>期望关键字: {c.resultKeyword}</div>}
              </div>
              <div style={{
                background: 'var(--bg-primary)', borderRadius: 6, padding: 8,
                fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all',
                border: '1px solid var(--border-primary)', marginBottom: 8
              }}>
                {cmd}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {ip && (
                  <Button size="mini" fill="outline" onClick={() => copyText(ip)}>复制 IP</Button>
                )}
                <Button size="mini" fill="outline" onClick={() => copyText(cmd)}>复制命令</Button>
                <Button
                  size="mini"
                  color="primary"
                  onClick={() => {
                    const full = `ssh root@${ip}\n${cmd}`
                    copyText(full)
                  }}
                >
                  复制 SSH 全套
                </Button>
              </div>
            </div>
          )
        })}

        {configs.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            该拨测暂无复测脚本配置
          </div>
        )}
      </div>
    </div>
  )
}
