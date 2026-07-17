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

/**
 * 获取公网IP
 * 依次尝试多个服务，第一个成功的返回
 */
export async function fetchPublicIP(timeout = 3000): Promise<string> {
  for (const service of IP_SERVICES) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      const resp = await fetch(service.url, {
        method: 'GET',
        signal: controller.signal,
        // 避免CORS问题
        mode: 'cors',
        credentials: 'omit'
      })

      clearTimeout(timer)

      if (!resp.ok) {
        console.warn(`[fetchPublicIP] ${service.name} returned ${resp.status}`)
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
        return ip
      }
    } catch (err) {
      console.warn(`[fetchPublicIP] Failed with ${service.name}:`, err)
      continue
    }
  }

  return '获取失败'
}
