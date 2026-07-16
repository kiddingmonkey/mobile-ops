import axios, { AxiosInstance } from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1'

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
        if (err.response?.status === 401) {
          localStorage.removeItem('mobile_ops_token')
          if (window.location.pathname !== '/login') {
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
}

export const api = new ApiClient()
