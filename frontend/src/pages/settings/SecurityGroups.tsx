import { useEffect, useState } from 'react'
import { Button, Toast, Dialog, Tag, PullToRefresh, SwipeAction } from 'antd-mobile'
import { AddOutline, LockOutline, DownCircleOutline, UpCircleOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import PageShell from '@/components/PageShell'
import { api, friendlyApiError } from '@/api/client'
import { loadTemplates, deleteTemplate, exportTemplates, importTemplates, migrateFromServer, updateTemplate } from '@/utils/sgStorage'
import type { SGTemplate } from '@/utils/sgStorage'
import { fetchPublicIP } from '@/utils/publicIP'
import dayjs from 'dayjs'

export default function SecurityGroupsPage() {
  const nav = useNavigate()
  const [list, setList] = useState<SGTemplate[]>([])
  const [myIP, setMyIP] = useState<string>('准备中...')
  const [ipStatus, setIpStatus] = useState<string>('')
  const [failedDetails, setFailedDetails] = useState<Array<{ service: string; reason: string }>>([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      // 获取公网IP（使用国内可访问的服务，显示进度）
      const ipResult = await fetchPublicIP((progress) => {
        if (progress.status === 'trying') {
          setMyIP('获取中...')
          setIpStatus(`正在通过 ${progress.service} 获取 (${progress.index}/${progress.total})`)
        } else if (progress.status === 'success') {
          setIpStatus(`来自 ${progress.service}`)
        } else {
          setIpStatus('所有服务都失败了')
          setFailedDetails(progress.failedServices || [])
        }
      })

      // 从客户端加载白名单模板（不依赖服务器）
      const templates = loadTemplates()

      // 首次使用时，尝试从服务器迁移数据（可选）
      if (templates.length === 0) {
        try {
          const serverTemplates = await api.listSGWhitelists()
          if (serverTemplates && serverTemplates.length > 0) {
            const migrated = await migrateFromServer(serverTemplates)
            if (migrated > 0) {
              Toast.show({ content: `已迁移${migrated}个白名单模板到本地`, icon: 'success' })
              setList(loadTemplates())
            }
          }
        } catch (e) {
          // 迁移失败不影响使用
          console.log('[SecurityGroups] Server migration skipped:', e)
        }
      }

      setList(templates)
      setMyIP(ipResult)
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const applyOne = async (row: SGTemplate) => {
    const ok = await Dialog.confirm({
      title: '确认更新安全组',
      content: (
        <div style={{ fontSize: 13 }}>
          <div>安全组: <b>{row.sg_id}</b></div>
          <div>地域: {row.region}</div>
          <div style={{ marginTop: 6, color: 'var(--text-tertiary)', fontSize: 11 }}>
            将当前 IP <b>{myIP}</b> 加入安全组白名单
          </div>
        </div>
      ),
      confirmText: '一键更新'
    })
    if (!ok) return
    setApplying(row.id)
    Toast.show({ content: '更新中...', icon: 'loading', duration: 0 })
    try {
      // 临时方案：使用时间戳作为ID调用后端
      // TODO: 后续改为直接调用腾讯云API
      const numericId = parseInt(row.id) || Date.now()
      const r = await api.applySGWhitelist(numericId, myIP)
      Toast.clear()
      const action = r.mode === 'updated' ? '已改写规则为' : '已新增规则放行'
      const extra = r.matched > 1 ? ` (匹配 ${r.matched} 条,只改了第一条)` : ''
      Toast.show({
        content: `${action} ${r.ip}${extra}`,
        icon: 'success',
        duration: 2500
      })
    } catch (e: any) {
      Toast.clear()
      // 如果是404错误（模板不存在于服务器），提示用户
      if (e?.response?.status === 404) {
        Toast.show({
          content: '模板仅存储在本地，后端接口暂不可用。请等待功能更新。',
          icon: 'fail',
          duration: 3000
        })
      } else {
        showApplyError(e)
      }
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

  const del = async (row: SGTemplate) => {
    const ok = await Dialog.confirm({ content: `删除白名单 "${row.name}"？` })
    if (!ok) return
    try {
      const success = deleteTemplate(row.id)
      if (success) {
        Toast.show({ content: '已删除', icon: 'success' })
        setList(loadTemplates())
      } else {
        Toast.show({ content: '删除失败', icon: 'fail' })
      }
    } catch (e: any) {
      Toast.show({ content: friendlyApiError(e), icon: 'fail' })
    }
  }

  // 导出配置
  const handleExport = () => {
    try {
      const json = exportTemplates()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cloudpilot-sg-templates-${dayjs().format('YYYYMMDD-HHmmss')}.json`
      a.click()
      URL.revokeObjectURL(url)
      Toast.show({ content: '已导出', icon: 'success' })
    } catch (e: any) {
      Toast.show({ content: '导出失败', icon: 'fail' })
    }
  }

  // 导入配置
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        const result = importTemplates(text, false) // 覆盖模式
        if (result.success) {
          Toast.show({ content: `已导入${result.count}个模板`, icon: 'success' })
          setList(loadTemplates())
        } else {
          Toast.show({ content: result.error || '导入失败', icon: 'fail' })
        }
      } catch (e: any) {
        Toast.show({ content: '读取文件失败', icon: 'fail' })
      }
    }
    input.click()
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
            <div style={{ fontSize: 11, opacity: 0.9 }}>
              当前公网 IP {ipStatus && myIP !== '获取中...' && myIP !== '准备中...' && myIP !== '获取失败' && `· ${ipStatus}`}
            </div>
            {(myIP === '获取中...' || myIP === '准备中...') ? (
              <div style={{ fontSize: 14, marginTop: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'white',
                  animation: 'pulse 1s ease-in-out infinite'
                }}/>
                {ipStatus || '正在获取IP...'}
              </div>
            ) : myIP === '获取失败' ? (
              <div style={{ marginTop: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>
                  ❌ 无法获取公网IP
                </div>
                {failedDetails.length > 0 && (
                  <div style={{ fontSize: 10, opacity: 0.85, lineHeight: 1.6 }}>
                    已尝试以下 {failedDetails.length} 个服务：
                    <div style={{ marginTop: 4 }}>
                      {failedDetails.map((f, i) => (
                        <div key={i} style={{ fontFamily: 'ui-monospace, monospace' }}>
                          · {f.service} ({f.reason})
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, fontFamily: 'ui-monospace, monospace' }}>
                {myIP}
              </div>
            )}
            <div style={{ fontSize: 11, marginTop: 6, opacity: 0.85, lineHeight: 1.5 }}>
              {myIP !== '获取失败' && myIP !== '未知' ? (
                <>
                  {list.length > 0 ? (
                    <>
                      点击任意白名单的"一键更新"按钮，将此 IP 加入对应安全组
                      <br />
                      <span style={{ fontSize: 10, opacity: 0.7 }}>
                        💡 如果一键更新失败，请手动到腾讯云控制台添加此IP
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ color: '#FFB020' }}>
                        ⚠️ 未登录或暂无白名单模板，无法使用一键更新
                      </span>
                      <br />
                      <span style={{ fontSize: 10, opacity: 0.7 }}>
                        请先登录并创建白名单模板，或手动到腾讯云控制台添加 {myIP}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span style={{ color: '#FFB020' }}>
                  ⚠️ IP获取失败，但不影响手动到控制台添加白名单
                </span>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'grid', gridTemplateColumns: list.length > 0 ? '1fr 1fr 1fr' : '1fr', gap: 8, marginBottom: 12 }}>
            {list.length > 0 ? (
              <>
                <Button
                  color="primary"
                  fill="outline"
                  size="small"
                  onClick={() => nav('/settings/security-groups/new')}
                >
                  <AddOutline /> 新建
                </Button>
                <Button
                  color="primary"
                  fill="outline"
                  size="small"
                  onClick={handleExport}
                  disabled={list.length === 0}
                >
                  <DownCircleOutline /> 导出
                </Button>
                <Button
                  color="primary"
                  fill="outline"
                  size="small"
                  onClick={handleImport}
                >
                  <UpCircleOutline /> 导入
                </Button>
              </>
            ) : (
              <Button
                block
                color="primary"
                size="small"
                onClick={() => nav('/login')}
              >
                返回登录页
              </Button>
            )}
          </div>

          {/* 客户端存储提示 */}
          {list.length > 0 && (
            <div style={{
              fontSize: 11,
              color: 'var(--text-tertiary)',
              padding: '8px 12px',
              background: 'var(--bg-elevated)',
              borderRadius: 8,
              marginBottom: 12,
              lineHeight: 1.5
            }}>
              💡 白名单模板存储在本地，不依赖服务器。导出备份后可在其他设备导入。
            </div>
          )}

          {/* 列表 */}
          {list.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 32,
              color: 'var(--text-tertiary)', fontSize: 13
            }}>
              <LockOutline fontSize={40} style={{ opacity: 0.4, marginBottom: 8 }} />
              <div>还没有白名单模板</div>
              <div style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                配置一次，以后一键就能把当前 IP 加入安全组
                <br />
                <span style={{ color: 'var(--warning)' }}>
                  💡 需要先登录才能创建和使用白名单模板
                </span>
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
              }}
                onClick={(e) => {
                  // 忽略"一键更新"按钮的点击
                  const target = e.target as HTMLElement
                  if (target.closest('button')) return
                  Dialog.show({
                    title: row.name,
                    content: (
                      <div style={{ fontSize: 12, lineHeight: 1.8, textAlign: 'left' }}>
                        <div><b>安全组 ID:</b> {row.sg_id}</div>
                        <div><b>地域:</b> {row.region}</div>
                        <div><b>端口:</b> {row.port}</div>
                        <div><b>协议:</b> {row.protocol}</div>
                        <div><b>备注:</b> {row.description || '-'}</div>
                        <div><b>云账号:</b> {
                          row.cloud_account_name
                            ? row.cloud_account_name
                            : row.cloud_account_id
                              ? `#${row.cloud_account_id}`
                              : row.secret_id
                                ? `${row.secret_id.slice(0, 8)}... (明文·旧版)`
                                : '未配置'
                        }</div>
                        <div><b>上次更新 IP:</b> {row.last_ip || '未同步'}</div>
                        <div><b>创建时间:</b> {row.created_at ? dayjs(row.created_at).format('YYYY-MM-DD HH:mm') : '-'}</div>
                        <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>
                          模板仅存储在本地，后端接口暂不可用，请等待功能更新
                        </div>
                      </div>
                    ),
                    closeOnAction: true,
                    actions: [[
                      { key: 'close', text: '关闭' },
                      { key: 'edit', text: '编辑', bold: true, onClick: () => nav(`/settings/security-groups/${row.id}/edit`) }
                    ]]
                  })
                }}
              >
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
