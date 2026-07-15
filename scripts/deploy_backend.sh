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
tar czf /tmp/mobile-ops-backend.tar.gz \
  --exclude='bin' --exclude='vendor' --exclude='.env' \
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
export GOPROXY=https://goproxy.cn,direct
go mod tidy
make build-local
ls -la bin/
REMOTE_EOF

echo "==> 完成"
