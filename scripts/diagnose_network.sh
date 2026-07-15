#!/bin/bash
# 网络诊断脚本 - 排查到 Cloudflare 的 2-3 秒延迟
# 使用：在 10.210.20.130 上执行 bash diagnose_network.sh

echo "==================================="
echo "1. 检查 HTTP 代理是否干扰"
echo "==================================="
env | grep -i proxy
echo ""

echo "==================================="
echo "2. 不带代理测 Cloudflare（延迟基线）"
echo "==================================="
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY
for i in 1 2 3; do
  echo "第 $i 次："
  curl -o /dev/null -s -w "DNS: %{time_namelookup}s | TLS: %{time_appconnect}s | TotalTime: %{time_total}s\n" https://www.cloudflare.com
done
echo ""

echo "==================================="
echo "3. 测 Cloudflare CDN 边缘节点（更接近实际 Tunnel 场景）"
echo "==================================="
for i in 1 2 3; do
  echo "第 $i 次："
  curl -o /dev/null -s -w "DNS: %{time_namelookup}s | TLS: %{time_appconnect}s | TotalTime: %{time_total}s\n" https://1.1.1.1
done
echo ""

echo "==================================="
echo "4. 测国内域名对比（判断是否 Cloudflare 特有问题）"
echo "==================================="
for domain in www.baidu.com www.aliyun.com; do
  echo "→ $domain"
  curl -o /dev/null -s -w "  TotalTime: %{time_total}s\n" https://$domain
done
echo ""

echo "==================================="
echo "5. traceroute 到 Cloudflare（看在哪一跳慢）"
echo "==================================="
which mtr >/dev/null 2>&1 && mtr -r -c 5 1.1.1.1 || traceroute -n -w 2 -q 1 1.1.1.1 | head -20
echo ""

echo "==================================="
echo "6. DNS 解析测试"
echo "==================================="
time nslookup www.cloudflare.com >/dev/null
echo ""

echo "==================================="
echo "诊断结束"
echo "==================================="
