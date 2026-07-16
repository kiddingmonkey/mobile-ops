import { useEffect, useRef } from 'react'

/**
 * 原生 <input>,兼容 antd-mobile Form.Item 的受控协议 (value/onChange)。
 *
 * 解决两个问题:
 * 1. antd-mobile Input 在 APK WebView + 国产输入法下 onChange 有时不触发,
 *    导致 Form store 拿不到用户输入的值 —— 我们用 onInput 事件,更早更稳
 * 2. placeholder 作默认值: 用户不填时,onBlur 会把 placeholder 当作真实值
 *    写回 Form store,提交时就不再是空
 */
interface Props {
  value?: string
  onChange?: (v: string) => void
  placeholder?: string
  type?: 'text' | 'password' | 'url' | 'email' | 'number'
  disabled?: boolean
  usePlaceholderAsDefault?: boolean
  autoFocus?: boolean
  onEnterPress?: () => void
}

export default function NativeInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  usePlaceholderAsDefault = true,
  autoFocus,
  onEnterPress
}: Props) {
  const ref = useRef<HTMLInputElement>(null)

  // 挂载/value 外部变化时同步 DOM (受控)
  useEffect(() => {
    if (ref.current && ref.current.value !== (value ?? '')) {
      ref.current.value = value ?? ''
    }
  }, [value])

  const commit = (v: string) => {
    onChange?.(v)
  }

  const handleBlur = () => {
    const cur = ref.current?.value ?? ''
    if (!cur && usePlaceholderAsDefault && placeholder) {
      // 视觉上把 placeholder 写进输入框,同时提交给 Form store
      if (ref.current) ref.current.value = placeholder
      commit(placeholder)
    }
  }

  return (
    <input
      ref={ref}
      type={type}
      defaultValue={value ?? ''}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      onInput={(e) => commit((e.target as HTMLInputElement).value)}
      onChange={(e) => commit((e.target as HTMLInputElement).value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && onEnterPress) {
          e.preventDefault()
          onEnterPress()
        }
      }}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        padding: '10px 0',
        fontSize: 16,
        lineHeight: '22px',
        color: 'var(--text-primary)',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        WebkitAppearance: 'none',
        caretColor: 'var(--accent-blue)'
      }}
    />
  )
}
