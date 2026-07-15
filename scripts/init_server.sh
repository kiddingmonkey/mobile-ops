#!/bin/bash
# 一次性初始化服务器环境：装 PostgreSQL + 起 Docker Compose
# 用法: bash scripts/init_server.sh
set -e

REMOTE_HOST="10.211.79.100"
REMOTE_USER="root"
REMOTE_DIR="/data2/haowu33/mobile"

if [ -z "$SSHPASS" ]; then
    echo "请先 export SSHPASS='xxx'" >&2
    exit 1
fi

# 打包 docker-compose 和 systemd 配置
tar czf /tmp/mobile-ops-deploy.tar.gz -C "$(dirname "$0")/.." deploy

sshpass -e ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST \
  "mkdir -p $REMOTE_DIR"
sshpass -e scp -o StrictHostKeyChecking=no /tmp/mobile-ops-deploy.tar.gz \
  $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

sshpass -e ssh -o StrictHostKeyChecking=no $REMOTE_USER@$REMOTE_HOST bash <<REMOTE_EOF
set -e
cd $REMOTE_DIR
tar xzf mobile-ops-deploy.tar.gz
mkdir -p logs

# 起 PostgreSQL
cd deploy/docker-compose
docker compose -f postgres.yml up -d
sleep 8
docker ps | grep mobileops-pg
echo "==> PostgreSQL 启动完毕"
docker exec mobileops-pg pg_isready -U mobileops -d mobileops
REMOTE_EOF

echo "==> 服务器初始化完成"
