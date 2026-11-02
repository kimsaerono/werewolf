# 狼人杀全自动计分法官

一款为线下狼人杀活动设计的**全自动计分与对局助手**：报名、发牌、夜间流程引导、自动计分、
结算复盘与荣誉评定一站式完成，支持多种板子与 20+ 角色机制。

- 线上地址：<https://kimsaerono.github.io/werewolf/>
- 部署与回退手册见 [`DEPLOY.md`](./DEPLOY.md)

## 功能特性

- **报名与发牌**：群成员一键入座、法官指定、多种板子（预置 12 套）与自由配置角色池
- **自动计分**：阵营胜负、基础分/技能分自动计算，MVP / SVP / 背锅侠荣誉评定
- **夜间流程引导**：分步指引预言家、女巫、守卫、猎人等 20+ 角色的夜间行动，逐步播报
- **胜负判定**：屠边/屠城规则，胜利条件自动检测
- **对局记录**：历史战绩本地留存，支持飞书表格同步归档（本地桥接，可选）
- **版本管理**：多版本稳定锚点，本地可切换回退
- **体验细节**：夜晚背景音乐、语音播报、主题切换、全屏过场

## 技术栈

Vue 3 · TypeScript · Ant Design Vue · Vite · Hono（本地同步桥接）· Bun · Playwright（E2E）

## 快速开始

```bash
bun install
bun run dev        # 启动本地开发（server + web 并发）
bun test           # 运行单元测试
bun run build      # 类型检查 + 生产构建
```

## 部署

推送 `stable-v*` tag 即触发 GitHub Actions 自动构建并发布到 GitHub Pages，
具体流程、版本锚点与回退步骤见 [`DEPLOY.md`](./DEPLOY.md)。

## 数据说明

- 默认**纯本地运行**：对局存档、历史记录与偏好仅保存在浏览器 localStorage，不上传服务器
- 成员名单**默认从本地缓存读取**：点「🔄 同步成员」从飞书群拉取最新成员并写入本地缓存（`werewolf_members_cache`），下次打开直接使用
- 可选**飞书表格同步**：经本机桥接（localhost:3457，lark-cli）将对局记录归档到自有飞书表格，
  需自行配置 `VITE_SYNC_URL` 并输入同步口令
- 详情见 [`PRIVACY.md`](./PRIVACY.md)

## 法律声明

- [隐私政策 `PRIVACY.md`](./PRIVACY.md)
- [用户协议与服务条款 `TERMS.md`](./TERMS.md)
- [版权说明 `COPYRIGHT.md`](./COPYRIGHT.md)

> **版权保留**：本仓库**未提供任何开源许可证（LICENSE）**，全部源码与原创素材
> **保留所有权利（All Rights Reserved）**，仅供个人学习与活动计分使用；
> 未经书面授权，请勿复制、再分发或用于商业项目。第三方素材（背景音乐等）权利归各自权利人。
> 详见 [`COPYRIGHT.md`](./COPYRIGHT.md)。

## 测试

```bash
bun test
```

包含单元测试（计分逻辑、角色机制、胜负判定、版本同步等）与 Playwright E2E。
