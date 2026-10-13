# 部署与回退手册

## 部署机制

- 推送 `main` / `master` 分支 → GitHub Actions（`.github/workflows/main.yml`）自动 `bun install && bun run build` → 部署到 GitHub Pages
- Pages 地址：`https://kimsaerono.github.io/werewolf/`
- workflow 已开启 `workflow_dispatch`（手动触发，可指定任意 ref）

## 稳定版锚点

| Tag | 含义 | 对应提交 |
|---|---|---|
| `stable-v1.0` | 角色架构改造前的线上稳定基线（129 测试全绿、CI 成功） | `5f744ce` |
| `stable-v1.2` | 版本管理（本地切换/自动重启）+ 夜间步骤回归修复 | `3e0d834` |
| `stable-v1.3` | 版本徽标优雅降级 + CI 拉全量 tag（线上版本号显示修复） | `edb8067` |
| `stable-v1.4` | CI 打 tag 自动部署锚点 + 文档 | `fc0287d` |
| `stable-v1.5` | 狼王枪/白狼王自爆计分调整 + 文案同步 | `de833c4` |

> **线上版本号**由构建时的 `git describe --tags` 注入（`vite.config.ts` 的 `__APP_VERSION__`）。
> 所以「部署时能否看到某 tag」取决于**构建那一刻该 tag 是否已存在**，以及 CI 是否拉了 tag（workflow 已设 `fetch-depth: 0`）。
> GitHub Pages 为静态托管，无本地服务，故页面上的版本切换器会降级为**只读徽标**；切换版本需在本地 `bun run dev` 使用。

### ⚠️ 发版顺序（重要）

**先打 tag，再和分支一起 push**，确保 main 触发的那次构建能看见新 tag：

```
git tag stable-vX.Y
git push origin main stable-vX.Y   # 一次推送，tag 与提交同时到达
```

> **为什么不能先推 main 再单独推 tag**：GitHub Pages 对**同一个 commit（SHA）的重复部署不会覆盖**。
> 先推 main 时构建看不到新 tag（版本号还是旧 tag）；随后单独推 tag 触发的部署因 SHA 相同被 Pages 忽略，
> 线上版本号就会停留在旧 tag。v1.5 发版即踩到此坑。若已踩坑，补一个 main 提交（新 SHA）重新部署即可。

## 紧急回退流程（3 步）

1. 打开仓库 → **Actions** → **Deploy Pages** 工作流
2. **Run workflow** → Ref 下拉框选择 tag `stable-v1.0`（或输入分支/tag 名）→ 运行
3. 构建完成后 Pages 原子替换为旧版构建，即完成回退

> 本地命令行等价操作：`git push origin :refs/heads/main` 后从 tag 建分支推送，或直接在 UI 触发即可，无需本地构建。

## 回退期间注意事项

- **冻结 main**：回退只替换了线上产物，main 分支仍是新代码。若此时任何人 push main，会自动把新版重新部署上去。因此回退后要么暂停合码排查，要么先 `git revert` 问题提交再推。
- 回退是"整站原子替换"，不存在新旧文件混布问题。

## 数据安全（存储键隔离）

| 版本 | 游戏存档键 | 历史记录键 |
|---|---|---|
| 线上稳定版 (stable-v1.0) | `werewolf_judge_v8` | `werewolf_history` |
| 重构版（本仓库 main） | `werewolf_judge_v9` | `werewolf_history_v2` |

- 两版各自读写独立键，互不覆盖；重构版首次打开时对旧键做**一次性只读迁移**
- 因此**任意时刻回退线上版本，法官打开即是稳定版最后现场，数据零损失**
- 代价：在重构版上进行的对局，回退后不可见（切版前请打完当前局）
