/**
 * 告警智能分析工具 - 基于规则的根因诊断和建议
 *
 * 未来可扩展为调 LLM API 做更智能的分析
 */

export interface AlertAnalysis {
  rootCause: string
  possibleCauses: string[]
  suggestions: string[]
  quickActions: { label: string; action: string }[]
  docLink?: string
}

/**
 * 匹配告警名或摘要中的关键字，返回诊断建议
 */
export function analyzeAlert(alert: {
  alertname?: string
  summary?: string
  labels?: Record<string, any>
  annotations?: Record<string, any>
}): AlertAnalysis | null {
  const name = (alert.alertname || '').toLowerCase()
  const summary = (alert.summary || '').toLowerCase()
  const desc = ((alert.annotations?.description as string) || '').toLowerCase()
  const text = `${name} ${summary} ${desc}`

  // OOM / OOMKilled
  if (text.includes('oom') || text.includes('oomkilled')) {
    return {
      rootCause: '内存不足被系统 kill (OOMKilled)',
      possibleCauses: [
        '容器 memory limit 设置过低',
        '应用存在内存泄漏',
        '负载突增导致内存爆发',
        '缓存/连接池配置不合理'
      ],
      suggestions: [
        '查看 Pod 内存使用曲线，确认是渐增泄漏还是瞬时爆发',
        '临时方案：提高 memory limit（比如从 512Mi → 1Gi）',
        '长期方案：定位内存泄漏，配合 pprof/heapdump 分析',
        '检查 GC 策略（Java 应用调 -Xmx、Node.js 用 --max-old-space-size）'
      ],
      quickActions: [
        { label: '查看内存监控', action: 'monitor' },
        { label: '查看应用日志', action: 'logs' },
        { label: '编辑 YAML 调整 limit', action: 'yaml' }
      ],
      docLink: 'https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/'
    }
  }

  // CrashLoopBackOff
  if (text.includes('crashloopbackoff') || text.includes('crash loop')) {
    return {
      rootCause: 'Pod 反复启动失败进入 CrashLoop',
      possibleCauses: [
        '容器启动命令错误',
        '依赖服务不可用（DB / 中间件）',
        '配置文件缺失或格式错误',
        '权限问题（无法访问文件/端口）',
        'liveness probe 检测过严'
      ],
      suggestions: [
        '查看容器日志，找到具体 crash 原因',
        '查看 Pod 事件，看是不是配置或依赖问题',
        '临时禁用 liveness probe 排查是否误杀',
        '进入终端手动运行启动命令定位错误'
      ],
      quickActions: [
        { label: '查看日志', action: 'logs' },
        { label: '查看事件', action: 'events' },
        { label: '查看上次崩溃日志', action: 'previous-logs' }
      ]
    }
  }

  // ImagePullBackOff / ErrImagePull
  if (text.includes('imagepull') || text.includes('errimage') || text.includes('image pull')) {
    return {
      rootCause: '容器镜像拉取失败',
      possibleCauses: [
        '镜像地址错误（tag/仓库名）',
        '私有镜像仓库认证失败（缺 imagePullSecret）',
        '节点无法连接到镜像仓库（网络/DNS）',
        '镜像仓库限流'
      ],
      suggestions: [
        '检查 YAML 里 image 字段是否正确',
        '确认 imagePullSecrets 已配置且有效',
        '在节点上手动 docker pull 测试',
        '换用镜像加速器地址'
      ],
      quickActions: [
        { label: '查看事件', action: 'events' },
        { label: '编辑 YAML', action: 'yaml' }
      ]
    }
  }

  // Node NotReady / Unreachable
  if (text.includes('nodenotready') || text.includes('notready') || text.includes('unreachable')) {
    return {
      rootCause: '节点失联或状态异常',
      possibleCauses: [
        'kubelet 进程挂了',
        '节点磁盘满 / 内存满',
        '节点网络不通（安全组/路由）',
        '节点被驱逐或维护中'
      ],
      suggestions: [
        'SSH 到节点看 kubelet 状态',
        '检查节点磁盘和内存使用',
        '查看云厂商控制台节点健康状态',
        '如果是临时问题，等待自动恢复；如果持久，考虑替换节点'
      ],
      quickActions: [
        { label: '查看节点监控', action: 'monitor' },
        { label: '查看节点事件', action: 'events' }
      ]
    }
  }

  // High CPU / Memory
  if ((text.includes('high cpu') || text.includes('cpu high') || text.includes('cpu usage')) && !text.includes('memory')) {
    return {
      rootCause: 'CPU 使用率异常升高',
      possibleCauses: [
        '业务流量突增',
        '死循环或 GC 抖动',
        'CPU limit 设置过低导致 throttling',
        '定时任务/批处理占用大量 CPU'
      ],
      suggestions: [
        '查看流量指标，确认是不是流量突增',
        '如果是稳定升高，考虑扩容',
        '看容器 CPU throttling 指标是否高',
        'Java 应用可以 jstack/Async Profiler 查热点'
      ],
      quickActions: [
        { label: '查看监控', action: 'monitor' },
        { label: '快速扩容', action: 'scale' }
      ]
    }
  }

  if (text.includes('high memory') || text.includes('memory high') || text.includes('memory usage')) {
    return {
      rootCause: '内存使用率异常升高',
      possibleCauses: [
        '内存泄漏',
        '缓存无淘汰策略',
        '大对象/大结果集加载到内存',
        'JVM 堆参数配置不合理'
      ],
      suggestions: [
        '查看内存曲线，判断是渐增还是瞬时',
        '如果是 Java 应用，检查 -Xmx 是否合理',
        '导出 heapdump 分析对象占用',
        '临时方案：滚动重启释放内存'
      ],
      quickActions: [
        { label: '查看监控', action: 'monitor' },
        { label: '滚动重启', action: 'restart' }
      ]
    }
  }

  // Pod not ready / ReadinessProbe
  if (text.includes('podnotready') || text.includes('not ready') || text.includes('readiness')) {
    return {
      rootCause: 'Pod 长时间未 Ready',
      possibleCauses: [
        'Readiness probe 失败',
        '应用启动慢（比预期长）',
        '依赖服务未就绪',
        '端口未监听或路径错误'
      ],
      suggestions: [
        '查看容器日志确认启动过程',
        '检查 readinessProbe 配置（超时/延迟）',
        '手动 curl probe endpoint 测试',
        '延长 initialDelaySeconds'
      ],
      quickActions: [
        { label: '查看日志', action: 'logs' },
        { label: '查看事件', action: 'events' }
      ]
    }
  }

  // Disk pressure / disk full
  if (text.includes('disk') || text.includes('磁盘') || text.includes('storage')) {
    return {
      rootCause: '磁盘压力或空间不足',
      possibleCauses: [
        '日志文件占满磁盘',
        '容器镜像堆积',
        'PVC 使用满',
        '临时文件未清理'
      ],
      suggestions: [
        '清理 /var/log 下大日志',
        'docker system prune 清理未用镜像',
        '扩容 PVC 或迁移到大盘',
        '配置 log rotation'
      ],
      quickActions: [
        { label: '查看节点监控', action: 'monitor' },
        { label: '进入终端清理', action: 'terminal' }
      ]
    }
  }

  // 无法匹配任何规则
  return null
}

/**
 * 获取告警的严重程度评分（用于排序）
 * @returns 0-100 的评分，越高越严重
 */
export function scoreAlert(alert: any): number {
  const sev = (alert.severity || '').toLowerCase()
  const status = (alert.status || '').toLowerCase()
  const age = alert.starts_at ? (Date.now() - new Date(alert.starts_at).getTime()) / 1000 : 0

  let score = 0
  if (status === 'firing') score += 50
  if (sev === 'critical') score += 40
  else if (sev === 'warning') score += 20

  // 持续时间越长越紧急（超过 10 分钟）
  if (age > 600) score += 10

  return Math.min(score, 100)
}
