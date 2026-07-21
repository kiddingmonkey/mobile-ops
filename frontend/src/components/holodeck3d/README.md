# Holodeck 3D 舰桥

Mobile-Ops 全息舰桥的 Three.js 3D 版本，完全替代 2D 全息模式，提供沉浸式 SRE 体验。

## 功能特性

### 场景元素
- **圆形舰桥地板**：青色霓虹网格（6 个同心圆 + 12 条径向射线）
- **中央玩家位**：品红发光圆环 + 垂直光柱
- **6 个环绕控制台**：
  - 🚨 ALERTS（警报）
  - 🔍 DIAG（诊断）
  - ⚙️ TASKS（任务）
  - 📦 RESOURCES（资源）
  - 📊 MONITOR（监控）
  - ⚡ CONFIG（配置）
- **弧形主屏幕**：正前方显示星系总览 + 5 项实时数据
- **深空星野**：700 颗星星背景 + 缓慢自转

### 交互方式
- **点击控制台** → 相机平滑推近聚焦 → 500ms 后弹出对应面板
- **单指拖动** → 水平旋转 + 上下俯仰（限幅 -0.6 ~ 0.5）
- **双指捏合** → 缩放距离（3-12 米）
- **滚轮** → 桌面端缩放
- **右滑边缘** → 呼出快速指令抽屉

### 面板系统（6 个全息滑入面板）

#### AlertsPanel（警报中心）
- FIRING / RESOLVED tab 切换
- CRITICAL / OTHERS 分组
- 点击告警 → TaskInspector 详情浮层
- 全屏按钮跳转 /alerts

#### TasksPanel（任务中心）
- RUNNING / RECENT 分组
- 显示扩容/缩容/重启任务状态
- 点击任务 → TaskInspector 详情浮层
- 全屏按钮跳转 /tasks

#### ResourcesPanel（集群资源）
- 集群选择器
- 9 类资源 tab：Pods / Deploys / StatefulSets / DaemonSets / Services / Ingresses / ConfigMaps / Secrets / Nodes
- 搜索过滤（资源名 / namespace）
- 点击资源 → 跳转 /cluster-resources 详情页
- 显示前 100 项，更多点击全屏查看

#### DiagnosePanel（系统诊断）
- 集群健康概览：CPU / 内存 / 节点总数 / 就绪节点
- 异常节点列表（NotReady 红色告警）
- 正常节点列表（前 10 个）
- 全屏按钮跳转 /diagnose

#### MonitorPanel（监控中心）
- Grafana 数据源列表（点击跳 /monitor）
- Prometheus 数据源列表（点击跳 /monitor）
- 状态可视化

#### ConfigPanel（系统配置）
- 6 种主题切换：深色 / 浅色 / 纯黑 / 国风 / 全息 / 跟随系统
- 数据源状态汇总：Grafana / Prometheus / 云账号 / 集群
- 快捷入口：Grafana / Prom / 云账号 / 集群 / 告警策略 / 完整设置

### 视觉效果
- **Bloom 发光**：intensity 1.2，luminanceThreshold 0.1（低端设备保留）
- **色差**：ChromaticAberration offset 0.0008（低端设备关闭）
- **扫描线**：density 2.5，opacity 0.04（低端设备关闭）
- **暗角**：Vignette offset 0.2（低端设备关闭）
- **动画**：呼吸 / 自转 / 悬浮 / 上浮

### 音效系统
- **consoleHover**：悬停短促 beep（1200Hz 0.08s）
- **consoleClick**：低频 thump（150→80Hz）+ 高频 click（2400Hz）
- **panelOpen**：上升音阶（600→1200Hz）
- **panelClose**：下降音阶（1200→600Hz）
- **alertCritical**：双音调警报（800↔1200Hz 3 次循环）
- **alertWarning**：柔和双音（500→700Hz）
- **ambient**：60Hz 低频嗡鸣 + 随机 beep（循环）
- **开关**：顶部 HUD 🔊/🔇 按钮，状态存 localStorage

### 性能优化
- **代码分割**：Bridge3DScene 独立 chunk（244KB gzip）
- **懒加载**：所有面板独立懒加载（1-2KB 每个）
- **低端降级**：
  - 检测：内存 ≤3GB 或核心 ≤4
  - 降级：关闭色差/扫描线/暗角，只保留 Bloom
  - DPR：lowPerf ? [1, 1.2] : [1, 1.75]
  - 星星数：lowPerf ? 300 : 700
- **WebGL fallback**：不支持时自动切回 2D HolodeckLayout
- **2D 切换**：顶部 "2D VIEW" 按钮，状态存 localStorage

## 技术栈
- **three@0.170.0**：3D 引擎核心
- **@react-three/fiber@8.17.10**：React 绑定
- **@react-three/drei@9.114.0**：辅助工具（Html / 相机控制）
- **@react-three/postprocessing@2.16.5**：后处理
- **postprocessing@6.36.4**：Bloom / 色差 / 扫描线 / 暗角

## 文件结构
```
frontend/src/components/holodeck3d/
├── Bridge3D.tsx              # 顶层入口：数据聚合 + 面板路由 + fallback
├── Bridge3DScene.tsx         # 场景组合：地板 + 控制台 + 主屏幕 + 星空 + 特效
├── BridgeFloor.tsx           # 圆形地板 + 霓虹网格 + 中央光环
├── CenterBeam.tsx            # 中央十字光柱（品红，旋转呼吸）
├── ConsoleStation.tsx        # 单个控制台：矮台 + 悬浮屏 + 图标标签
├── MainScreen.tsx            # 弧形主屏幕：星系数据面板
├── Starfield.tsx             # 背景星野（600 颗 sprite）
├── CameraRig.tsx             # 相机控制：拖动 / 捏合 / 聚焦动画
├── Effects.tsx               # 后处理：Bloom / 色差 / 扫描线 / 暗角
└── panels/
    ├── PanelShell.tsx        # 面板通用外壳（右侧滑入 + hd-panel 风格）
    ├── AlertsPanel.tsx       # 警报面板
    ├── TasksPanel.tsx        # 任务面板
    ├── ResourcesPanel.tsx    # 资源面板（9 类资源完整支持）
    ├── DiagnosePanel.tsx     # 诊断面板
    ├── MonitorPanel.tsx      # 监控面板
    └── ConfigPanel.tsx       # 配置面板
```

## 使用方式

### 进入 3D 舰桥
1. 切换到 Holodeck 主题（设置 → 全息）
2. 回到首页，自动进入 3D 舰桥
3. 首次加载会显示 "INITIALIZING BRIDGE..." loading

### 导航
- 顶部左侧：STARDECK · 时间显示
- 顶部右侧：🔊/🔇（音效）、2D VIEW（切换）、EXIT（退出）
- 右下角：状态灯（NOMINAL / CAUTION / RED ALERT）
- 底部：BridgeTicker 告警滚动

### 操作建议
1. 首次进入：单指拖动四周看看，感受环境
2. 点击控制台：选择感兴趣的模块（警报/任务/资源等）
3. 面板操作：所有 CRUD 都在面板内完成，复杂操作点「全屏 →」
4. 音效：默认开启，觉得吵可点 🔇 关闭
5. 性能问题：手机发热或卡顿点「2D VIEW」切回

## 限制与未来
- **当前**：6 个控制台面板已完成，所有 SRE 功能可在 3D 内完成
- **下一步**：
  - 库房场景：点击 RESOURCES 控制台切换到机架间，走进 Pod 行间浏览
  - 更多主屏幕：可切换到拓扑图 / 趋势图 / 告警热力图
  - 多人协作：多个 SRE 的光标同步显示在舰桥内
  - VR 支持：WebXR 适配，Quest 3 / Vision Pro 可戴头显进入

## 常见问题

**Q: 为什么我看到的是 2D 舰桥？**
A: 可能原因：
1. WebGL 不可用（iOS Safari 隐私模式禁用 WebGL）
2. 之前手动切到 2D VIEW（localStorage 记忆了），点顶部 "3D VIEW" 切回

**Q: 手机发热卡顿怎么办？**
A: 
1. 点顶部 "2D VIEW" 切回 2D 舰桥
2. 或者退出 Holodeck 主题，用默认模式

**Q: 音效太吵怎么关？**
A: 点顶部 🔊 图标切换到 🔇，会记忆你的选择

**Q: 能在桌面浏览器用吗？**
A: 可以，推荐 Chrome / Edge / Firefox，Safari 可能有兼容问题

**Q: 打包体积增加了多少？**
A: 主 bundle 增加 1KB，three.js 生态独立打包 244KB（gzip），懒加载不影响首屏

## License
MIT
