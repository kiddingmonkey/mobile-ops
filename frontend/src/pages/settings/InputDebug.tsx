import { useState, useRef } from 'react'
import { Input, Button, Card, Toast, NavBar } from 'antd-mobile'
import { useNavigate } from 'react-router-dom'

interface LogEntry {
  timestamp: string
  event: string
  value: string
  detail: string
}

export default function InputDebugPage() {
  const nav = useNavigate()
  const [testValue, setTestValue] = useState('')
  const [nativeValue, setNativeValue] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const inputRef = useRef<any>(null)
  const nativeInputRef = useRef<HTMLInputElement>(null)
  const isComposingRef = useRef(false)  // 标记是否在组合输入中

  const addLog = (event: string, value: string, detail: string = '') => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      event,
      value,
      detail
    }
    setLogs(prev => [entry, ...prev].slice(0, 50)) // 只保留最近50条
    console.log('[InputDebug]', entry)
  }

  const handleChange = (val: string) => {
    setTestValue(val)
    addLog('onChange', val, `length: ${val.length}`)
  }

  const handleFocus = (e: any) => {
    addLog('onFocus', testValue, `type: ${e?.target?.type}, inputMode: ${e?.target?.inputMode}`)
  }

  const handleBlur = (e: any) => {
    addLog('onBlur', testValue, `type: ${e?.target?.type}`)
  }

  const handleKeyDown = (e: any) => {
    addLog('onKeyDown', e.key, `keyCode: ${e.keyCode}, which: ${e.which}`)
  }

  const handleCompositionEnd = (e: any) => {
    const val = e.target.value || e.data || ''
    addLog('onCompositionEnd', val, `组合输入结束，最终值: ${val}`)
    isComposingRef.current = false
    setTestValue(val)
  }

  const handleNativeCompositionStart = () => {
    isComposingRef.current = true
    addLog('[原生]onCompositionStart', '', '组合输入开始')
  }

  const handleNativeCompositionEnd = (e: React.CompositionEvent<HTMLInputElement>) => {
    isComposingRef.current = false
    const val = e.currentTarget.value
    addLog('[原生]onCompositionEnd', val, `组合输入结束，最终值: ${val}`)
    setNativeValue(val)
  }

  const handleNativeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    addLog('[原生]onChange', val, `length: ${val.length}, isComposing: ${isComposingRef.current}`)
    // 如果不在组合输入中，立即更新
    if (!isComposingRef.current) {
      setNativeValue(val)
    }
    // 如果在组合输入中，不更新 state，等待 compositionend
  }

  const handleNativeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // 失去焦点时，强制同步 input 的实际值到 state
    const actualValue = e.currentTarget.value
    addLog('[原生]onBlur', actualValue, `type: ${e.target.type}, 强制同步值`)

    // 如果 DOM 值和 state 不一致，同步
    if (actualValue !== nativeValue) {
      addLog('[原生]同步', actualValue, `检测到值不一致，从 "${nativeValue}" 同步到 "${actualValue}"`)
      setNativeValue(actualValue)
    }
  }

  const copyLogs = () => {
    const text = logs.map(log =>
      `[${log.timestamp}] ${log.event}: "${log.value}" ${log.detail}`
    ).join('\n')

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        Toast.show({ content: '日志已复制', icon: 'success' })
      })
    } else {
      // 降级方案
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      Toast.show({ content: '日志已复制', icon: 'success' })
    }
  }

  const clearLogs = () => {
    setLogs([])
    setTestValue('')
    Toast.show({ content: '已清空' })
  }

  const getInputInfo = () => {
    const input = inputRef.current?.nativeElement
    if (input) {
      const info = {
        type: input.type,
        inputMode: input.inputMode,
        value: input.value,
        readOnly: input.readOnly,
        disabled: input.disabled,
        className: input.className,
        tagName: input.tagName
      }
      addLog('getInputInfo', JSON.stringify(info), '')
    } else {
      addLog('getInputInfo', 'input ref 为空', '')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <NavBar onBack={() => nav(-1)}>输入调试</NavBar>

      <div style={{ padding: 12 }}>
        {/* 测试输入框 - antd-mobile */}
        <Card title="antd-mobile Input（当前使用）" style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              输入任何内容（中文、英文、数字），观察下方日志
            </div>
            <Input
              ref={inputRef}
              type="text"
              inputMode="text"
              placeholder="请输入测试内容..."
              value={testValue}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown as any}
              onCompositionEnd={handleCompositionEnd as any}
            />
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            当前值: <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 3 }}>
              {testValue || '(空)'}
            </code>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" onClick={getInputInfo}>获取输入框信息</Button>
            <Button size="small" onClick={() => setTestValue('')}>清空输入</Button>
          </div>
        </Card>

        {/* 原生 HTML input 对比测试 */}
        <Card title="原生 HTML Input（对比测试）" style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              尝试在此输入中文/英文，看是否能保留内容
            </div>
            <input
              ref={nativeInputRef}
              type="text"
              inputMode="text"
              placeholder="原生输入框..."
              value={nativeValue}
              onChange={handleNativeChange}
              onFocus={(e) => {
                addLog('[原生]onFocus', nativeValue, `type: ${e.target.type}`)
              }}
              onBlur={handleNativeBlur}
              onCompositionStart={handleNativeCompositionStart}
              onCompositionEnd={handleNativeCompositionEnd}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                border: '1px solid var(--border-color)',
                borderRadius: 4,
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)'
              }}
            />
          </div>
          <div style={{ fontSize: 13, marginBottom: 8 }}>
            当前值: <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 3 }}>
              {nativeValue || '(空)'}
            </code>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="small" onClick={() => {
              const input = nativeInputRef.current
              if (input) {
                addLog('[原生]getInfo', JSON.stringify({
                  type: input.type,
                  inputMode: input.inputMode,
                  value: input.value
                }), '')
              }
            }}>获取信息</Button>
            <Button size="small" onClick={() => setNativeValue('')}>清空</Button>
          </div>
        </Card>

        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <Button block onClick={copyLogs} disabled={logs.length === 0}>
            复制日志 ({logs.length})
          </Button>
          <Button block onClick={clearLogs} disabled={logs.length === 0}>
            清空日志
          </Button>
        </div>

        {/* 日志列表 */}
        <Card title="事件日志" style={{ marginBottom: 12 }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
              暂无日志，请在上方输入框输入内容
            </div>
          ) : (
            <div style={{
              maxHeight: '60vh',
              overflow: 'auto',
              fontSize: 12,
              fontFamily: 'monospace'
            }}>
              {logs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--border-color)',
                    background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'
                  }}
                >
                  <div style={{ color: 'var(--text-tertiary)' }}>
                    {log.timestamp} <strong style={{ color: 'var(--accent-blue)' }}>{log.event}</strong>
                  </div>
                  <div style={{ color: 'var(--text-primary)' }}>
                    值: "{log.value}"
                  </div>
                  {log.detail && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                      {log.detail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 说明 */}
        <Card title="对比测试说明">
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
            <p><strong>测试步骤：</strong></p>
            <p>1. 先在"antd-mobile Input"输入中文（例如：测试）</p>
            <p>2. 点击"获取输入框信息"按钮</p>
            <p>3. 观察内容是否被清空</p>
            <p>4. 再在"原生 HTML Input"输入中文</p>
            <p>5. 点击"获取信息"按钮</p>
            <p>6. 观察内容是否保留</p>
            <p>7. 如果原生输入框能保留，说明是 antd-mobile 的问题</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
