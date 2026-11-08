# 贡献指南

欢迎补充可分发的公司 Logo、纠正标注或报告失效资源。提交前搜索现有目录和 Issue，避免重复。

## 收录范围

- 以公司为主，相关组织品牌须明确身份，使用可核对的名称、官网和常用别名。
- 区分公司、品牌与产品，不把产品图标直接标为公司 Logo；如果存在从属或更名关系，在提交说明中给出依据。
- 优先采用公司官方品牌资源页提供的文件。其他来源必须同时说明原始归属和允许再次分发的依据。
- 文件能够下载、在网页上公开展示或被其他仓库收录，本身不表示允许重新分发。

只提交允许保存在本仓库并向公众分发的资源。允许附条件再分发的素材需完整保留条件，例如非商业、署名和相同方式共享。仅允许链接，或要求申请但尚未取得本仓库分发授权的文件，请先开收录建议 Issue，不要提交文件。

## 新增资源

1. 确认所属实体、官网、当前版本及分发依据。可以先在仓库外生成草稿，审核完成后再建立 `logos/<id>/`；`id` 使用稳定、可读的小写标识，发布后避免随显示名称更改。
2. 保存来源提供的原始文件。不要自动批量抓取、改色、拉伸、裁切重绘或用 AI 描摹；需要其他版本时，寻找来源正式提供的对应文件。
3. 添加 `metadata.json`，为每个文件填写来源和权利信息。
4. 运行本地检查并更新索引，提交资源、元数据和生成的索引。

支持 `.svg`、`.png`、`.webp`、`.jpg`，ID 使用小写 kebab-case。每个品牌目录只保留 `metadata.json` 和其中列出的图片；元数据采用下列固定字段。SVG 中若包含位图，须在 `qualityNotes` 说明，不能仅凭 SVG 后缀宣称可无损缩放。SVG 校验只接受受限的静态元素与属性，以及经过白名单检查的绘制样式和非渲染编辑器元数据，不会自动清洗。脚本、事件、外部资源引用、DOCTYPE 和动态内容仍会被拒绝。官方 SVG 被拒绝时，请人工核对原因或选用官方原始 PNG，不要为了通过检查改画 Logo。

### 元数据

结构、必填字段和枚举的事实来源为 [schema/metadata.schema.json](schema/metadata.schema.json)，当前严格使用 `schemaVersion: 3`；运行时校验器复用这份契约，再检查文件、关系与许可声明。旧的无版本记录需显式迁移，不能依赖文件名猜测版本状态。

品牌记录需要 `schemaVersion`、`id`、`name`、`identity`、`aliases`、`website`、`entityType`、`categories`、`defaultAsset` 和 `assets`。没有别名或分类时使用空数组；只填写真实名称，不把产品名当作公司同义词。

- `entityType` 为 `company`（公司）、`product`（产品）或 `organization`（组织）。
- 可选的 `parentId` 必须指向已收录实体，不能指向自身或形成循环；没有可靠对应记录时省略。
- `categories` 保存开放的非空分类标签，建议复用 `internet`、`ai`、`developer-tools` 等已有标签。网页从实际元数据生成分类，常用标签显示中文名，其他标签按原值显示；新增分类不需要移动品牌目录或修改 Schema。
- `defaultAsset` 必须是本条目登记的文件名。有当前版本时必须默认当前素材；仅有历史文件的条目可以显式默认历史素材，网页会标明历史。

可选的 `artworks` 用于将已核实的同款标识归组，让 SVG、PNG 等文件共用一个标识预览。每组填写稳定的 `id`、简短的 `label`、成员文件名数组 `files` 和首选文件名 `defaultAsset`。

- `files` 至少包含两个不同的已登记文件，每个文件只能属于一组；组内 `defaultAsset` 必须属于该组。
- 成员的形态、语言、方向、配色类型和当前／历史状态须一致，还需核对实际图稿、颜色与比例；属性相同不等于已经确认是同款。
- 同一格式可以保留多个来源或质量不同的文件，页面在“更多文件”中选择。来源、尺寸、许可和哈希继续逐文件记录。
- 未列入 `artworks` 的文件保留独立选择。不确定是否同稿时先保留区别，不按名称或扩展名自动归并。

`identity` 明确区分品牌名称和法人名称：

- `nameZh`、`nameEn` 是核实后的中文与英文品牌名称；没有确认的名称填 `null`，不自行翻译。
- `legalNames` 是已核实的全称数组。每项填写 `name`、`language`、`role`、`source` 和 `reviewedAt`。没有可核实全称时使用空数组。
- `language` 为 `zh`、`en` 或 `de`，保留法律名称本身的语言和拼写。`role` 区分 `group`（集团）、`operating-company`（运营公司）、`website-operator`（网站运营主体）、`company`（公司）和 `organization`（组织）；不能由页脚版权文字推断网站运营关系。
- `sources` 是品牌名称的核对来源，每项填写 `label`、`url` 和 `reviewedAt`。法人名称各自保留对应的直接来源，不能从搜索别名反推全称。

每个 `assets` 条目需要：

| 字段           | 内容                                                                                                                  |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| `file`         | 当前目录中的资源文件名                                                                                                |
| `label`        | 可区分版本的显示名称，例如“蓝色图标”“白色组合标识”                                                                    |
| `variant`      | `icon`（图形标识）、`wordmark`（文字标识）或 `logo`（组合标识）                                                       |
| `status`       | `current`（当前版本）或 `historical`（历史版本），须有来源依据                                                        |
| `language`     | `none`（无文字）、`zh`（中文）、`en`（英文）或 `bilingual`（中英双语）                                                |
| `layout`       | `standalone`（独立图形）、`horizontal`（横版）或 `vertical`（竖版）                                                   |
| `color`        | `brand`、`black`、`white`、`monochrome` 或 `other`；不符合当前标准的配色不能默认为品牌标准色                          |
| `provenance`   | `sourceType` 为 `official` 或 `commons`，`processing` 为 `original` 或 `rendered`；Commons 的渲染下载不能标成官方原件 |
| `qualityNotes` | 可选的简短事实数组，例如尺寸偏小、白底、配色差异或与公司横版标识的区别；不替代许可说明                                |
| `background`   | 适合浅色背景填写 `light`，适合深色背景填写 `dark`，均适用填写 `any`                                                   |
| `source`       | 该文件的原始下载地址                                                                                                  |
| `sourcePage`   | 能够核对文件归属、版本和来源的页面                                                                                    |
| `sha256`       | 实际文件内容的 SHA-256 摘要                                                                                           |
| `bytes`        | 实际文件字节数                                                                                                        |
| `rights`       | 下表列出的分发依据                                                                                                    |

每份文件的 `rights` 需要：

| 字段          | 内容                                                              |
| ------------- | ----------------------------------------------------------------- |
| `status`      | 已核对允许在本仓库分发时填写 `permitted`                          |
| `license`     | 适用许可或授权条款的准确名称，不能把仓库的 MIT 许可填作 Logo 许可 |
| `reference`   | 能直接支持分发依据的许可、品牌指南或公开授权页面                  |
| `attribution` | 条款要求的署名文字；无署名要求时按现有记录格式明确填写            |
| `reviewedAt`  | 实际核对日期，格式为 `YYYY-MM-DD`                                 |
| `notes`       | 可选：用途限制、品牌规范或其他需要保留的条件                      |

`sourcePage` 说明文件从哪里来，`rights.reference` 说明为什么可以在这里分发，两者可以是同一页面。若依据只允许使用或展示、未允许再次分发，不应填写 `permitted`。

根目录 `index.json` 中的资源 `path` 和能从原文件读取的 PNG/JPEG `width`、`height` 由构建脚本补充，不要手工维护索引；SVG 不标为固定像素尺寸。修改现有文件时，也要更新摘要、字节数及受影响的来源或权利记录。

### 生成待审核草稿

```sh
npm run prepare:asset -- /path/to/icon.svg --id example --name Example --output /path/to/drafts/example
```

输出目录的父目录须已存在，输出目录须尚不存在且位于 `logos/` 外。工具复制原文件，检查格式并计算 SHA-256 与体积；不会联网、覆盖已有目录或自动入库。可用 `--entity-type`、`--variant`、`--status`、`--background`、`--label` 和可重复的 `--category` 填写已确认的信息，可用 `--language`、`--layout`、`--color`、`--source-type`、`--processing` 填写已经确认的素材属性；完整选项见 `npm run prepare:asset -- --help`。

草稿中的未确认身份、官网、来源、来源类型与处理方式、权利字段留空，`rights.status` 是 `pending-review`，因此不能通过正式目录校验。人工核对完成后补齐字段，只有确实取得分发依据才改为 `permitted`，再移动到 `logos/<id>/`。不要为了通过检查填写没有核实的声明。

待核对的热门公司可留在 [content/source-candidates.json](content/source-candidates.json) 或收录建议 Issue。候选清单不包含素材、不自动下载，也不计入已收录资源。

### 本地检查

推荐使用 Node.js 22.22.3，与 `.node-version` 和 CI 保持一致。在仓库根目录安装依赖并初始化本地钩子：

```sh
npm ci --ignore-scripts
npm run hooks:install
```

修改资源或元数据后，更新生成的 `index.json` 与 `docs/catalog.md`，再运行完整检查：

```sh
npm run build:index
npm run check
```

`npm run check` 包含 ESLint、格式、资源数据、索引、Svelte/TypeScript、构建和 Node 回归检查。仅检查资源数据时可单独运行 `npm run validate`。完整检查与浏览器回归按需手动运行，CI 会执行同样的完整检查；本地提交钩子不运行完整测试。

PR 中简要说明新增或修改了什么、公司与 Logo 的对应关系、来源及分发依据，并附检查结果。不要把私人授权文件、身份证明或其他个人信息放进公开 PR。

### 代码检查与格式化

- `npm run lint`：检查 ESLint 规则，警告也会导致失败。
- `npm run lint:fix`：主动修复可自动修复的 ESLint 问题。
- `npm run format:check`：只检查格式。
- `npm run format`：主动格式化配置允许的源码、脚本、测试、文档与配置文件。
- `npm run check:staged`：只检查暂存文件，不自动修复文件、不修改暂存区。

`logos/` 的原始素材与元数据、生成的 `index.json` 和 `docs/catalog.md` 均不参与自动格式化。资源清单与索引由 `npm run build:index` 更新；README 是手写的项目入口，参与常规格式检查。

`prepare` 生命周期脚本和 `npm run hooks:install` 都用于初始化 Husky。由于推荐安装命令使用 `--ignore-scripts`，安装后需显式运行 `npm run hooks:install`。pre-commit 运行暂存文件检查，commit-msg 检查提交信息。可用 `HUSKY=0` 跳过本地钩子；CI 独立检查代码、格式和提交信息。

### 提交信息

使用 `type(scope): 中文说明`，例如：

```text
feat(site): 增加品牌详情页
fix(search): 修正中文别名匹配
chore(tooling): 更新开发工具配置
```

常用类型为 `feat`（功能）、`fix`（修复）、`docs`（文档）、`style`（格式）、`refactor`（重构）、`perf`（性能）、`test`（测试）、`build`（构建）、`ci`（工作流）、`chore`（维护）和 `revert`（回退）。scope 必填，用于说明改动范围，可按内容使用 `catalog`、`site`、`project`、`search`、`scripts`、`tooling` 或 `ci`。

CI 会检查 PR 的全部提交和每次 push 新增的全部提交；新建分支会检查其完整历史。手动发布检查所选提交的信息。主分支 Pages 发布复用同一质量检查，通过浏览器回归后才构建并部署发布产物。

## 链接与兼容性

品牌 ID、原始素材路径和公开索引是使用者可能依赖的入口。修改显示名称或分类时不改动这些路径；文件替换、删除及结构升级的约定见 [docs/versioning.md](docs/versioning.md)。

网页保留旧目录 `?brand=<id>&asset=<file>` 链接的跳转，以及详情页 `?asset=<file>` 的文件选择。调整内部组件和辅助函数时，继续通过真实页面回归验证这些行为。

固定版本图片地址只指向已经确认公开的完整 commit SHA。构建会核对素材与提交内容是否一致，并根据官方仓库的远端跟踪引用或 GitHub Actions 提交信息判断公开快照。本地未提交、未推送、其他仓库或无 Git 信息的构建，只提供实际本站图片地址；本地跟踪引用落后时先更新引用再构建。

## 纠错与权利请求

发现公司名称、Logo 版本、文件内容、来源或许可记录有误，可使用纠错 Issue，并指出具体路径和可核对的依据。

权利人或其代表可以使用权利请求 Issue，列出涉及的资源和希望采取的措施。无需公开私人授权文件或个人证明；如需非公开核对，可先在 Issue 中说明，由维护者与请求方协商合适的渠道。维护者核对后会更正记录、替换或移除资源。

## 贡献许可

提交原创代码或文档，即表示同意以本仓库的 MIT 许可分发这些原创改动。提交第三方 Logo 不改变其原有许可，也不表示你或本仓库获得了相关商标权。

## 网站开发

页面放在 `src/routes/`，共享组件放在 `src/lib/components/`，样式入口为 `src/app.css`。Tailwind 不启用额外的 Preflight 重置，颜色和焦点复用既有 CSS 语义变量。Bits UI 的选择器统一通过 `ui/FilterSelect.svelte` 复用。

`static/` 为 `prepare-site.mjs` 从校验通过的 `logos/` 生成的暂存目录，请勿手工写入素材；原图路径与字节必须保持稳定。`_site/` 和 `.svelte-kit/` 均为生成产物。

涉及页面交互时，先运行 `npm run check`，再运行 `npm run test:browser`。浏览器首次使用须 `npx playwright install chromium`；CI 安装浏览器后执行同一组回归测试。
