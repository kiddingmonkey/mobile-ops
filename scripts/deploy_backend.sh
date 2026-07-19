#!/bin/bash
# 打包后端并推送到服务器
# 用法: bash scripts/deploy_backend.sh
set -e

REMOTE_HOST="10.211.79.100"
REMOTE_USER="root"
REMOTE_DIR="/data2/haowu33/mobile"

echo "==> 检查密码环境变量"
if [ -z "$SSHPASS" ]; then
    echo "请先 export SSHPASS='xxx'" >&2
    exit 1
fi

echo "==> 打包后端源码"
cd "$(dirname "$0")/../backend"
# COPYFILE_DISABLE 阻止 macOS tar 生成 ._xxx AppleDouble 元数据文件
# 之前踩过坑：._001_init.sql 混进 migrations 目录导致后端启动崩溃 (pq: invalid message format)
COPYFILE_DISABLE=1 tar czf /tmp/mobile-ops-backend.tar.gz \
  --exclude='bin' --exclude='vendor' --exclude='.env' \
  --exclude='._*' --exclude='.DS_Store' \
  cmd internal migrations config.example.yaml go.mod Makefile

echo "==> 上传到 $REMOTE_HOST"
sshpass -e ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST \
  "mkdir -p $REMOTE_DIR/backend $REMOTE_DIR/logs"
sshpass -e scp -o StrictHostKeyChecking=no /tmp/mobile-ops-backend.tar.gz \
  $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo "==> 远程解压 + tidy + build"
sshpass -e ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST bash <<REMOTE_EOF
set -e
cd $REMOTE_DIR/backend
tar xzf ../mobile-ops-backend.tar.gz
# 双保险：即使有 ._xxx 漏网也清掉
find . -name '._*' -delete
find . -name '.DS_Store' -delete
export GOPROXY=https://goproxy.cn,direct
go mod tidy
make build-local
ls -la bin/
REMOTE_EOF

echo "==> 完成"
