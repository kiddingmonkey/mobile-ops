/**
 * 获取公网IP - 多个可用的IP查询服务
 * 按优先级尝试，第一个成功就返回
 */

interface IPService {
  name: string
  url: string
  parse: (data: any) => string | null
  responseType?: 'json' | 'text'
}

const IP_SERVICES: IPService[] = [
  {
    name: 'ipinfo.io',
    url: 'https://ipinfo.io/json',
    responseType: 'json',
    parse: (data: any) => data.ip
  },
  {
    name: 'ip.sb',
    url: 'https://api.ip.sb/jsonip',
    responseType: 'json',
    parse: (data: any) => data.ip
  },
  {
    name: 'ipify',
    url: 'https://api.ipify.org?format=json',
    responseType: 'json',
    parse: (data: any) => data.ip
  },
  {
    name: 'icanhazip',
    url: 'https://icanhazip.com',
    responseType: 'text',
    parse: (data: any) => {
      const ip = String(data).trim()
      return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : null
    }
  },
  {
    name: 'myip.la',
    url: 'https://api.myip.la/en?json',
    responseType: 'json',
    parse: (data: any) => data.ip
  },
  {
    name: 'ipapi',
    url: 'https://ipapi.co/json/',
    responseType: 'json',
    parse: (data: any) => data.ip
  }
]

export interface FetchIPProgress {
  status: 'trying' | 'success' | 'failed'
  service: string
  ip?: string
  index: number
  total: number
  triedServices?: string[]  // 已经尝试过的服务列表
  failedServices?: Array<{ service: string; reason: string }>  // 失败的服务及原因
}

/**
 * 获取公网IP
 * 依次尝试多个服务，第一个成功的返回
 * @param onProgress 进度回调，可以显示当前尝试的服务
 * @param timeout 单个服务的超时时间（毫秒）
 */
export async function fetchPublicIP(
  onProgress?: (progress: FetchIPProgress) => void,
  timeout = 3000
): Promise<string> {
  const triedServices: string[] = []
  const failedServices: Array<{ service: string; reason: string }> = []

  for (let i = 0; i < IP_SERVICES.length; i++) {
    const service = IP_SERVICES[i]
    triedServices.push(service.name)

    onProgress?.({
      status: 'trying',
      service: service.name,
      index: i + 1,
      total: IP_SERVICES.length,
      triedServices: [...triedServices],
      failedServices: [...failedServices]
    })

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      const resp = await fetch(service.url, {
        method: 'GET',
        signal: controller.signal,
        mode: 'cors',
        credentials: 'omit'
      })

      clearTimeout(timer)

      if (!resp.ok) {
        const reason = `HTTP ${resp.status}`
        console.warn(`[fetchPublicIP] ${service.name} returned ${resp.status}`)
        failedServices.push({ service: service.name, reason })
        continue
      }

      let data: any
      if (service.responseType === 'text') {
        data = await resp.text()
      } else {
        data = await resp.json()
      }

      const ip = service.parse(data)
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) {
        console.log(`[fetchPublicIP] Got IP from ${service.name}: ${ip}`)
        onProgress?.({
          status: 'success',
          service: service.name,
          ip,
          index: i + 1,
          total: IP_SERVICES.length,
          triedServices: [...triedServices],
          failedServices: [...failedServices]
        })
        return ip
      } else {
        failedServices.push({ service: service.name, reason: 'IP格式错误' })
      }
    } catch (err: any) {
      const reason = err?.name === 'AbortError' ? '超时' : (err?.message || '网络错误')
      console.warn(`[fetchPublicIP] Failed with ${service.name}:`, err)
      failedServices.push({ service: service.name, reason })
      continue
    }
  }

  onProgress?.({
    status: 'failed',
    service: '',
    index: IP_SERVICES.length,
    total: IP_SERVICES.length,
    triedServices: [...triedServices],
    failedServices: [...failedServices]
  })
  return '获取失败'
}
