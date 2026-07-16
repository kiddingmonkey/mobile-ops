# Mobile-Ops 部署手册

本机: **10.211.79.100**(内网) / **101.43.172.231**(公网)
公网入口: `https://101-43-172-231.nip.io:18443`

> 敏感值(密码/密钥/AK-SK)不在此文档,请从本地 `DEPLOYMENT.local.md`
> 或密码管理器读取。本文中的 `<PLACEHOLDER>` 请替换为真实值再执行。

---

## 1. 目录布局

```
/data2/haowu33/mobile/
├── backend/
│   ├── bin/mobile-ops              # 后端可执行文件
│   ├── config.yaml                 # chmod 600, 含 DB / JWT / 加密密钥
│   ├── migrations/*.sql
│   └── .env                        # 环境变量覆盖 (可选)
├── frontend/
│   └── dist/                       # Vite build 产物, nginx serve
├── deploy/
│   ├── docker-compose/postgres.yml
│   └── nginx/mobile-ops.conf
└── logs/
    ├── backend.log
    └── backend.err
```

系统级:
- systemd unit: `/etc/systemd/system/mobile-ops.service`
- nginx conf: `/etc/nginx/conf.d/mobile-ops.conf`

## 2. 组件

| 组件 | 端口 | 说明 |
|------|------|------|
| PostgreSQL (`mobileops-postgres`) | `5432` | postgres:14-alpine, DB=mobileops, USER=mobileops |
| Go 后端 (`mobile-ops`) | `8090` | 内网监听,不对公网暴露 |
| nginx | `443` / `18443` | 反代前端 + `/api/v1/*` |

## 3. 首次部署

### 3.1 数据库

```bash
cd /data2/haowu33/mobile/deploy/docker-compose
docker compose -f postgres.yml up -d
docker exec mobileops-postgres pg_isready -U mobileops   # 确认 accept
```

`postgres.yml` 里 `POSTGRES_PASSWORD` 是权威源,必须与 `backend/config.yaml`
里的 `database.password` 保持一致。

### 3.2 后端配置

```yaml
# backend/config.yaml (chmod 600)
server:
  host: "0.0.0.0"
  port: 8090
database:
  host: "127.0.0.1"
  port: 5432
  user: "mobileops"
  password: "<POSTGRES_PASSWORD>"      # 见 DEPLOYMENT.local.md
  dbname: "mobileops"
security:
  encryption_key: "<32-BYTE-KEY>"      # 32 字节,见 DEPLOYMENT.local.md
  jwt_secret: "<JWT-SECRET>"           # 见 DEPLOYMENT.local.md
  jwt_ttl_hours: 12
```

### 3.3 初始化 admin

```bash
cd /data2/haowu33/mobile/backend
./bin/mobile-ops --config config.yaml \
  --init-admin --admin-user admin --admin-pass '<ADMIN_PASSWORD>'
```

看到 `Admin user "admin" created/updated.` 即成功。此命令走 `ON CONFLICT
DO UPDATE SET password_hash` upsert,反复执行不会破坏其他数据。

### 3.4 systemd 拉起

```bash
systemctl daemon-reload
systemctl enable --now mobile-ops
systemctl status mobile-ops
```

### 3.5 nginx

`/etc/nginx/conf.d/mobile-ops.conf` 反代 `/api/v1/*` → `127.0.0.1:8090`,
根路径 serve `/data2/haowu33/mobile/frontend/dist/`。

## 4. 常用运维

```bash
# 服务
systemctl {status,restart,stop,start} mobile-ops
journalctl -u mobile-ops -f
tail -f /data2/haowu33/mobile/logs/backend.log

# DB
docker exec -it mobileops-postgres psql -U mobileops -d mobileops
docker inspect mobileops-postgres --format \
  '{{range .Config.Env}}{{println .}}{{end}}' | grep POSTGRES_PASSWORD

# 冒烟测试 (服务器本机,绕 nginx)
curl -s -X POST http://127.0.0.1:8090/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'

# 冒烟测试 (公网,需先在腾讯云控制台放开安全组来源 IP)
curl -sk -X POST https://101-43-172-231.nip.io:18443/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"<ADMIN_PASSWORD>"}'
```

## 5. 前端 / APK

前端 build 会把 `.env.production` 里的 `VITE_API_BASE` 嵌入产物:

```
VITE_API_BASE=https://101-43-172-231.nip.io:18443/api/v1
```

**APK 加载本地 dist**,不再依赖服务器 URL:即使后端 500 / 安全组关闭,
APK 仍能进登录页,并在顶部横幅提示 "后端不可达"。

- 前端更新: `cd frontend && npm run build` → 上传 `dist/` 到
  `/data2/haowu33/mobile/frontend/dist/`
- APK 打包: 推 main 触发 GitHub Actions `build-android.yml`,产物为
  Debug APK,直接在 Actions Artifacts 下载

## 6. 故障排查

| 现象 | 定位 | 处置 |
|------|------|------|
| `db connect: connection refused` | pg 容器停了 | `docker start mobileops-postgres` |
| `password authentication failed` | config 与容器密码不一致 | 以容器 `POSTGRES_PASSWORD` env 为准同步 config |
| `bind: address already in use (8090)` | 残留手起进程占端口 | `ss -tlnp \| grep 8090` 找 pid → `kill <pid>` → `systemctl start mobile-ops` |
| systemd 疯狂重启无日志 | stdout 被吞 | 手跑 `./bin/mobile-ops --config=./config.yaml` 看真错 |
| APK 打开显示 nginx 500 | 老 APK 里 `server.url` 直接加载远程 | 用新版 APK(本地 dist 加载) |
| APK 顶部红条 "后端不可达" | 安全组挡了当前 IP | 在腾讯云 VPC 安全组把当前手机公网 IP 加白 |

## 7. 安全 & 秘钥管理

- `backend/config.yaml`:`chmod 600`
- `backend/.env`:`chmod 600`
- pg `POSTGRES_PASSWORD`:走 docker-compose 或 secret,不落 git
- JWT/加密密钥:32 字节,首次生成后不再变(变则所有历史加密数据不可解密)
- **明文密码只在本地 `DEPLOYMENT.local.md`**,该文件由 `.gitignore` 兜住

## 8. 参考

- 后端源码:`backend/internal/`
- 前端源码:`frontend/src/`
- APK 打包 workflow:`.github/workflows/build-android.yml`
