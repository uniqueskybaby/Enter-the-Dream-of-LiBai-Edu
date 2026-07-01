# 教育版验收矩阵

本文件用于对照 `docs/education-edition-development-brief.md` 检查教育版当前实现。所有路径均位于 `education-edition/`，不依赖原版运行时代码。

## 阶段验收

| 阶段 | 验收项 | 当前证据 |
| --- | --- | --- |
| 0 项目隔离 | 独立目录、独立 `package.json`、独立启动/构建/数据库 | `education-edition/package.json`、`server/config.mjs`、`storage/edu-libai.sqlite` |
| 1 内容模型 | 诗词、教材、知识点、素材、关系、Prompt、会话、限流和审计表 | `server/database.mjs` 中全部 `edu_*` 表 |
| 1 种子数据 | 16 首诗、1 个课程包、教育字段补齐 | `npm run seed -- --force` |
| 2 学生闭环 | 目录进入诗词、六步学习、作答、完成、报告、问诗人、笔记 | `npm run smoke:test` 学生流程 |
| 3 诗词星图 | 诗、作者、朝代、教材单元、主题、意象、地点、知识点节点 | `GET /api/edu/graph` |
| 4 教师工作台 | 创建班级、添加学生、布置任务、报告、单个学生记录 | `npm run smoke:test` 教师流程 |
| 5 内容后台 | 诗词/教材/知识点/意象/地点/题目/课程/素材/Prompt/审核/审计 | `/edu/admin/content/poems`、`/edu/admin/content/audit` 与 `/api/edu/admin/content/*` |
| 6 AI 与对话 | AI 草稿任务、服务端代理配置、限流、审计、人工审核后应用、Prompt 版本、对话安全 | `edu_ai_generation_jobs`、`edu_operation_audit_logs`、`edu_poet_system_prompts`、`npm run smoke:test` |
| 7 质量交付 | 构建、核心 API、学生/教师/后台 smoke、浏览器 UX 检查、README | `npm run check`、`artifacts/ux-checks/` |

## 样板内容底线

当前样板数据满足：

- 每首诗至少 5 道练习题。
- 每首诗至少 3 个知识点。
- 每首诗至少 3 条诗词关系。
- 每首诗至少 1 个素材资源。
- 每首诗都有独立诗人对话 Profile。
- 16 个诗人 System Prompt 互不相同。

可用以下命令复查：

```bash
node - <<'NODE'
import { eduConfig } from './server/config.mjs';
import { openEduDatabase, parseJson } from './server/database.mjs';
const db = openEduDatabase(eduConfig.dbPath);
const rows = db.prepare('select id,title,learning_objectives_json,motifs_json,places_json from edu_poems').all().map((p) => ({
  title: p.title,
  questions: db.prepare('select count(*) count from edu_questions where poem_id=?').get(p.id).count,
  relations: db.prepare('select count(*) count from edu_poem_relations where from_poem_id=?').get(p.id).count,
  assets: db.prepare("select count(*) count from edu_asset_usages where target_type='poem' and target_id=?").get(p.id).count,
  kps: db.prepare('select count(*) count from edu_poem_knowledge_links where poem_id=?').get(p.id).count,
  objectives: parseJson(p.learning_objectives_json, []).length,
}));
console.table(rows);
db.close();
NODE
```

## 手动体验路径

1. 打开 `http://127.0.0.1:4178/edu`。
2. 选择学生账号，进入教材目录，打开《望庐山瀑布》。
3. 进入六步学习，完成互动题，生成报告。
4. 在学习页或诗词页使用“问诗人”，保存一条回答到笔记。
5. 切换教师账号，创建班级，添加学生，布置诗词任务，查看学生报告。
6. 切换编辑账号，进入内容后台，创建诗词草稿、题目、素材、AI 草稿和 Prompt 版本。
7. 在内容审核中批准 Prompt，确认其状态进入已审核。
8. 在 AI 草稿页对草稿执行“发布/审核”，确认审核通过后才新增题目或内容版本。
9. 打开审计日志页，确认对话回答、AI 审核和后台发布都有记录。

## 自动验收

```bash
npm run check
```

该命令包含：

- `npm run build`：前端类型检查和生产构建。
- `npm run smoke:test`：权限、学生学习闭环、问诗人、教师、后台、AI 审核应用和审计日志。
- `npm run ux:check`：启动独立 UX 数据库，使用 Playwright 检查 9 个核心页面并保存桌面/移动端截图。
