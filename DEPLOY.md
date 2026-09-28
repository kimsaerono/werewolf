# 部署与回退手册

## 部署机制

- 推送 `main` / `master` 分支 → GitHub Actions（`.github/workflows/main.yml`）自动 `bun install && bun run build` → 部署到 GitHub Pages
- Pages 地址：`https://kimsaerono.github.io/werewolf/`
- workflow 已开启 `workflow_dispatch`（手动触发，可指定任意 ref）

## 稳定版锚点

| Tag | 含义 | 对应提交 |
|---|---|---|
| `stable-v1.0` | 角色架构改造前的线上稳定基线（129 测试全绿、CI 成功） | `5f744ce` |

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
