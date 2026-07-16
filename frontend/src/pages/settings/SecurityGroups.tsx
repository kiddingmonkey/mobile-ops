import { useEffect, useState } from 'react'
import { Button, Toast, Dialog, Tag, PullToRefresh, SwipeAction } from 'antd-mobile'
import { AddOutline, LockOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import { api, friendlyApiError } from '@/api/client'
import dayjs from 'dayjs'

export default function SecurityGroupsPage() {
  const nav = useNavigate()
  const [list, setList] = useState<any[]>([])
  const [myIP, setMyIP] = useState<string>('...')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [rows, whoami] = await Promise.all([
        api.listSGWhitelists(),
        api.whoamiIP().catch(() => ({ ip: '未知' }))
      ])
      setList(rows)
      setMyIP(whoami.ip)
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const applyOne = async (row: any) => {
    const ok = await Dialog.confirm({
      title: '确认更新安全组',
      content: (
        <div style={{ fontSize: 13 }}>
          <div>安全组: <b>{row.sg_id}</b></div>
          <div>端口: {row.port} · {row.protocol}</div>
          <div style={{ marginTop: 6, color: 'var(--text-tertiary)', fontSize: 11 }}>
            按备注匹配现有规则: 找到就改 IP, 没找到就新增. 放行当前 IP: <b>{myIP}</b>
          </div>
        </div>
      ),
      confirmText: '一键更新'
    })
    if (!ok) return
    setApplying(row.id)
    Toast.show({ content: '更新中...', icon: 'loading', duration: 0 })
    try {
      const r = await api.applySGWhitelist(row.id)
      Toast.clear()
      const action = r.mode === 'updated' ? '已改写规则为' : '已新增规则放行'
      const extra = r.matched > 1 ? ` (匹配 ${r.matched} 条,只改了第一条)` : ''
      Toast.show({
        content: `${action} ${r.ip}${extra}`,
        icon: 'success',
        duration: 2500
      })
      await load()
    } catch (e: any) {
      Toast.clear()
      showApplyError(e)
    } finally {
      setApplying(null)
    }
  }

  // 用 Dialog 详细展示后端结构化错误,支持复制
  const showApplyError = (e: any) => {
    const body = e?.response?.data || {}
    const status = e?.response?.status
    const hasStructured = body && (body.code || body.hint || body.message)

    if (!hasStructured) {
      Dialog.alert({
        title: '更新失败',
        content: (
          <div style={{ fontSize: 12, wordBreak: 'break-all' }}>
            {friendlyApiError(e)}
          </div>
        )
      })
      return
    }

    const fullText = JSON.stringify(body, null, 2)
    Dialog.alert({
      title: body.error || '更新失败',
      content: (
        <div style={{ fontSize: 12, textAlign: 'left' }}>
          {body.code && (
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--text-tertiary)' }}>错误码: </span>
              <span style={{ color: 'var(--danger)', fontFamily: 'ui-monospace, monospace' }}>{body.code}</span>
              {body.stage && (
                <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                  ({body.stage} 阶段)
                </span>
              )}
            </div>
          )}
          {body.hint && (
            <div style={{
              background: 'rgba(255, 200, 0, 0.1)',
              borderLeft: '3px solid var(--warning)',
              padding: 8, marginBottom: 8,
              fontSize: 12, whiteSpace: 'pre-wrap', lineHeight: 1.5
            }}>
              💡 {body.hint}
            </div>
          )}
          {body.request_id && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, fontFamily: 'ui-monospace, monospace' }}>
              request_id: {body.request_id}
            </div>
          )}
          {body.message && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}>
                原始错误信息
              </summary>
              <pre style={{
                fontSize: 10, marginTop: 6, padding: 8,
                background: 'var(--bg-primary)', borderRadius: 4,
                whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                maxHeight: 160, overflow: 'auto',
                color: 'var(--text-secondary)'
              }}>
                {body.message}
              </pre>
            </details>
          )}
          {status && (
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>
              HTTP {status}
            </div>
          )}
          <Button
            block size="mini" fill="outline" style={{ marginTop: 10 }}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fullText)
                Toast.show({ content: '已复制完整错误', icon: 'success', duration: 1000 })
              } catch {
                Toast.show({ content: '复制失败', icon: 'fail' })
              }
            }}
          >复制完整错误 JSON</Button>
        </div>
      ),
      confirmText: '关闭'
    })
  }

  const del = async (row: any) => {
    const ok = await Dialog.confirm({ content: `删除白名单 "${row.name}"？` })
    if (!ok) return
    try {
      await api.deleteSGWhitelist(row.id)
      Toast.show({ content: '已删除', icon: 'success' })
      await load()
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail' })
    }
  }

  return (
    <PageShell title="安全组白名单" onBack={() => nav(-1)}>
      <PullToRefresh onRefresh={load}>
        <div style={{ padding: '0 12px 60px' }}>
          {/* 当前 IP 卡片 */}
          <div style={{
            background: 'linear-gradient(135deg, var(--accent-blue) 0%, #6E9BFF 100%)',
            color: 'white',
            borderRadius: 10,
            padding: 14,
            marginBottom: 12,
            marginTop: 8
          }}>
            <div style={{ fontSize: 11, opacity: 0.9 }}>当前公网 IP</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, fontFamily: 'ui-monospace, monospace' }}>
              {myIP}
            </div>
            <div style={{ fontSize: 11, marginTop: 4, opacity: 0.85 }}>
              点击任意白名单的"一键更新"按钮,将此 IP 加入对应安全组
            </div>
          </div>

          {/* 新建按钮 */}
          <Button
            block
            color="primary"
            fill="outline"
            size="small"
            onClick={() => nav('/settings/security-groups/new')}
            style={{ marginBottom: 12 }}
          >
            <AddOutline /> 新建白名单模板
          </Button>

          {/* 列表 */}
          {list.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 32,
              color: 'var(--text-tertiary)', fontSize: 13
            }}>
              <LockOutline fontSize={40} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>还没有白名单模板</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>
                配置一次,以后一键就能把当前 IP 加入安全组
              </div>
            </div>
          ) : list.map((row: any) => (
            <SwipeAction
              key={row.id}
              rightActions={[
                {
                  key: 'delete',
                  text: '删除',
                  color: 'danger',
                  onClick: () => del(row)
                }
              ]}
            >
              <div style={{
                background: 'var(--bg-elevated)',
                borderRadius: 8,
                padding: 12,
                marginBottom: 8
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                      {row.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, monospace' }}>
                      {row.sg_id} · {row.region}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <Tag color="primary" style={{ fontSize: 10 }}>{row.port}</Tag>
                    <Tag color="default" style={{ fontSize: 10 }}>{row.protocol}</Tag>
                  </div>
                </div>

                {/* 上次更新 IP */}
                <div style={{
                  background: 'var(--bg-primary)',
                  borderRadius: 6,
                  padding: '6px 8px',
                  marginBottom: 8,
                  fontSize: 11
                }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>上次 IP: </span>
                  <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text-primary)' }}>
                    {row.last_ip || '(未同步)'}
                  </span>
                  {row.last_updated_at && (
                    <span style={{ color: 'var(--text-tertiary)', marginLeft: 8 }}>
                      · {dayjs(row.last_updated_at).format('MM-DD HH:mm')}
                    </span>
                  )}
                </div>

                {/* 一键更新按钮 */}
                <Button
                  block
                  color={row.last_ip === myIP ? 'default' : 'primary'}
                  size="small"
                  loading={applying === row.id}
                  onClick={() => applyOne(row)}
                >
                  {row.last_ip === myIP ? '✓ 已是当前 IP' : `一键更新为 ${myIP}`}
                </Button>
              </div>
            </SwipeAction>
          ))}
        </div>
      </PullToRefresh>
    </PageShell>
  )
}
