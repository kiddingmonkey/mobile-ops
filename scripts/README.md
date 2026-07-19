# Mobile-Ops 部署脚本使用指南

## 📦 部署脚本对比

| 脚本 | 方式 | 速度 | 适用场景 |
|---|---|---|---|
| `deploy_backend_binary.sh` | 本地编译 → gzip 压缩 → 上传 → MD5 校验 | ⚡️ 快 | **推荐** - 日常部署 |
| `deploy_backend.sh` | 打包源码 → 上传 → 服务器编译 | 🐌 慢 | 服务器端编译（调试用） |
| `deploy_frontend_v2.sh` | 编译 → tar.gz 打包 → 上传解压 | ⚡️ 快 | **推荐** - 日常部署 |
| `deploy_frontend.sh` | 编译 → scp 数百个文件 | 🐌 慢 | 旧版本（易超时） |

## 🚀 快速部署（推荐）

### 后端部署

```bash
# 1. 设置密码环境变量
export SSHPASS='your_password'

# 2. 一键部署
./scripts/deploy_backend_binary.sh
```

**优势**：
- ✅ 本地编译（速度快，确保 Linux amd64）
- ✅ gzip 压缩传输（55MB → ~18MB）
- ✅ MD5 自动校验（防止传输损坏）
- ✅ 原子替换 + 自动备份
- ✅ 健康检查验证

### 前端部署

```bash
# 1. 设置密码环境变量
export SSHPASS='your_password'

# 2. 一键部署
./scripts/deploy_frontend_v2.sh
```

**优势**：
- ✅ tar.gz 传输（避免 scp 数百个小文件超时）
- ✅ 自动清除 macOS 元数据文件（._xxx）
- ✅ 同时生成 dist.zip（App OTA 更新）
- ✅ 自动备份旧版本

## 🛡️ 一键修复脚本

### 后端启动失败修复

**场景**：`systemctl status mobile-ops` 显示 `code=1/FAILURE` 或 `203/EXEC`

```bash
# 在服务器上执行
bash /path/to/fix_backend_crash.sh
```

**自动处理**：
- 清理 macOS AppleDouble 元数据垃圾（._xxx）
- 检查 binary 架构（ELF 64-bit）
- 检查 PostgreSQL 容器状态
- 重启服务 + 健康检查

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `SSHPASS` | 无 | SSH 密码（必需） |
| `REMOTE_HOST` | `10.211.79.100` | 服务器 IP |
| `REMOTE_USER` | `root` | SSH 用户名 |

## 🐛 常见问题

### 1. 后端部署后反复重启

**症状**：`journalctl` 日志显示 `migrate: execute ._001_init.sql: pq: invalid message format`

**原因**：macOS 生成的 AppleDouble 元数据文件混入 migrations 目录

**解决**：
```bash
# 服务器上执行
find /data2/haowu33/mobile/backend/migrations/ -name '._*' -delete
systemctl restart mobile-ops
```

### 2. 前端部署 scp 超时

**症状**：`deploy_frontend.sh` 卡在 `📤 [4/6] 上传 dist 目录到服务器...`

**原因**：scp 传输数百个小文件容易超时

**解决**：改用 `deploy_frontend_v2.sh`（tar.gz 方式）

### 3. 后端 502 Bad Gateway

**症状**：nginx 返回 502，App 提示"网络不通"

**原因**：后端服务未启动

**解决**：
```bash
systemctl status mobile-ops
journalctl -u mobile-ops -n 50
# 查看具体错误后针对性修复
```

## 📚 相关文档

- [Mobile-Ops 部署配置](~/.claude/projects/-Users-xiaojiahuo/memory/reference_mobile_ops_deployment.md)
- [macOS AppleDouble 陷阱](~/.claude/projects/-Users-xiaojiahuo/memory/mobile-ops-macos-appledouble-trap.md)
- [部署铁律](~/.claude/projects/-Users-xiaojiahuo/memory/mobile-ops-deploy-checklist.md)
