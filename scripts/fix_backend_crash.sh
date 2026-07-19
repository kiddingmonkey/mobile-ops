#!/bin/bash
# Mobile-Ops 后端崩溃一键修复脚本
# 场景：systemctl status 显示 code=1/FAILURE 或 203/EXEC，服务反复重启
# 用法：直接在服务器上执行 bash fix_backend_crash.sh

set -e
BACKEND_DIR="/data2/haowu33/mobile/backend"

echo "===== [1/5] 清除 macOS AppleDouble 元数据垃圾文件 ====="
FOUND=$(find $BACKEND_DIR/migrations -name '._*' -o -name '.DS_Store' | wc -l)
echo "发现 $FOUND 个垃圾文件"
find $BACKEND_DIR/migrations -name '._*' -delete
find $BACKEND_DIR/migrations -name '.DS_Store' -delete
echo "清理完成，migrations 目录当前内容："
ls -la $BACKEND_DIR/migrations/

echo ""
echo "===== [2/5] 检查 binary 架构 ====="
file $BACKEND_DIR/bin/mobile-ops || echo "binary 不存在！"
chmod +x $BACKEND_DIR/bin/mobile-ops 2>/dev/null || true

echo ""
echo "===== [3/5] 检查 PostgreSQL 容器 ====="
if docker ps --filter name=mobileops-postgres --format '{{.Names}}' | grep -q mobileops-postgres; then
    echo "✅ mobileops-postgres 容器正在运行"
else
    echo "❌ mobileops-postgres 容器不在运行，尝试启动..."
    cd /data2/haowu33/mobile/deploy/docker-compose && docker compose -f postgres.yml up -d
fi

echo ""
echo "===== [4/5] 重启 mobile-ops 服务 ====="
systemctl reset-failed mobile-ops
systemctl restart mobile-ops
sleep 3

echo ""
echo "===== [5/5] 验证 ====="
systemctl status mobile-ops --no-pager | head -20
echo ""
if curl -sf http://127.0.0.1:8090/api/v1/health > /dev/null; then
    echo "✅ 后端 API 健康：http://127.0.0.1:8090/api/v1/health"
else
    echo "❌ 后端仍未响应，查看错误日志："
    tail -30 /data2/haowu33/mobile/logs/backend.err
fi
