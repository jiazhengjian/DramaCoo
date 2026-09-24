# DramaCoo DramaCoo 产品需求文档（PRD）

> 本文档由现有代码仓库反向推导整理，用于沉淀产品定位、功能范围与交互规则。
> 版本：v1.0（反推稿）｜状态：草案｜适用对象：产品 / 研发 / 测试

---

## 1. 产品概述

### 1.1 背景

短视频与短剧内容创作门槛高、链路长：从灵感 → 剧本 → 角色 → 分镜 → 画面 → 视频 → 成片，传统流程需要编剧、画师、分镜师、剪辑师等多角色协作，成本高、周期长。单点式"文生视频"工具只能产出片段，无法覆盖完整生产链路，且中间产物不可控、不可改、不可复用。

### 1.2 产品定位

**DramaCoo（DramaCoo）** 是一个面向短视频 / 短剧创作的 **本地化 AI 导演系统**。用户只需输入一句创意、一段梗概或一个模糊概念，系统即可将其拆解为一条可执行的影视生产流水线，持续产出**可查看、可确认、可修改、可继续生成**的中间资产，最终交付完整成片。

它不是单点式"文生视频"黑盒，而是一条覆盖全流程的生产线：

```
剧本策划 → 角色/场景设计 → 分镜规划 → 参考图生成 → 视频生成 → 后期剪辑
```

每个阶段由专职 Agent 负责，前一阶段产物决定后一阶段输入；所有关键节点可视化、可编辑、可修改后继续生成，形态更接近"可协作的 AI 导演团队"。

### 1.3 产品价值

| 维度 | 价值 |
| --- | --- |
| 🎬 全流程 | 一条链路打通剧本、角色、分镜、参考图、视频片段与后期剪辑，升级为完整视频生产工作流 |
| 🖼️ 可控 | 分镜驱动创作，保证角色一致性、镜头表达与画面风格稳定 |
| ✍️ 可迭代 | 支持剧情/分镜续写，角色/参考图/视频修改后重新生成，避免每次从头再来 |
| 🧩 可插拔 | LLM / VLM / 图像 / 视频各环节均可在多家服务商间切换 |
| 📲 本地化 | 后端 + Web 前端本地运行，全链路产物留存，数据不出本机 |

### 1.4 目标用户

- **短视频 / 短剧创作者**：需要快速产出多集剧情化短剧或口播/图文视频。
- **自媒体 / MCN**：批量产出文艺短视频、商品口播、动作迁移类素材。
- **AI 工具爱好者 / 独立开发者**：本地部署、可自由切换底层模型、可二次开发。
- **内容工作室**：需要"人机协作"式创作，对中间产物有确认与修改诉求。

### 1.5 差异化

- 相比单点文生视频工具：提供**多阶段编排 + 停点确认 + 可介入修改**的生产线。
- 相比云端 SaaS：**本地部署、产物留存、模型可插拔**，敏感创意与素材不出本机。
- 相比纯自动流水线：每个阶段产物都可**人工确认、修改、续写**后再继续。

---

## 2. 产品目标与成功指标

### 2.1 产品目标

1. 让非专业用户通过"一句话创意"即可完成一部结构完整的短剧/短视频。
2. 将创作流程标准化为 6 个可确认、可修改的阶段，降低返工成本。
3. 通过多模型可插拔，避免被单一供应商锁定。
4. 本地部署，保证创作数据与产物归属用户。

### 2.2 成功指标（建议）

- 从创建项目到产出成片的**端到端成功率**。
- 单项目从创意到成片的**平均耗时**与**阶段停留次数**。
- **阶段修改率**（各阶段发生用户介入/修改的比例）——反映可控性价值。
- **续写使用率**（完成成片后继续智能续写的比例）——反映留存。
- 模型切换覆盖的**供应商数量**与**可用模型数量**。

---

## 3. 产品范围

### 3.1 在范围内

- 六阶段主流程（剧本 → 角色/场景 → 分镜 → 参考图 → 视频 → 后期）。
- 三种视频生成方式（首帧 / 首尾帧 / 参考图生视频）。
- 临时工作台 Sandbox（LLM / VLM / 文生图 / 图生图 / 视频）。
- 三种一次性 Pipeline（文艺短视频 / 动作迁移 / 数字人口播）。
- 系统配置管理（API Key、模型选择、生成参数、代理、日志）。
- 会话与产物管理、文件上传、模型能力发现。

### 3.2 不在范围内（当前版本）

- 多用户账号体系、云端同步、协作权限管理。
- 原生移动端 App。
- 计费 / 订阅体系（成本由用户自有 API Key 承担）。
- 角色级 Agent 互评、跨镜头连贯性审查、并发分镜（见路线图）。

---

## 4. 名词术语

| 术语 | 含义 |
| --- | --- |
| Session / 会话 | 一次项目创作的上下文单元，`session_id` 为唯一标识（毫秒级时间戳/uuid） |
| Stage / 阶段 | 工作流中的一个步骤，共 6 个（+ init/completed） |
| Agent | 负责某一阶段的专职处理单元 |
| Artifact / 产物 | 某阶段生成并落盘的中间结果（剧本、角色图、分镜、参考图、视频片段等） |
| 停点 | 阶段完成后需用户确认才能继续的位置 |
| Intervention / 介入 | 用户在阶段产物上做修改后触发的重新执行 |
| Sandbox / 临时工作台 | 独立于主流程的单次能力调用（单发 LLM/VLM/图像/视频） |
| Pipeline | 一次性短流程任务，一次输入后台执行、中间无需人工介入 |
| Task | Pipeline 任务的元数据与产物单元 |
| Provider | 模型服务商（DashScope / ARK / Kling / OpenAI / Gemini / DeepSeek） |

---

## 5. 用户画像与典型场景

### 5.1 用户画像

- **P1 短剧创作者**：输入一句"重生之我在古代当厨神"，期望得到多集剧本 + 角色设定 + 分镜 + 成片。
- **P2 口播带货者**：上传人像图 + 商品图 + 文案，期望生成数字人口播带货视频。
- **P3 图文/文艺号运营**：输入一段旁白，期望生成配图文艺短视频。
- **P4 工具型用户**：临时做一张图、分析一张图、问 LLM 一个问题。

### 5.2 典型场景

1. **一句话成片**：输入创意 → 逐阶段确认 → 得到完整短剧成片。
2. **修改重生成**：对某一集剧本不满意 → 修改 → 重新生成后续依赖阶段。
3. **续写剧情**：成片后想继续推进故事 → 智能续写 → 生成新片段。
4. **文艺短视频**：输入旁白文案 → 自动分段 → 配图/配视频 → 合成 + 配音 + 字幕。
5. **动作迁移**：上传人物图 + 参考视频 → 将动作迁移到人物上。
6. **数字人口播**：上传人像图 + 商品信息 → 生成口播带货视频。
7. **临时取用**：单发文生图 / 图生图 / 图片分析 / 视频生成。

---

## 6. 产品架构概览

```
┌─────────────┐     ┌──────────────────────────────────────────────┐
│  Web 前端    │────▶│  Orchestrator（6 阶段状态机 / 会话持久化）        │
│ (Next.js)   │◀────│   ├─ ScriptWriterAgent      剧本策划             │
└─────────────┘     │   ├─ CharacterDesignerAgent 角色/场景设计        │
                    │   ├─ StoryboardAgent        分镜规划             │
┌─────────────┐     │   ├─ ReferenceGeneratorAgent 参考图生成          │
│  模型服务层   │◀────│   ├─ VideoDirectorAgent      视频生成            │
│ LLM/VLM/图/视│     │   └─ VideoEditorAgent        后期剪辑            │
└─────────────┘     └──────────────────────────────────────────────┘
```

- **前端**：Next.js + React，提供创作工作台、阶段确认、参数配置与产物预览。
- **后端**：Python + FastAPI，`orchestrator.py` 管理 6 阶段状态机与会话状态，`*_agent.py` 实现单阶段逻辑，`models/` 封装各服务商客户端。
- **Pipelines**：`pipelines/` 实现一次性短流程，后台任务执行 + SSE 进度推送。
- **本地端口**：后端 `http://localhost:8000`，前端 `http://localhost:3000`。

---

## 7. 核心功能需求

### 7.1 六阶段主流程

主流程由 Orchestrator 驱动状态机，按固定顺序调度 6 个专职 Agent。每个 Agent 完成后落盘产物并进入停点，等待用户确认。

**阶段顺序**：

| 顺序 | 阶段 | stage 值 | 职责 |
| --- | --- | --- | --- |
| 1 | 剧本生成 | `script_generation` | 将灵感/梗概/上传文档转化为结构化分集剧本 |
| 2 | 角色/场景设计 | `character_design` | 生成角色设计图与场景背景图 |
| 3 | 分镜设计 | `storyboard` | 将剧本拆分为带时长标签的镜头脚本 |
| 4 | 参考图生成 | `reference_generation` | 为每个镜头生成高精度首帧/参考图 |
| 5 | 视频生成 | `video_generation` | 将参考图/分镜图生成视频片段 |
| 6 | 后期剪辑 | `post_production` | 按集拼接片段为最终成片 |

**阶段状态机**：

| status | 含义 | 用户/系统操作 |
| --- | --- | --- |
| `pending` | 阶段未开始、无产物 | 可启动执行 |
| `running` | 阶段执行中 | 前端轮询/SSE 订阅进度 |
| `waiting` | 已产出但需用户介入（选择/修改） | 用户 `intervene` |
| `completed` | 阶段完成 | 用户 `continue` 进入下一阶段 |
| `stopped` | 用户手动停止 | - |
| `error` | 执行出错 | 展示错误，可重试 |

**停点（含停点 0，共 7 个）**：

| 停点 | 阶段 | 确认内容 |
| --- | --- | --- |
| 0 | 创意与视觉确认 | 项目创意、集数、参考文档、风格与画幅比例 |
| 1 | 模型参数配置 | 各环节底层模型类型与其他控制参数 |
| 2 | 剧本生成 | 每集剧情概要 |
| 3 | 角色/场景设计 | 所有人物/场景图片 |
| 4 | 分镜设计 | 分镜个数、每集时长、总时长 |
| 5 | 参考图生成 | 各镜头参考图 |
| 6 | 视频生成 | 各镜头视频片段 |
| - | 后期剪辑 | 无需确认，完成后直接交付成片 |

> 强制规则：每到达停点，必须先展示产物或选项给用户，等待用户明确确认后才能继续，禁止跳过用户自行继续。

### 7.2 三种视频生成方式

视频生成阶段支持三种方式，可在生成配置中切换并分别配置模型：

| 方式 | 模式值 | 说明 |
| --- | --- | --- |
| 首帧生视频 | `first_frame` | 以参考图阶段生成的首帧图 + 分镜提示词生成片段（推荐，最稳定） |
| 首尾帧生视频 | `start_end_frame` | 以当前片段参考图为首帧、下一片段参考图为尾帧，画面衔接更强 |
| 参考图生视频 | `reference` | 读取角色图与场景图作为参考素材，强调角色/场景一致性 |

### 7.3 临时工作台（Sandbox）

独立于主流程的单次能力调用，适合临时取用，带历史记录。

| 工具 | 能力 | 关键入参 |
| --- | --- | --- |
| LLM 对话 | 文字生成，支持联网搜索 | prompt、web_search |
| 图片理解（VLM） | 分析图片内容 | prompt、多张图片 |
| 文生图（t2i） | 文字生成图片 | prompt、style、ratio |
| 图生图（i2i） | 图片风格转换 | prompt、参考图、ratio |
| 视频生成 | 图生视频/文生视频（约 5 秒） | prompt、参考图 |

**历史记录**：所有单次调用写入 `history.json`，支持查看详情与删除（删除时清理关联产物文件）。

### 7.4 一次性 Pipeline

一次输入、后台执行、中间无需人工介入；任务状态只显示进度与产物，不显示日志。

| Pipeline | 说明 | 典型入参 |
| --- | --- | --- |
| 文艺短视频（standard） | 旁白按句/段拆分，逐段生成配图，合成图文短视频或动态视频片段，支持配音 + 字幕 + 模板 | text、mode（copy/inspiration）、n_scenes、image_model、video_model、tts_voice、模板等 |
| 动作迁移（action_transfer） | 上传人物图 + 参考视频 + 提示词，调用视频编辑/动作迁移模型 | prompt_text、image_path、video_path、video_model |
| 数字人口播（digital_human） | 上传人像图 + 商品图/文案，生成口播带货视频 | character_image_path、goods_image_path、goods_text、llm_model、video_model、tts_voice |

**Pipeline 任务流程**：创建任务 → `POST /api/pipelines/{pipeline}/tasks` → 返回 `task_id` → 通过 `/api/tasks/{task_id}/events` SSE 订阅进度 → 完成后查询 `/api/tasks/{task_id}` 获取产物。

### 7.5 系统设置 / 配置管理

后端配置统一保存在 `backend/config.yaml`（小写、层级化 YAML），可在前端「设置」页修改，也可直接编辑。

- **api_providers**：各平台密钥、接口地址、代理开关。
- **models**：主流程默认模型（LLM / VLM / 图像 t2i / 图像 it2i / 视频三模式）。
- **generation**：默认风格、长宽比、分辨率与视频生成方式。
- **server**：host、port、日志层级、访问日志。

前端「设置」页分组展示：API Server、公共 Provider 设置、各平台密钥、模型默认值、生成默认参数，支持保存（密码字段脱敏显示 `********`）。

**平台密钥字段**：

| 平台 | 字段 | 常用用途 |
| --- | --- | --- |
| DashScope（通义） | `api_providers.dashscope.api_key` | 通义千问、万相 Wan 图像/视频 |
| 火山方舟 ARK | `api_providers.ark.api_key` | 豆包 Seedream 图像、Seedance 视频 |
| Kling（可灵） | `kling.access_key` / `secret_key` | 可灵视频生成 |
| OpenAI | `api_providers.openai.api_key` | GPT 文本/视觉、OpenAI 图像 |
| Gemini | `api_providers.gemini.api_key` | Gemini 文本/视觉 |
| DeepSeek | `api_providers.deepseek.api_key` | DeepSeek 文本 |

### 7.6 会话与产物管理

- **会话列表**：`GET /api/sessions` 返回历史会话，支持恢复继续、删除。
- **产物留存**：所有任务元数据与生成产物保存在 `backend/code/`。
- **缓存清理**：`DELETE /api/cache/temp` 清理临时上传目录并返回释放空间。
- **孤立产物清理**：`DELETE /api/sessions` 清理无会话关联的结果文件。

### 7.7 文件上传

| 接口 | 支持格式 | 上限 | 用途 |
| --- | --- | --- | --- |
| `/api/upload_file` | docx / doc / txt / md / pdf | 20 MB | 作为剧本/创意的参考文档，内容合并进 idea |
| `/api/upload_media` | jpg/jpeg/png/webp/bmp、mp4/mov/avi/mkv/webm | 500 MB | Pipeline 媒体素材（人像、商品图、参考视频） |
| `/api/project/{sid}/artifact/{stage}/upload_image` | 图片 | 25 MB（artifact 图片限制） | 用户上传自定义角色/参考图替换产物 |

### 7.8 模型可插拔

- 后端维护统一模型注册表（`models/config_model.py`），登记各模型所属 provider、类型与能力标签。
- 前端通过 `/api/models` 按 `media_type`（image/video）或 `model_type`（llm/vlm/t2i/i2i/video）或 `ability` 拉取可用模型，动态渲染模型选择器。
- 支持按能力筛选（如 `ability` 参数）与"仅显示已验真接口契约（verified_only）"。
- 缺少对应模型参数时后端直接报错，不做隐式兜底。

---

## 8. 详细功能规格

### 8.1 创建项目（停点 0 / 1）

**输入**：

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| idea | 创意/梗概/剧情描述 | 必填 |
| file_path | 上传的参考文档（docx/txt/md/pdf） | 空 |
| style | 视觉风格 | realistic |
| video_ratio | 画幅比例 | 9:16 |
| video_resolution | 分辨率 | 720P |
| episodes | 集数 | 4 |
| expand_idea | 是否扩写创意 | true |
| web_search | 是否联网搜索 | false |
| enable_concurrency | 是否并发 | true |
| llm/vlm/image_t2i/image_it2i | 各环节模型 | 取自 config |
| video_*_model | 三模式视频模型 | 取自 config |
| video_generation_mode | 视频生成方式 | first_frame |

**规则**：创建前必须校验所需模型字段齐全，缺失返回 400 并提示缺少项。

**输出**：`session_id` + 会话状态 + 生效参数。

### 8.2 剧本生成（阶段 1）

- 将 idea（含上传文档合并内容）转换为**分集结构化剧本**（以 `episode_number` 为单位的剧集列表）。
- 校验集数与目标一致（`_episode_count_matches`），不一致时反馈并重试。
- 产物包含每集 `act_title`、台词/场景行（lines）等。
- 支持智能续写：`intervene` 中传入续写请求，产出 `new_episodes`（并可能引入 `new_characters` / `new_settings`）。

### 8.3 角色/场景设计（阶段 2）

- 从剧本抽取角色与场景，为每个角色生成多视图（4 视图）设计图，为每个场景生成背景图。
- 产物以 `character_id` / `setting_id` 命名图片。
- 支持版本化：同一资产可生成多版本（`versions`），记录用户 `selected` 选择。
- 支持 VLM 质量评估与最优选择（`eval_character` / `eval_select_best`）。
- 支持介入：重新生成指定角色、选择版本、更新角色/场景描述。

### 8.4 分镜设计（阶段 3）

- 基于剧本逐场景拆分镜头（shots），按幕分组，带时长标签。
- 解析场景头（时间/空间/上下文），匹配出场角色。
- 产物含分镜个数、每集时长、总时长、镜头列表（场景、人物、台词、景别、时长等）。

### 8.5 参考图生成（阶段 4）

- 为每个镜头生成高精度首帧/参考图。
- 支持多候选生成 + VLM 评估选优（`eval_first_frame` / `eval_select_best`）。
- 产物记录每个 segment 的生成图与用户 `selected`。

### 8.6 视频生成（阶段 5）

- 按配置的三种方式之一，将参考图/角色图/场景图 + 分镜提示词生成视频片段。
- 支持首尾帧衔接（读取下一片段参考图为尾帧）。
- 产物为每个镜头的片段候选（`versions`）与用户 `selected`。
- 支持介入：修改提示词、更换选中片段。

### 8.7 后期剪辑（阶段 6）

- 按剧集分组拼接用户选定的视频片段，输出分集成片（`{session_id}_ep{n}.mp4`）。
- 使用 ffmpeg concat（libx264 + aac + faststart）。
- 产物 `final_videos`（每集一个）+ `final_video`（首集成片路径）。
- 无需用户确认，完成后交付。

### 8.8 修改与续写

- **修改角色**：`modify_character` — 重新生成指定角色 / 更新描述。
- **修改分镜**：`modify_storyboard` — 修改/续写分镜。
- **修改参考图**：`modify_reference` — 修改参考图提示词。
- **修改视频**：`modify_video` — 修改视频提示词 / 更换片段。
- **智能续写**：成片后继续推进故事，生成后续集数片段。

### 8.9 进度推送

- 阶段执行采用 **SSE（text/event-stream）** 流式返回，事件类型：`progress` / `heartbeat` / `stage_complete` / `error` / `content`。
- Pipeline 任务通过 `/api/tasks/{task_id}/events` SSE 推送 `snapshot` / `progress` / `artifact` / `completed` / `failed`。
- 支持用户断开取消（`cancellation_check` / `on_disconnect`）。

---

## 9. 数据与产物

### 9.1 产物目录结构

```text
backend/code/
├── data/
│   ├── sessions/        # 会话元数据 (JSON)
│   └── tasks/           # Pipeline 任务元数据 <task_id>.json
└── result/
    ├── image/<session>/ # 角色/场景素材 + 分镜参考图
    ├── video/<session>/ # 生成的视频片段 + output 成片
    ├── script/          # 剧本/分镜数据
    ├── sandbox/         # 临时工作台产物 + history.json
    └── task/<task_id>/  # Pipeline 产物
```

### 9.2 Session 元数据关键字段

`idea`、`user_textbox_input`、`style`、`video_ratio`、`video_resolution`、`episodes`、各模型字段、`video_generation_mode`、`enable_concurrency`、`web_search`、`expand_idea`、各阶段 `artifacts` 与 `status` 映射。

---

## 10. 非功能需求

### 10.1 性能

- 阶段执行采用流式进度推送，长任务不阻塞 UI。
- 图像/视频生成等耗时操作通过线程池执行（`run_in_threadpool` / `run_in_executor`），支持并发。
- 文件上传分块写入（1 MB chunk），避免内存峰值。

### 10.2 安全

- `config.yaml` 已加入 `.gitignore`，密钥不入库；接口返回脱敏（`********`）。
- 文件路径校验（`path_security.py`）：上传文件仅允许解析到 `temp/` 与 `code/` 白名单目录，防目录穿越。
- 上传文件扩展名与大小双重校验。
- 模板路径校验：仅允许访问 `templates/<size>/*.html`，防路径穿越。
- 删除会话/任务接口无密码控制（本地单用户场景），前端提供删除确认。

### 10.3 兼容性 / 部署

- Python 3.10+（推荐 3.12），Node.js 18+ / npm 9+。
- 依赖 ffmpeg（视频拼接与音视频后处理）。
- 支持 `uv` 管理后端环境；前端 `npm run build && npm start`（生产）或 `npm run dev`（开发）。

### 10.4 可维护性

- 阶段 Agent 统一实现 `AgentInterface`（`process(input_data, intervention)`），返回 `{payload, requires_intervention, stage_completed}`。
- 模型能力集中登记于 `models/config_model.py`，新增供应商只需注册元数据 + 实现客户端。
- Pipeline 通过注册表 `PIPELINE_REGISTRY` 扩展，任务存储/事件流复用 `pipelines/` 公共模块。

---

## 11. API 接口清单（摘要）

### 11.1 系统

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/stages` | 阶段列表 |
| GET/PUT | `/api/config` | 读取/更新配置 |
| GET/DELETE | `/api/sessions` | 会话列表 / 清理孤立产物 |
| DELETE | `/api/sessions/{id}` | 删除会话 |
| POST | `/api/upload_file` | 上传文档 |
| POST | `/api/upload_media` | 上传媒体 |
| DELETE | `/api/cache/temp` | 清空临时缓存 |

### 11.2 主流程

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/project/start` | 创建项目 |
| POST | `/api/project/{sid}/execute/{stage}` | 执行阶段（SSE） |
| GET | `/api/project/{sid}/status` | 状态快照 |
| GET | `/api/project/{sid}/artifact/{stage}` | 获取阶段产物 |
| PATCH | `/api/project/{sid}/artifact/{stage}` | 保存阶段选择/修改 |
| POST | `/api/project/{sid}/artifact/{stage}/upload_image` | 上传自定义产物图 |
| POST | `/api/project/{sid}/intervene` | 用户介入重新执行（SSE） |
| POST | `/api/project/{sid}/continue` | 进入下一阶段 |
| POST | `/api/project/{sid}/stop` | 停止 |
| PATCH | `/api/project/{sid}/models` | 更新项目模型/生成参数 |
| GET | `/api/project/{sid}/scene/{n}/assets` | 场景资产计数 |

### 11.3 Sandbox

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/sandbox/history` | 历史记录 |
| GET | `/api/sandbox/history/{id}` | 记录详情 |
| DELETE | `/api/sandbox/history/{id}` | 删除记录 |
| GET | `/api/sandbox/tasks` | 进行中任务 |
| POST | `/api/sandbox/llm` | LLM |
| POST | `/api/sandbox/vlm` | VLM 图片理解 |
| POST | `/api/sandbox/t2i` | 文生图 |
| POST | `/api/sandbox/i2i` | 图生图 |
| POST | `/api/sandbox/video` | 视频生成 |

### 11.4 Pipeline

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/pipelines` | Pipeline 列表 |
| GET | `/api/models` | 模型能力发现 |
| GET | `/api/pipelines/api-workflows` | API 工作流列表 |
| GET | `/api/pipelines/standard/templates` | 文艺短视频模板 |
| GET | `/api/pipelines/standard/templates/{size}/{file}/preview` | 模板预览 |
| POST | `/api/pipelines/{pipeline}/tasks` | 创建 Pipeline 任务 |
| GET | `/api/tasks` | 任务列表 |
| GET | `/api/tasks/{id}` | 任务详情 |
| DELETE | `/api/tasks/{id}` | 删除任务 |
| GET | `/api/tasks/{id}/events` | 任务事件流（SSE） |

---

## 12. 界面需求

前端路由与页面：

| 路由 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 首页 | 创意输入、参数配置、历史会话、开始/恢复/删除项目 |
| `/sandbox` | 临时工作台 | LLM / VLM / 文生图 / 图生图 / 视频 五工具 + 历史 |
| `/pipelines/standard` | 文艺短视频 | 文案、分段、模板、配音、字幕、视频开关 |
| `/pipelines/action-transfer` | 动作迁移 | 人物图 + 参考视频 + 提示词 |
| `/pipelines/digital-human` | 数字人口播 | 人像图 + 商品图/文案 + 语音 |
| `/settings` | 设置 | 服务、密钥、模型默认值、生成参数 |

关键交互组件：`WorkflowPanel`（阶段面板）、各 `*Stage` 组件（剧本/角色/分镜/参考图/视频/后期）、`ImageLightbox`（图片放大）、`StageActions`（阶段操作）、`StageProgress`（进度）、`PipelinePage`、`Sandbox`、`AppShell`/`TopBar`/`BrandHeader`。

---

## 13. 未来路线图

- [ ] 角色级 Agent 互评：编剧/导演/连贯性审查各自带 loop 与记忆，互相 review。
- [ ] 独立跨镜头连贯性 Agent：人物/场景一致性审查，可打回重做。
- [ ] 并发分镜 Agent + 汇总：多镜头并行生成。

---

## 14. 验收标准

1. 输入一句创意，能按 6 阶段依次产出并最终得到分集成片。
2. 每个阶段完成后都能看到产物，且需用户确认后才进入下一阶段。
3. 任意阶段产物可修改后重新生成，后续依赖阶段可正确复用修改结果。
4. 三种视频生成方式均可配置并生效。
5. Sandbox 五种工具均可单次调用，且历史可查看/删除。
6. 三种 Pipeline 可后台执行、SSE 推送进度并产出最终视频。
7. 未配置对应 API Key / 模型时，创建项目给出明确缺失提示，不做隐式兜底。
8. 上传非法文件（扩展名/大小/路径穿越）被正确拒绝。
9. 配置页保存后密钥脱敏、配置持久化到 `config.yaml`。

---

## 15. 风险与依赖

| 项 | 说明 |
| --- | --- |
| 外部模型依赖 | 生成质量受所选 LLM/VLM/图像/视频模型能力与配额影响 |
| 密钥依赖 | 用户需自行申请并配置对应平台 API Key |
| ffmpeg 依赖 | 后期剪辑依赖本机 ffmpeg，缺失将导致拼接失败 |
| 成本 | 图像/视频生成调用第三方 API 产生费用，由用户承担 |
| 时长/一致性 | 长视频角色一致性、跨镜头连贯性仍受模型能力限制（见路线图） |

---

## 附录：默认模型与平台

```yaml
models:
  llm: qwen3.5-plus            # DashScope
  vlm: qwen3.5-plus            # DashScope
  image_t2i: doubao-seedream-5-0-260128   # ARK
  image_it2i: doubao-seedream-5-0-260128  # ARK
  video_first_frame: wan2.7-i2v  # DashScope
  video_start_end: wan2.7-i2v    # DashScope
  video_reference: wan2.7-r2v    # DashScope
generation:
  style: realistic
  video_ratio: '16:9'
  video_resolution: 720P
  video_generation_mode: first_frame
```

> 致谢：本项目基于开源项目 [FilmAgent / Video-Claw](https://github.com/HITsz-TMG/FilmAgent)（MIT License）二次开发。
