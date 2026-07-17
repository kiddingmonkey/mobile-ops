/**
 * 获取公网IP - 多个国内可访问的服务
 * 按优先级尝试，第一个成功就返回
 */

interface IPService {
  name: string
  url: string
  parse: (data: any) => string | null
}

const IP_SERVICES: IPService[] = [
  {
    // 淘宝IP查询（国内快）
    name: 'taobao',
    url: 'https://www.taobao.com/help/getip.php',
    parse: (data: any) => {
      // 返回格式：ipCallback({ip:"xxx.xxx.xxx.xxx"})
      const match = String(data).match(/ip:"([\d.]+)"/)
      return match ? match[1] : null
    }
  },
  {
    // ip.sb（国内可访问）
    name: 'ip.sb',
    url: 'https://api.ip.sb/jsonip',
    parse: (data: any) => data.ip
  },
  {
    // 腾讯天气IP查询
    name: 'qq-weather',
    url: 'https://pv.sohu.com/cityjson?ie=utf-8',
    parse: (data: any) => {
      // 返回格式：var returnCitySN = {"cip": "xxx.xxx.xxx.xxx", ...}
      const match = String(data).match(/"cip":\s*"([\d.]+)"/)
      return match ? match[1] : null
    }
  },
  {
    // ipify（国外，作为降级）
    name: 'ipify',
    url: 'https://api.ipify.org?format=json',
    parse: (data: any) => data.ip
  },
  {
    // ipapi.co（国外，作为降级）
    name: 'ipapi',
    url: 'https://ipapi.co/json/',
    parse: (data: any) => data.ip
  }
]

/**
 * 获取公网IP
 * 依次尝试多个服务，第一个成功的返回
 */
export async function fetchPublicIP(timeout = 5000): Promise<string> {
  for (const service of IP_SERVICES) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      const resp = await fetch(service.url, {
        method: 'GET',
        signal: controller.signal
      })

      clearTimeout(timer)

      if (!resp.ok) continue

      // 根据内容类型解析
      const contentType = resp.headers.get('content-type') || ''
      let data: any
      if (contentType.includes('application/json')) {
        data = await resp.json()
      } else {
        data = await resp.text()
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
