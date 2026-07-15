import { useEffect, useState } from 'react'
import { List, Selector, Stepper, Button, Toast, Dialog, Result, Card, Grid } from 'antd-mobile'
import { CheckCircleFill, CloseCircleFill, ClockCircleOutline } from 'antd-mobile-icons'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useUI } from '@/store'
import PageShell from '@/components/PageShell'
import { fmtMoney } from '@/utils/format'

type Step = 'select' | 'confirm' | 'progress' | 'done'

export default function ScalePage() {
  const nav = useNavigate()
  const activeClusterId = useUI(s => s.activeClusterId)
  const setActive = useUI(s => s.setActiveCluster)

  const [step, setStep] = useState<Step>('select')
  const [clusters, setClusters] = useState<any[]>([])
  const [pools, setPools] = useState<any[]>([])
  const [clusterId, setClusterId] = useState<number | null>(activeClusterId)
  const [poolId, setPoolId] = useState<number | null>(null)
  const [delta, setDelta] = useState<number>(1)
  const [precheck, setPrecheck] = useState<any>(null)
  const [prechecking, setPrechecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [operationId, setOperationId] = useState<string | null>(null)
  const [operation, setOperation] = useState<any>(null)

  useEffect(() => {
    api.listClusters().then(cs => {
      setClusters(cs || [])
      if (!clusterId && cs && cs.length > 0) {
        setClusterId(cs[0].id)
      }
    })
  }, [])

  useEffect(() => {
    if (!clusterId) return
    api.listNodePools(clusterId).then(ps => {
      setPools(ps || [])
      if (ps && ps.length > 0) setPoolId(ps[0].id)
    })
  }, [clusterId])

  // Poll operation status
  useEffect(() => {
    if (step !== 'progress' || !operationId) return
    const t = setInterval(async () => {
      try {
        const op = await api.getOperation(operationId)
        setOperation(op)
        if (op.status === 'success' || op.status === 'failed') {
          setStep('done')
          clearInterval(t)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(t)
  }, [step, operationId])

  const runPrecheck = async () => {
    if (!clusterId || !poolId) {
      Toast.show({ content: '请选集群和节点池', icon: 'fail' })
      return
    }
    if (delta === 0) {
      Toast.show({ content: '变化数不能为 0', icon: 'fail' })
      return
    }
    setPrechecking(true)
    try {
      const r = await api.scalePrecheck({ cluster_id: clusterId, node_pool_id: poolId, delta })
      setPrecheck(r)
      setStep('confirm')
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '预检失败', icon: 'fail' })
    } finally {
      setPrechecking(false)
    }
  }

  const runSubmit = async () => {
    if (!precheck?.passed) return
    const confirmed = await Dialog.confirm({
      content: `确认${delta > 0 ? '扩容' : '缩容'} ${Math.abs(delta)} 台？将从 ${precheck.current_size} → ${precheck.target_size}`
    })
    if (!confirmed) return
    setSubmitting(true)
    try {
      const r = await api.scaleSubmit({
        cluster_id: clusterId!,
        node_pool_id: poolId!,
        delta,
        precheck,
        trigger_source: 'manual'
      })
      setOperationId(r.operation_id)
      setStep('progress')
    } catch (e: any) {
      Toast.show({ content: e?.response?.data?.error || '提交失败', icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageShell title="扩缩容" onBack={() => nav(-1)}>
      {step === 'select' && (
        <>
          <div className="card">
            <div className="card-title">1. 选择目标</div>
            <List>
              <List.Item title="集群">
                <Selector
                  columns={2}
                  options={clusters.map(c => ({ label: c.display_name || c.name, value: c.id }))}
                  value={clusterId ? [clusterId] : []}
                  onChange={v => setClusterId(v[0] as number)}
                />
              </List.Item>
              <List.Item title="节点池">
                {pools.length === 0 ? (
                  <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                    还没有节点池，去设置里同步或手动添加
                  </div>
                ) : (
                  <Selector
                    columns={1}
                    options={pools.map(p => ({
                      label: `${p.name} (当前 ${p.current_size ?? p.desired_size ?? '?'} / max ${p.max_size})`,
                      value: p.id
                    }))}
                    value={poolId ? [poolId] : []}
                    onChange={v => setPoolId(v[0] as number)}
                  />
                )}
              </List.Item>
            </List>
          </div>

          <div className="card">
            <div className="card-title">2. 变化数量</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>
                {delta > 0 ? `扩容 ${delta} 台` : delta < 0 ? `缩容 ${-delta} 台` : '未选'}
              </span>
              <Stepper value={delta} onChange={setDelta} min={-20} max={20} />
            </div>
          </div>

          <Button
            block color="primary" size="large"
            loading={prechecking}
            onClick={runPrecheck}
            style={{ marginTop: 24 }}
          >开始预检</Button>
        </>
      )}

      {step === 'confirm' && precheck && (
        <>
          <div className="card">
            <div className="card-title">预检结果</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ color: 'var(--text-secondary)' }}>当前 → 目标</span>
              <span style={{ fontSize: 18, fontWeight: 700 }}>
                {precheck.current_size} → {precheck.target_size}
              </span>
            </div>
            {precheck.estimated_month_cost !== undefined && precheck.estimated_month_cost !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ color: 'var(--text-secondary)' }}>预计月成本变化</span>
                <span style={{
                  fontSize: 15, fontWeight: 600,
                  color: precheck.estimated_month_cost > 0 ? 'var(--danger)' : 'var(--success)'
                }}>{fmtMoney(precheck.estimated_month_cost)}</span>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">5 项预检明细</div>
            {precheck.items.map((it: any, i: number) => (
              <div key={i} style={{
                padding: '8px 0', display: 'flex', gap: 10,
                borderBottom: i < precheck.items.length - 1 ? '1px solid var(--border-color)' : 'none'
              }}>
                <span style={{ fontSize: 18 }}>
                  {it.status === 'pass' && <CheckCircleFill color="var(--success)" />}
                  {it.status === 'fail' && <CloseCircleFill color="var(--danger)" />}
                  {it.status === 'skip' && <ClockCircleOutline color="var(--warning)" />}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{it.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{it.message}</div>
                </div>
              </div>
            ))}
          </div>

          {precheck.warnings && precheck.warnings.length > 0 && (
            <div className="card" style={{ background: 'var(--warning-bg)' }}>
              <div style={{ fontSize: 13, color: 'var(--warning)' }}>
                {precheck.warnings.join(' · ')}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <Button block fill="outline" onClick={() => setStep('select')}>返回</Button>
            <Button
              block color="primary"
              loading={submitting}
              disabled={!precheck.passed}
              onClick={runSubmit}
            >{precheck.passed ? '一键执行' : '预检未过'}</Button>
          </div>
        </>
      )}

      {step === 'progress' && (
        <div className="card">
          <div className="card-title">执行中</div>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 16, marginBottom: 8 }}>
              状态: {operation?.status || 'pending'}
            </div>
            {operation?.metadata?.current !== undefined && (
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                {operation.metadata.current} / {operation.metadata.target}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 12 }}>
              operation_id: {operationId?.slice(0, 8)}...
            </div>
          </div>
        </div>
      )}

      {step === 'done' && operation && (
        <Result
          status={operation.status === 'success' ? 'success' : 'error'}
          title={operation.status === 'success' ? '扩缩容完成' : '执行失败'}
          description={operation.error_msg || `节点池已调整到 ${operation.target_size} 台`}
        />
      )}

      {step === 'done' && (
        <Button
          block color="primary" style={{ marginTop: 16 }}
          onClick={() => nav('/')}
        >返回首页</Button>
      )}
    </PageShell>
  )
}
