# 有据 · 可追溯科研工作台（ResearchTrace）

让每一句科研结论都有据可查。

以本目录为站点项目：`web/` 是前端静态文件，`functions/` 是服务端 Edge Function，`dev/` 是本地预览与无凭据夹具（不进入发布包），`schema.sql` 是数据库迁移脚本。

## 功能

- 课题总览、文献库、研究设计、实验与数据、对照与证据、结论核对、论文写作、科研日志八个模块。
- 数据按登录账号保存在服务端数据库：加载、保存中、已保存、保存失败重试、多页冲突重新加载、未登录引导均有对应界面状态。
- 免登录演示：首页「免登录体验」进入独立样例课题，导入 CSV、核对结论、查看证据均由服务端匿名接口执行；演示数据只保存在本浏览器独立键，不进入任何账号。
- 旧数据迁移：云端工作区为空时，先展示待迁移课题与目标账号，由用户确认后才上传，成功后才提示并清除旧键。
- CSV 导入由服务端重新校验、去重并原子写入，保存成功后才提示「已导入」，重复提交同一份 CSV 不新增记录；缺少必填字段的运行记录会被拒绝。
- 「结论核对」由服务端基于已保存的运行记录执行配对规则，返回支持/反例/证据不足及对应的 CSV 行号、随机种子与配置。
- 「备份课题」导出的 version 1 JSON 可直接导入；对照页可把当前结果或已存证据导出为 Markdown 复现记录。
- 深色/浅色主题仍保存在当前浏览器（设备级偏好）。

## 文件说明

- `web/index.html` 定义页面骨架和表单容器。
- `web/assets/app.css` 包含设计色、字体、图表和响应式样式；`--site-*` 变量供 Qoder 设计工作台调节外观、圆角、间距、字号与动效。
- `web/js/data.js` 包含项目结构、演示数据、CSV 解析、实验配对、导出及基于 `/functions/v1/app/api/state` 的 `projectStore`。
- `web/js/view.js` 渲染各工作区，并实现云端同步状态机（防抖保存、版本冲突、失败重试、启动加载/登录/迁移/错误画面）。
- `web/js/actions.js` 处理编辑、导入导出和页面操作。
- `web/js/marked.umd.js` 用于本地 Markdown 排版预览，许可证见 `web/LICENSE-marked.md`。
- `functions/core.mjs` 是服务端权威业务规则（校验、CSV 解析、配对、结论判定），浏览器预览镜像同一套规则。
- `functions/index.ts` 是部署入口（Deno.serve + 平台注入的 `_qoder/backend.mjs`）。
- `functions/routes.mjs` 实现业务路由：匿名 `GET /api/health`、`POST /api/demo/import`、`POST /api/demo/verify`；登录用户 `GET /api/state`、`PUT /api/state`（按 `owner_id` 隔离，整态版本化写入）、`POST /api/import`（原子合并）、`POST /api/verify`（基于已保存记录）。
- `schema.sql` 创建 `app.workspaces`（owner_id 主键、state jsonb、version 整数）。

## 本地预览与检查

无需安装依赖。使用任意 Node 运行时（本机可用 Qoder 自带 Electron 以 `ELECTRON_RUN_AS_NODE=1` 方式运行）：

```bash
node dev/server.mjs 8787        # 静态预览 + 真实路由 + 内存夹具数据（固定本地用户）
node dev/check-routes.mjs       # 27 项无凭据路由检查
```

本地夹具开关（仅开发用）：`/__local/fail-on|fail-off` 模拟服务故障，`/__local/anon-on|anon-off` 模拟未登录。夹具数据不证明云端隔离；部署后需以真实账号验证。

## 服务端契约

状态结构为 `{ version: 1, active: string, projects: Project[] }`。`PUT /api/state` 携带 `{ state, version }`：version 0 表示首次创建，之后按当前版本条件更新并自增；版本不匹配返回 409 `write_conflict`，前端提示备份后重新加载。身份来自平台注入的 `x-qoder-user-context`，浏览器不提供 owner 字段。请求体上限 4 MB，序列化状态上限 3.5 MB，单份 CSV 上限 2 MB，运行记录上限 20000 条。