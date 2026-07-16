import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, Tag, List, Toast, PullToRefresh } from 'antd-mobile'
import PageShell from '@/components/PageShell'
import { api } from '@/api/client'
import dayjs from 'dayjs'

export default function NodePoolDetailPage() {
  const nav = useNavigate()
  const { clusterId, poolId } = useParams<{ clusterId: string; poolId: string }>()
  const [detail, setDetail] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (clusterId && poolId) {
      loadDetail()
    }
  }, [clusterId, poolId])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const d = await api.getNodePoolDetail(Number(clusterId), Number(poolId))
      setDetail(d)
    } catch (e: any) {
      Toast.show({ content: e?.message || '加载失败', icon: 'fail' })
    } finally {
      setLoading(false)
    }
  }

  if (!detail) {
    return (
      <PageShell title="节点池详情" onBack={() => nav(-1)}>
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-tertiary)' }}>
          加载中...
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell title={detail.name || '节点池'} onBack={() => nav(-1)}>
      <PullToRefresh onRefresh={loadDetail}>
        <div style={{ background: 'var(--background)', minHeight: '100vh', padding: '12px 12px 60px' }}>
          {/* 核心指标 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 12
          }}>
            <StatCard label="当前" value={detail.current_nodes_num || 0} color="var(--accent-blue)" />
            <StatCard label="期望" value={detail.desired_nodes_num || 0} color="var(--success)" />
            <StatCard label="最小" value={detail.min_nodes_num || 0} color="var(--text-secondary)" />
            <StatCard label="最大" value={detail.max_nodes_num || 0} color="var(--text-secondary)" />
          </div>

          {/* 基础信息 */}
          <Card title="基础信息" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <Tag color={detail.life_state === 'normal' ? 'success' : 'warning'}>
                {detail.life_state || 'unknown'}
              </Tag>
              {detail.instance_type && <Tag color="primary">{detail.instance_type}</Tag>}
            </div>
            <InfoRow label="节点池 ID" value={detail.node_pool_id} />
            <InfoRow label="集群 ID" value={detail.cluster_id} />
            {detail.autoscaling_group_id && (
              <InfoRow label="伸缩组 ID" value={detail.autoscaling_group_id} />
            )}
            {detail.created_at && (
              <InfoRow label="创建时间" value={dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')} />
            )}
          </Card>

          {/* Labels */}
          {detail.labels && detail.labels.length > 0 && (
            <Card title="Labels" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {detail.labels.map((l: any, i: number) => (
                  <Tag key={i} color="primary" style={{ fontSize: 11 }}>
                    {l.key}={l.value}
                  </Tag>
                ))}
              </div>
            </Card>
          )}

          {/* Taints */}
          {detail.taints && detail.taints.length > 0 && (
            <Card title="Taints" style={{ marginBottom: 12 }}>
              {detail.taints.map((t: any, i: number) => (
                <div key={i} style={{ marginBottom: 6, fontSize: 12 }}>
                  <span style={{ fontWeight: 600 }}>{t.key}</span>
                  {t.value && <span style={{ color: 'var(--text-secondary)' }}>={t.value}</span>}
                  <Tag color="warning" style={{ marginLeft: 6, fontSize: 10 }}>{t.effect}</Tag>
                </div>
              ))}
            </Card>
          )}
        </div>
      </PullToRefresh>
    </PageShell>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--card-background)',
      border: '1px solid var(--border-color)',
      borderRadius: 8,
      padding: '12px 8px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        {label}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', marginBottom: 6, fontSize: 12 }}>
      <span style={{ color: 'var(--text-tertiary)', minWidth: 100 }}>{label}</span>
      <span style={{ color: 'var(--text-primary)', flex: 1, wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}
