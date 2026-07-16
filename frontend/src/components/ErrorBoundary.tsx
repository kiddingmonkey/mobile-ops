import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { err: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null }

  static getDerivedStateFromError(err: Error): State {
    return { err }
  }

  componentDidCatch(err: Error, info: any) {
    console.error('[Mobile-Ops] render error:', err, info)
  }

  reset = () => this.setState({ err: null })

  render() {
    if (!this.state.err) return this.props.children
    return (
      <div style={{
        minHeight: '100vh',
        padding: 'env(safe-area-inset-top) 24px 24px',
        background: 'var(--bg-primary, #1F2329)',
        color: 'var(--text-primary, #E8EAED)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center'
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>页面异常</div>
        <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 20, wordBreak: 'break-all' }}>
          {this.state.err.message || String(this.state.err)}
        </div>
        <button
          onClick={this.reset}
          style={{
            padding: '12px 24px', border: 'none', borderRadius: 10,
            background: '#4A7EF8', color: 'white', fontSize: 15
          }}
        >重试</button>
        <button
          onClick={() => { window.location.href = '/' }}
          style={{
            marginTop: 12,
            padding: '12px 24px', border: '1px solid #444', borderRadius: 10,
            background: 'transparent', color: 'inherit', fontSize: 15
          }}
        >回到首页</button>
      </div>
    )
  }
}
