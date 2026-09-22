# 狼人杀 → 飞书表格 同步桥接（部署到 192.168.5.227）

把 GitHub Pages 的 H5 每局结算数据，经公司内网服务器 nginx 反代，写入飞书表格。

## 架构

```
手机H5(GitHub Pages, https)
   → https://hymallbosstest.heemoney.com/werewolf-sync/api/sync
      → nginx(5.227) 反代
         → http://127.0.0.1:3460 (本服务, Node14)
            → 飞书 OpenAPI → 飞书表格
```

- 全程 https，无混合内容/CORS 问题，群友任何网络可用
- 服务用飞书应用凭证（appId/appSecret）换 token，无需本机 lark-cli
- 请求带 `x-access-password` 口令，无口令 401

## 文件清单

| 文件 | 说明 |
|---|---|
| `server.cjs` | 桥接服务（纯 Node，无外部依赖，兼容 Node 14） |
| `record-block.cjs` | 复盘卡片区块构建器（server.cjs 依赖，需一起上传） |
| `nginx-werewolf-sync.conf` | nginx 反代配置片段 |
| `start.sh` | 启动脚本（含环境变量） |

> 实际部署目录：`/data/www/s2b/website/werewolf-sync`（重启用同目录 `run.sh`）

---

## 部署步骤

### 1. 上传代码到服务器

把 `server.cjs` 和 `record-block.cjs` 放到服务器（实际目录 `/data/www/s2b/website/werewolf-sync/`）：

```bash
scp server.cjs record-block.cjs root@192.168.5.227:/data/www/s2b/website/werewolf-sync/
```

### 2. 配置环境变量（修改 start.sh 或 export）

```bash
export APP_ID="你的飞书App ID"
export APP_SECRET="你的飞书App Secret"
export SPREADSHEET_TOKEN="K1CFsF33mhOdMTtGuFRcvNrNn6e"
export RANK_SHEET_ID="2qBCmo"
export RECORD_SHEET_ID="1mQAkr"
export ACCESS_PASSWORD="自定义同步口令"
export PORT=3460
node /data/werewolf-sync/server.cjs
```

> **飞书应用前置**（一次性）：
> 1. open.feishu.cn 创建企业自建应用，开通 `sheets:spreadsheet` 权限，发布
> 2. 把表格 `K1CFsF33mhOdMTtGuFRcvNrNn6e` 添加该应用为「可编辑」协作者
> 3. 拿到 App ID / App Secret

### 3. 用 nohup 常驻启动（或 systemd/pm2）

```bash
nohup node /data/werewolf-sync/server.cjs > /data/werewolf-sync/log.txt 2>&1 &
```

验证：`curl http://127.0.0.1:3460/api/health` → `{"ok":true}`

### 4. 配置 nginx 反代

把 `nginx-werewolf-sync.conf` 内容加进 `/data/nginx/conf/` 下（作为独立 conf 文件 include，或直接并入 server 块）：

```nginx
location /werewolf-sync/ {
    proxy_pass http://127.0.0.1:3460/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

然后 `nginx -s reload`。

> 注意：本仓库 `nginx.conf` 用的是 `include /data/nginx/conf/s2b.conf;` 这类独立文件方式，
> 建议把该 location 加入对应 server 块（80/443 的 `hymallbosstest.heemoney.com` server）。

### 5. 前端配置

在项目 `.env` 写入（不提交到 GitHub）：

```
VITE_SYNC_URL=https://hymallbosstest.heemoney.com/werewolf-sync
```

重新 `bun run build` 并推送到 GitHub Pages。

前端自动同步 + 「复盘导出」页有「手动同步最近一局」按钮。

---

## 接口

| 路径 | 方法 | 说明 |
|---|---|---|
| `/api/sync` | POST | 接收本局数据，复盘表写卡片区块（标题/信息/积分/逐行日志）+ 更新排名（带 `x-access-password`） |
| `/api/health` | GET | 健康检查 |

## 复盘表格式

「每局复盘记录」每局一个卡片区块（构建逻辑见 `record-block.cjs`，与本地桥接 `server/recordBlock.ts` 保持一致）：

- 标题行：A 列局次 gameId（幂等去重依据），B:N 合并显示板子/胜负/法官，深蓝底白字
- 信息行：B:N 合并，时间 + MVP/SVP/背锅侠（空项省略）
- 积分行：B:N 合并，每人 `号码.昵称(身份) ±分值`
- 日志区：B 列逐行编号，灰字小号
- 末尾空行分隔；合并/样式/行高为装饰性写入，失败只告警不影响数据

## 常见问题

- **401 unauthorized**：`x-access-password` 与 `ACCESS_PASSWORD` 不一致
- **写失败**：飞书应用未添加为表格协作者，或未开通 `sheets:spreadsheet`
- **前端连不上**：确认 nginx 反代已生效，`curl https://hymallbosstest.heemoney.com/werewolf-sync/api/health`
