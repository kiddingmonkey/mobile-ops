import { useEffect, useRef, useState } from 'react'

interface EventStreamOptions {
  url: string
  enabled: boolean
  onMessage?: (events: any[]) => void
  onError?: (error: Event) => void
}

/**
 * SSE事件流订阅Hook
 * 自动管理EventSource连接，组件卸载时自动关闭
 */
export function useEventStream({ url, enabled, onMessage, onError }: EventStreamOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled || !url) {
      // 关闭现有连接
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setConnected(false)
      }
      return
    }

    // 创建EventSource连接
    const token = localStorage.getItem('mobile_ops_token')
    const urlWithAuth = url.includes('?')
      ? `${url}&token=${token}`
      : `${url}?token=${token}`

    const es = new EventSource(urlWithAuth)

    es.onopen = () => {
      console.log('[SSE] Connected to', url)
      setConnected(true)
    }

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // SSE返回的是事件数组
        const events = Array.isArray(data) ? data : [data]
        onMessage?.(events)
      } catch (e) {
        console.error('[SSE] Parse error:', e)
      }
    }

    es.onerror = (error) => {
      console.error('[SSE] Connection error:', error)
      setConnected(false)
      onError?.(error)
      // EventSource会自动重连，不需要手动处理
    }

    eventSourceRef.current = es

    // 清理函数
    return () => {
      console.log('[SSE] Closing connection to', url)
      es.close()
      eventSourceRef.current = null
      setConnected(false)
    }
  }, [url, enabled])

  return { connected }
}
