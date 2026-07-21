/**
 * 安全组白名单模板 - 客户端存储
 * 不依赖服务器，支持离线使用
 */

const STORAGE_KEY = 'cloudpilot_sg_templates'

export interface SGTemplate {
  id: string
  name: string
  sg_id: string
  region: string
  // 新方案: 引用云账号 (后端持有加密的 AK/SK)
  cloud_account_id?: number
  cloud_account_name?: string
  // 旧方案兼容: 早期版本可能存了明文 AK/SK
  secret_id?: string
  secret_key?: string
  description?: string
  created_at: string
  updated_at: string
}

// 加载所有模板
export function loadTemplates(): SGTemplate[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data) as SGTemplate[]
  } catch (e) {
    console.error('[SGStorage] Failed to load templates:', e)
    return []
  }
}

// 保存所有模板
function saveTemplates(templates: SGTemplate[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
    return true
  } catch (e) {
    console.error('[SGStorage] Failed to save templates:', e)
    return false
  }
}

// 创建模板
export function createTemplate(template: Omit<SGTemplate, 'id' | 'created_at' | 'updated_at'>): SGTemplate {
  const templates = loadTemplates()
  const newTemplate: SGTemplate = {
    ...template,
    id: Date.now().toString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  templates.push(newTemplate)
  saveTemplates(templates)
  return newTemplate
}

// 更新模板
export function updateTemplate(id: string, updates: Partial<SGTemplate>): boolean {
  const templates = loadTemplates()
  const index = templates.findIndex(t => t.id === id)
  if (index === -1) return false

  templates[index] = {
    ...templates[index],
    ...updates,
    updated_at: new Date().toISOString()
  }
  return saveTemplates(templates)
}

// 删除模板
export function deleteTemplate(id: string): boolean {
  const templates = loadTemplates()
  const filtered = templates.filter(t => t.id !== id)
  if (filtered.length === templates.length) return false
  return saveTemplates(filtered)
}

// 导出配置（用于备份）
export function exportTemplates(): string {
  const templates = loadTemplates()
  return JSON.stringify(templates, null, 2)
}

// 导入配置（从备份恢复）
export function importTemplates(jsonString: string, merge = false): { success: boolean; count: number; error?: string } {
  try {
    const imported = JSON.parse(jsonString) as SGTemplate[]
    if (!Array.isArray(imported)) {
      return { success: false, count: 0, error: '格式错误：不是有效的数组' }
    }

    // 验证数据格式
    for (const item of imported) {
      if (!item.name || !item.sg_id || !item.region || !item.secret_id || !item.secret_key) {
        return { success: false, count: 0, error: '格式错误：缺少必填字段' }
      }
    }

    if (merge) {
      // 合并模式：保留现有，添加新的
      const existing = loadTemplates()
      const existingIds = new Set(existing.map(t => t.id))
      const toAdd = imported.filter(t => !existingIds.has(t.id))
      saveTemplates([...existing, ...toAdd])
      return { success: true, count: toAdd.length }
    } else {
      // 覆盖模式：直接替换
      saveTemplates(imported)
      return { success: true, count: imported.length }
    }
  } catch (e: any) {
    return { success: false, count: 0, error: e.message || '导入失败' }
  }
}

// 清空所有模板
export function clearTemplates(): boolean {
  return saveTemplates([])
}

// 从服务器迁移数据（首次使用时调用一次）
export async function migrateFromServer(serverTemplates: any[]): Promise<number> {
  const existing = loadTemplates()
  if (existing.length > 0) {
    console.log('[SGStorage] Already has local templates, skip migration')
    return 0
  }

  const migrated: SGTemplate[] = serverTemplates.map(t => ({
    id: t.id?.toString() || Date.now().toString(),
    name: t.name,
    sg_id: t.sg_id,
    region: t.region,
    secret_id: t.secret_id,
    secret_key: t.secret_key,
    description: t.description,
    created_at: t.created_at || new Date().toISOString(),
    updated_at: t.updated_at || new Date().toISOString()
  }))

  saveTemplates(migrated)
  return migrated.length
}
