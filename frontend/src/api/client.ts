import axios, { AxiosInstance } from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'
const REMOTE_HEALTH = import.meta.env.VITE_REMOTE_HEALTH || '/api/v1/health'

// 后端不可用时给统一的可展示错误对象
export function friendlyApiError(err: any): string {
  if (!err) return '未知错误'
  const status = err.response?.status
  const body = err.response?.data
  if (status === 401) {
    // 登录页 401 = 账号密码错; 其他页 401 = token 过期
    const onLogin = typeof window !== 'undefined' && window.location.pathname === '/login'
    return onLogin ? '账号或密码错误' : '登录已过期，请重新登录'
  }
  if (status === 403) return '无权限'
  if (status === 404) return '接口不存在'
  if (status && status >= 500) {
    // nginx 500 / 网关错误：多半是后端没起或安全组没放开
    return `后端异常 (${status}) — 检查安全组或后端服务`
  }
  if (err.code === 'ERR_NETWORK' || err.message === 'Network Error') {
    return '网络不通 — 请先在设置里更新安全组白名单'
  }
  if (err.code === 'ECONNABORTED') return '请求超时'
  if (typeof body === 'string') return body
  return body?.error || err.message || '请求失败'
}

// 探测远程后端是否可达（不需要 token，用于首页/登录页顶部提示）
export async function pingRemote(): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const r = await axios.get(REMOTE_HEALTH, { timeout: 5000 })
    return { ok: r.status >= 200 && r.status < 300, status: r.status }
  } catch (e: any) {
    return { ok: false, status: e?.response?.status, error: friendlyApiError(e) }
  }
}

class ApiClient {
  private http: AxiosInstance

  constructor() {
    this.http = axios.create({
      baseURL: API_BASE,
      timeout: 10000
    })
    this.http.interceptors.request.use(cfg => {
      const token = localStorage.getItem('mobile_ops_token')
      if (token) cfg.headers.Authorization = `Bearer ${token}`
      return cfg
    })
    this.http.interceptors.response.use(
      r => r,
      err => {
        // 只有真正的登录过期 (401) 才踢回登录页
        // 5xx / 网络错误保留 reject，让页面自己做错误提示
        if (err.response?.status === 401) {
          const p = window.location.pathname
          const onAuthPage = p === '/login' || p === '/'
          localStorage.removeItem('mobile_ops_token')
          if (!onAuthPage) {
            window.location.href = '/login'
          }
        }
        return Promise.reject(err)
      }
    )
  }

  // ============ 通用请求方法 ============
  async get(path: string, config?: any) {
    const r = await this.http.get(path, config)
    return r.data
  }

  async post(path: string, data?: any, config?: any) {
    const r = await this.http.post(path, data, config)
    return r.data
  }

  // ============ Auth ============
  async login(username: string, password: string) {
    const r = await this.http.post('/auth/login', { username, password })
    return r.data as { token: string; user: any }
  }

  async me() {
    return (await this.http.get('/me')).data
  }

  // ============ Grafana Sources ============
  async listGrafana() {
    const r = (await this.http.get('/grafana-sources')).data
    return (Array.isArray(r) ? r : []) as any[]
  }
  async createGrafana(payload: {
    name: string; url: string; token: string; is_default?: boolean
  }) {
    return (await this.http.post('/grafana-sources', payload)).data
  }
  async deleteGrafana(id: number) {
    return (await this.http.delete(`/grafana-sources/${id}`)).data
  }

  // ============ Prometheus Sources ============
  async listProm() {
    const r = (await this.http.get('/prom-sources')).data
    return (Array.isArray(r) ? r : []) as any[]
  }
  async createProm(payload: {
    name: string; url: string; auth_type?: string; auth?: string; is_default?: boolean
  }) {
    return (await this.http.post('/prom-sources', payload)).data
  }

  // ============ Cloud Accounts ============
  async listCloudAccounts() {
    const r = (await this.http.get('/cloud-accounts')).data
    return (Array.isArray(r) ? r : []) as any[]
  }
  async createCloudAccount(payload: {
    name: string; provider: string; region: string; secret_id: string; secret_key: string
  }) {
    return (await this.http.post('/cloud-accounts', payload)).data
  }

  // ============ Clusters ============
  async listClusters() {
    const r = (await this.http.get('/clusters')).data
    return (Array.isArray(r) ? r : []) as any[]
  }
  async createCluster(payload: {
    name: string
    display_name?: string
    provider?: string
    provider_cluster_id?: string
    region?: string
    cloud_account_id?: number
    kubeconfig?: string
    grafana_source_id?: number
    grafana_cluster_var?: string
    prom_source_id?: number
    auto_pull_kubeconfig?: boolean
    is_extranet?: boolean
  }) {
    return (await this.http.post('/clusters', payload)).data
  }
  async getCluster(id: number) {
    return (await this.http.get(`/clusters/${id}`)).data
  }
  async updateCluster(id: number, payload: Record<string, any>) {
    return (await this.http.put(`/clusters/${id}`, payload)).data
  }
  async deleteCluster(id: number) {
    return (await this.http.delete(`/clusters/${id}`)).data
  }
  async syncCluster(id: number) {
    return (await this.http.post(`/clusters/${id}/sync`)).data
  }
  async clusterOverview(id: number) {
    return (await this.http.get(`/clusters/${id}/overview`)).data
  }
  async clusterMetrics(id: number) {
    return (await this.http.get(`/clusters/${id}/metrics`)).data
  }
  async listNodePools(clusterId: number) {
    const r = (await this.http.get(`/clusters/${clusterId}/node-pools`)).data
    return (Array.isArray(r) ? r : []) as any[]
  }
  // 后端代理的 Grafana 面板 PNG URL（带 token 走 SW/浏览器）
  grafanaPanelURL(clusterId: number, params: {
    dash: string; panel: number; from?: string; to?: string; theme?: string; w?: number; h?: number
  }) {
    const q = new URLSearchParams()
    q.set('dash', params.dash)
    q.set('panel', String(params.panel))
    if (params.from) q.set('from', params.from)
    if (params.to) q.set('to', params.to)
    if (params.theme) q.set('theme', params.theme)
    if (params.w) q.set('w', String(params.w))
    if (params.h) q.set('h', String(params.h))
    // 图片 URL 通过 fetch + blob 转 objectURL 才能带上 Authorization Header
    return `/api/v1/clusters/${clusterId}/grafana/panel?${q.toString()}`
  }
  // 拉图片二进制，转成 blob URL（浏览器 <img> 可以直接用）
  async fetchGrafanaPanelBlob(clusterId: number, params: {
    dash: string; panel: number; from?: string; to?: string; theme?: string; w?: number; h?: number
  }): Promise<string> {
    const path = this.grafanaPanelURL(clusterId, params).replace('/api/v1', '')
    const r = await this.http.get(path, { responseType: 'blob' })
    return URL.createObjectURL(r.data)
  }

  // ============ Scale ============
  async scalePrecheck(payload: {
    cluster_id: number; node_pool_id: number; delta: number
  }) {
    return (await this.http.post('/scale/precheck', payload)).data
  }
  async scaleSubmit(payload: {
    cluster_id: number; node_pool_id: number; delta: number;
    precheck: any; trigger_source?: string; alert_ref?: string
  }) {
    return (await this.http.post('/scale/submit', payload)).data as { operation_id: string }
  }

  // ============ Operations ============
  async listOperations(limit = 50) {
    const r = (await this.http.get('/operations', { params: { limit } })).data
    return (Array.isArray(r) ? r : []) as any[]
  }
  async getOperation(opID: string) {
    return (await this.http.get(`/operations/${opID}`)).data
  }

  // ============ Alerts ============
  async listAlerts(limit = 50) {
    const r = (await this.http.get('/alerts', { params: { limit } })).data
    return (Array.isArray(r) ? r : []) as any[]
  }

  // ============ Shortcuts ============
  async listShortcuts() {
    const r = (await this.http.get('/shortcuts')).data
    return (Array.isArray(r) ? r : []) as any[]
  }
  async createShortcut(payload: any) {
    return (await this.http.post('/shortcuts', payload)).data
  }
  async deleteShortcut(id: number) {
    return (await this.http.delete(`/shortcuts/${id}`)).data
  }

  // ============ Pod 详情 / 事件 / 日志 ============
  async getPodDetail(clusterId: number, namespace: string, name: string) {
    return (await this.http.get(`/clusters/${clusterId}/pods/${namespace}/${name}`)).data
  }
  async getPodEvents(clusterId: number, namespace: string, name: string) {
    const r = (await this.http.get(`/clusters/${clusterId}/pods/${namespace}/${name}/events`)).data
    return (Array.isArray(r) ? r : []) as any[]
  }
  async getPodLogs(clusterId: number, namespace: string, name: string, container?: string, tail = 500, previous = false) {
    const params: any = { tail, previous }
    if (container) params.container = container
    return (await this.http.get(`/clusters/${clusterId}/pods/${namespace}/${name}/logs`, { params })).data
  }

  // ============ 节点池详情 ============
  async getNodePoolDetail(clusterId: number, poolId: number) {
    return (await this.http.get(`/clusters/${clusterId}/node-pools/${poolId}`)).data
  }

  // ============ 安全组白名单 ============
  async whoamiIP() {
    return (await this.http.get('/whoami/ip')).data as { ip: string }
  }
  async listSGWhitelists() {
    const r = (await this.http.get('/security-groups/whitelists')).data
    return (Array.isArray(r) ? r : []) as any[]
  }
  async createSGWhitelist(payload: {
    name: string
    cloud_account_id: number
    region: string
    sg_id: string
    port?: string
    protocol?: string
    description?: string
  }) {
    return (await this.http.post('/security-groups/whitelists', payload)).data
  }
  async deleteSGWhitelist(id: number) {
    return (await this.http.delete(`/security-groups/whitelists/${id}`)).data
  }
  async applySGWhitelist(id: number, ip?: string) {
    return (await this.http.post(`/security-groups/whitelists/${id}/apply`, ip ? { ip } : {})).data
  }
}

export const api = new ApiClient()
