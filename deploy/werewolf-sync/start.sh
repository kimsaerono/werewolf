#!/bin/bash
# 狼人杀飞书同步桥接 - 启动脚本
# 用法: 修改下方环境变量后 ./start.sh  或  直接 source 后 nohup node server.cjs

export APP_ID="你的飞书App ID"
export APP_SECRET="你的飞书App Secret"
export SPREADSHEET_TOKEN="K1CFsF33mhOdMTtGuFRcvNrNn6e"
export RANK_SHEET_ID="2qBCmo"
export RECORD_SHEET_ID="1mQAkr"
export ACCESS_PASSWORD="请改成自己的强口令"
export PORT=3460

DIR="$(cd "$(dirname "$0")" && pwd)"
nohup node "$DIR/server.cjs" > "$DIR/log.txt" 2>&1 &
echo "桥接已启动, 日志: $DIR/log.txt, PID: $!"
