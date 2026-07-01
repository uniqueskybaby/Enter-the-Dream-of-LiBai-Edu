# 入梦李白教育版

教育版是独立于原版沉浸式体验主线的本地应用。它拥有自己的 `package.json`、前端路由、Node 服务、SQLite 数据库、种子脚本和静态资源副本。

## 本地命令

```bash
npm install
npm run seed
npm run build
npm run start
```

默认地址：

```text
http://127.0.0.1:4178/edu
```

开发时可以分别运行：

```bash
npm run dev:api
npm run dev
```

Vite 开发地址为 `http://127.0.0.1:5178/edu`，API 会代理到 `http://127.0.0.1:4178/api/edu`。

`npm run check` 会依次运行构建、API smoke test 和浏览器 UX 检查。UX 截图会写入 `artifacts/ux-checks/`。

## 隔离说明

- 教育版目录：`education-edition/`
- 教育版数据库：`education-edition/storage/edu-libai.sqlite`
- 教育版 API 前缀：`/api/edu`
- 教育版资源副本：`education-edition/public/assets`、`education-edition/public/data`
- 原版 `src/`、`server/`、`public/` 不作为运行时依赖。

## MVP 覆盖范围

- 学生端：首页、教材目录、诗词筛选、诗词详情、六步学习故事、5 类互动题、学习报告、错题、待复习、学习记录。
- 知识图谱：诗词、作者、朝代、教材单元、主题、意象、地点、知识点和诗词关系。
- 诗人对话：每首诗独立角色配置、Prompt 版本、背景事实、建议问题、对话记录、笔记保存、安全拉回。
- 教师端：班级、邀请码、添加学生、任务布置、完成率、题目正确率、错题排行、单个学生报告。
- 内容后台：诗词、教材、知识点、意象、地点、题目、课程、素材上传/绑定、诗人对话、建议问题、审核记录、AI 草稿任务、审计日志。
- 角色权限：演示登录会签发教育版本地 token，学生、教师、编辑/管理员接口分角色限制。
- AI 与对话：`edu_ai_generation_jobs` 队列表、服务端模型代理配置、限流、审计；生成内容默认要求人工审核，审核通过后才应用到诗库。

## 演示账号

教育版提供本地演示账号，不需要真实注册：

| 角色 | 账号 ID | 名称 |
| --- | --- | --- |
| 学生 | `student-demo` | 林小舟 |
| 教师 | `teacher-demo` | 沈老师 |
| 编辑 | `editor-demo` | 教研编辑 |
| 管理员 | `admin-demo` | 教育版管理员 |

页面顶部的“演示账号”选择框可以切换角色路径。服务端也提供：

```bash
curl -X POST http://127.0.0.1:4178/api/edu/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"role":"teacher"}'
```

教师端和内容后台 API 需要把返回的 `token` 作为 `Authorization: Bearer ...` 传入；前端会自动保存和携带。

## AI 配置

默认 `EDU_AI_PROVIDER=local`，使用本地可测试模板生成学习向回答和内容草稿。接入 OpenAI 兼容接口时，只在服务端 `.env` 配置：

```text
EDU_AI_PROVIDER=openai-compatible
EDU_AI_BASE_URL=https://api.openai.com/v1
EDU_AI_API_KEY=...
EDU_AI_MODEL=gpt-4.1-mini
```

模型密钥只在 Node 服务端读取，不会写入前端包。诗人对话和 AI 草稿生成都有分钟级限流，并写入 `edu_operation_audit_logs`。

## 数据导入

`npm run seed -- --force` 会重建教育版独立数据库，并从教育版自己的 `public/data/dreams_manifest.json` 和梦境 JSON 副本导入样板包。

导入结果要求：

- 16 首诗词。
- 1 个课程包。
- 每首诗 1 个学习故事。
- 每首诗 6 个学习步骤。
- 每首诗至少 5 道练习题。
- 每首诗至少 3 个知识点。
- 每首诗至少 3 条诗词关系。
- 每首诗至少 1 个素材资源。
- 每首诗 1 个独立诗人对话 Profile 和独立 Prompt。

## 验收

```bash
npm run check
```

或分别运行：

```bash
npm run build
npm run smoke:test
npm run ux:check
```

验收脚本会启动独立端口和独立测试数据库，验证：

- 学生登录、教材、诗词、六步课程、作答、完成记录、学习报告。
- 问诗人、保存笔记、安全拉回、Prompt 版本审核。
- 登录 token、角色权限、限流审计。
- 诗词星图、知识点节点、教材单元节点、意象过滤。
- 教师创建班级、添加学生、布置任务、查看班级报告和学生报告。
- 内容后台创建/发布/归档诗词，创建题目，上传素材，生成 AI 草稿，审核后应用到诗库。
- 主要前端路由返回可渲染页面，浏览器检查覆盖桌面和移动端截图。

详细验收矩阵见 [docs/acceptance-matrix.md](docs/acceptance-matrix.md)。
