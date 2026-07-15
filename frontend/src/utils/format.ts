import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export function fmtTime(t: string | Date | undefined | null): string {
  if (!t) return '-'
  return dayjs(t).format('YYYY-MM-DD HH:mm:ss')
}

export function fmtRelative(t: string | Date | undefined | null): string {
  if (!t) return '-'
  return dayjs(t).fromNow()
}

export function fmtNumber(v: number | undefined | null, digits = 0): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '-'
  return v.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export function fmtPercent(v: number | undefined | null, digits = 1): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '-'
  return v.toFixed(digits) + '%'
}

export function fmtMoney(v: number | undefined | null): string {
  if (v === undefined || v === null) return '-'
  const abs = Math.abs(v)
  const sign = v >= 0 ? '+' : '-'
  return `${sign}¥${abs.toFixed(2)}`
}
