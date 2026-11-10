# 变更记录

面向使用者记录重要行为、素材与引用变化。站内更新日志与本文件共用内容，按网站实际成功部署日期归档，日期使用北京时间。正式仓库版本同时记录版本号，版本与路径约定见 [docs/versioning.md](docs/versioning.md)。

## 未发布 · 素材补充与取用体验优化

### 新增收录

- 新增汇川技术、快手、蔚来、虾皮、腾讯音乐娱乐集团、传音控股、小红书、小鹏，并补充现有品牌素材。当前本地收录 59 个品牌、215 份预览素材和 19 份原生设计附件。

### 素材更新

- 对当前 59 个品牌复核公司信息与现有图稿，补齐 13 个英文品牌名，并按官方依据补充集团、公司与运营主体名称。京东补入官方 512 × 512 应用图标及英文 IR 页头组合，各文件分别标明用途与来源。
- 补入 71 份官方原件，覆盖阿里巴巴、字节跳动、滴滴、Git、GitLab、Codeberg、荣耀、华为、科大讯飞、金蝶、快手、爱奇艺、MiniMax、拼多多、360、腾讯、腾讯音乐、要务、知乎等品牌的具体语言、横竖布局及配色用途。金蝶当前官方透明 SVG 替换旧白底 JPEG，SVG 内嵌 1492 × 506 PNG，保留原始像素限制提醒。原文件及来源通过 Git 历史追溯。
- 携程反白字标采用官方媒体库 3183 × 434 原件替换同路径的 699 × 96 文件。百度补入反白规范 RGB／CMYK AI，顺丰、携程、爱奇艺和 MiniMax 补入官方规范及原生附件，GitLab 补齐已核对的 CMYK 印刷图稿。各文件保留实际用途与具体使用条件。
- 检查当前 59 品牌的 SVG 图形提取适用性，逐图查看 51 份 SVG。亚信、字节、滴滴、懂车帝、帆软、Git、GitLab、科大讯飞、蔚来、去哪儿、深信服、虾皮、小米、小鹏、智谱新增 21 份紧边方形图形提取版，独立图形原稿与提取版按同稿归组。图形中的 MI、S、Z 等字母如实标注，派生来源、母稿哈希与返回原稿入口统一提供。另有 2 品牌已有方形原件、11 品牌仅有字标 SVG、31 品牌当前为位图，逐家记录结果与后续缺项。
- 蔚来新增黑色图形提取版 SVG，保留官方组合稿的图形路径与配色，方形画布长边贴边、短边居中补齐透明空间。处理方式、母稿文件与哈希单独登记，详情提供返回原始组合稿的入口。
- 对现有 59 品牌补查 Logo.wine、Seeklogo，分别保存查询、候选页与文件审核范围。七品牌新增 11 份官方图稿，删除 2 份被覆盖的小图，净增 9 份。
- 得物采用 400px 字标替换 120px 小图，恒生电子补入 2493 × 1011 彩色字标，BIGO 采用 382 × 114 蓝色字标替换 88 × 26 小图。B站补入国际官网通用蓝色路径 SVG，水滴补白底蓝字组合，顺丰补黑白独立 SF 图形并保留原生像素限制。
- GitLab 补入当前官方彩色／反白组合、彩色／白色图形四份 SVG，彩色组合设为默认，旧图形列为历史备选。百度提供四份 RGB／CMYK AI，GitLab 提供两份 CMYK PDF，均保留原始字节。

- 百度补入官方媒体资源库的彩色中英组合、熊掌两份白底 JPG 原图，中英组合设为默认。熊掌按官方限定用途列为备选，透明小尺寸组合与渐变应用图标各保留独立用途。两份原始压缩包及其中四份 AI 设计文件已保存在采集证据中，其他三个原包继续跟进。

- 按实际用途补入剩余16家公司23份官方原件，保留应用、小尺寸网页、招聘及IR版本的具体限制。网易新增官方校园招聘站独立路径SVG，恒生新增官网原始PNG负载，京东与唯品会补入独立页头文件。前50家均至少有一份正式文件，高清与版本缺项继续逐家追踪。

- 按维护者要求直接收录蚂蚁集团、去哪儿、深信服、懂车帝、作业帮、视源股份、亚信科技、360、帆软、高德、清微智能，共11品牌25份官方原件。原始字节保持完整，逐文件权利状态记录为“许可未核实”。该次收录后前50家34家关联素材、16家待原件或版本。
- 元数据支持 `rights.status: "unverified"`，逐文件保留实际审核状态。静态SVG支持原件中的 `enable-background` 绘制声明和 `style type="text/css"`，并保持外部资源和活动内容检查。

- 核对面栈引用的携程集团招聘站，将“携程”雇主关联至携程集团。集团采用官方白色 PNG 为默认，当前蓝色 PNG 作为小尺寸网页备选，移除与当前官方配色不同的旧 Commons SVG。
- 27 家待审核项分为 11 家优先补分发依据、16 家继续补通用原件/版本/格式，同时记录官方咨询入口和具体用途。该次推进后前 50 家23家已关联正式素材。

- 完整前 50 家按六类来源续查，新增知乎官方应用 PNG，快手补充圆角应用图标，美团补充无损应用 PNG，OPPO 补充官网黑色字标 SVG 并设为默认。
- 同步逐家公司检索、同名/产品/活动图排除与缺项记录。该次核查后前 50 家中 22 家已有本实体文件，1 家仅有相关集团标识，27 家仍待原件、身份或分发依据。

- 小红书补充专业号官网胶囊字标 SVG，并采用 Google Play 无损圆角应用 PNG 替换旧 App Store JPG。
- 蔚来补充官网黑色英文组合 SVG 与官方应用图标，官网组合设为默认，白色独立图形继续提供。
- 虾皮补充 Commons 提供的 1920 × 2731 透明竖版 PNG 渲染，官方横版 SVG 继续为默认。
- 经同尺寸、同背景对照，精简 12 份由合格同稿 SVG 覆盖的 PNG，并删除腾讯已由高分辨率官方原件覆盖的蓝色 PNG，共 13 份。
- 移除另 7 份已被替代且无独立用途的冗余图片及其登记，历史原件和来源通过 Git 追溯。有独立用途的备选保留使用说明，例如中兴小尺寸标准蓝字标。

### 体验改进与修复

- 来源与使用说明集中展示当前素材及关联设计附件的出处、实际许可、必要署名与使用条件。同址链接和相同条件合并，公开页面省略重复的许可审核状态标签，内部逐文件记录继续保留。补回视源股份与顺丰官网素材已有的使用条件及条款入口。
- 修复旧首页链接携带无效素材参数时的默认文件回退，以及图形提取版返回原稿后的键盘焦点恢复。
- 首页卡片优先展示当前主要素材中的正方形图，缩略图首位、下载、复制和详情入口与当前预览同步。多份方形素材优先独立图形、适合浅底的版本、SVG 和品牌色；搜索、格式及形态筛选限定可选文件。SVG 的画布宽高比由原稿自动读取，后续新增素材沿用此规则。
- 原生设计文件作为独立附件下载，随图稿切换关联原件，逐文件展示简短信息，关联文件共用折叠的来源与使用说明。无 JavaScript 时仍可下载全部原件，附件单独统计。
- 仅有 SVG 的图稿支持按需下载长边 2048px 的透明 PNG，菜单注明由 SVG 生成。
- 位图按原生像素限制预览放大，SVG 使用统一预览区域，尺寸、留白、背景与配色说明靠近下载和复制操作展示。
- 调整宽屏目录与页头对齐，完善详情取用、素材搜索与具体文件的来源展示。
- 增加更新日志页面，按日期展示已上线的素材收录和网站改进，并提供手机导航入口。

### 引用变化

- 品牌详情、原图、原生附件与元数据地址统一由 `/logos/` 迁移至 `/logo/`，仓库素材目录、公开索引、下载与分享链接同步更新。原 `/logos/` 地址随迁移失效。
- 移除深信服 `logo/sangfor/icon-official.png` 与小米 `logo/xiaomi/icon-orange-2021.png`，分别由已核对同款图形的 `icon-color-extracted.svg`、`icon-orange-extracted.svg` 路径矢量覆盖。两条旧 PNG 地址随删除失效，默认文件和连续清单同步更新。
- 已删除文件的旧图片地址返回 404。旧详情 `?asset=` 和旧首页 `?brand=&asset=` 继续选择已收录文件，无效文件参数回到品牌默认。页面提供当前默认素材和现有文件的静态下载入口。
- 下表列出删除路径与推荐替代，替代文件的格式、配色或比例以当前品牌记录为准。

| 已删除路径                                      | 推荐替代                                            | 原因                                                        |
| ----------------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------- |
| `logo/kingdee/logo-color-english.jpg`           | `logo/kingdee/logo-color-english-official.svg`      | 同用途由当前官方透明路径 SVG 覆盖                           |
| `logo/dewu/wordmark-square-small-official.png`  | `logo/dewu/wordmark-square-official.png`            | 同稿黑底白字用途由更清晰的官方 400px 原件覆盖               |
| `logo/bigo/wordmark-blue-micro-official.png`    | `logo/bigo/wordmark-blue-official.png`              | 同稿同色浅底字标由官方 382 × 114 原件覆盖                   |
| `logo/trip-com/wordmark-color.svg`              | `logo/trip-com/wordmark-white-official.png`         | 旧SVG配色与当前官网不同，改用官方原件，蓝色小尺寸稿见品牌页 |
| `logo/xiaohongshu/wordmark-square-appstore.jpg` | `logo/xiaohongshu/wordmark-rounded-google-play.png` | 应用标识用途由无损、透明圆角 PNG 覆盖                       |
| `logo/meituan/logo-chinese.png`                 | `logo/meituan/logo-chinese-official.png`            | 195 × 71 小尺寸来源文件已有清晰透明原件覆盖                 |
| `logo/yonyou/wordmark-red.jpg`                  | `logo/yonyou/wordmark-red-transparent.png`          | 白底、压缩边缘及较小尺寸，已有透明原件覆盖                  |
| `logo/minimax/logo-gradient-vertical.png`       | `logo/minimax/logo-gradient-vertical-official.png`  | 较小来源文件，旧渐变未确认为独立现行版本                    |
| `logo/lenovo/logo-red-2015.png`                 | `logo/lenovo/logo-red-official.svg`                 | 来源红色偏差，已有标准红路径 SVG                            |
| `logo/lenovo/logo-red-brandworld.png`           | `logo/lenovo/logo-red-official.svg`                 | 原色与标准红不同，未提供需要单独保留的用途                  |
| `logo/zte/wordmark-cyan-2015.png`               | `logo/zte/wordmark-blue-official.png`               | 非标准青色未确认为独立现行配色                              |
| `logo/zte/wordmark-cyan-commons.svg`            | `logo/zte/wordmark-blue-official.png`               | 非标准青色无独立用途，矢量格式不足以保留                    |
| `logo/alibaba/wordmark-orange.png`              | `logo/alibaba/wordmark-orange.svg`                  | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/bytedance/logo-english.png`               | `logo/bytedance/logo-english.svg`                   | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/codeberg/icon-blue.png`                   | `logo/codeberg/icon-blue.svg`                       | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/codeberg/icon-white.png`                  | `logo/codeberg/icon-white.svg`                      | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/codeberg/logo-vertical-blue.png`          | `logo/codeberg/logo-vertical-blue.svg`              | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/codeberg/logo-vertical-white.png`         | `logo/codeberg/logo-vertical-white.svg`             | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/didi/logo-english.png`                    | `logo/didi/logo-english.svg`                        | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/iqiyi/wordmark-green.png`                 | `logo/iqiyi/wordmark-green.svg`                     | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/oppo/wordmark-green-2019.png`             | `logo/oppo/wordmark-green-2019.svg`                 | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/vivo/wordmark-blue-2019.png`              | `logo/vivo/wordmark-blue-2019.svg`                  | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/trip-com/wordmark-color.png`              | `logo/trip-com/wordmark-white-official.png`         | 旧配色来源文件已替换为当前官网原件                          |
| `logo/yonyou/wordmark-white-transparent.png`    | `logo/yonyou/wordmark-white.svg`                    | 同稿 SVG 已覆盖，PNG 可按需生成                             |
| `logo/tencent/wordmark-blue.png`                | `logo/tencent/wordmark-blue-official.png`           | 同稿蓝色字标已有更清晰官方 PNG 覆盖                         |

### 维护说明

- 文件展示层级为可选字段，旧记录省略时沿用主要文件行为。品牌与分组默认指向仍收录且符合层级要求的文件，视觉同稿关系由人工核对。
- 完善首批公司采集清单、来源校验与素材审核规范。

## 2026-11-08 · 品牌目录与取用体验升级

本批次于北京时间 2026-11-08 成功上线。[查看部署记录](https://github.com/didilili/logodock/actions/runs/42491819213)

### 新增收录

- 新增阿里巴巴、字节跳动、滴滴、华为、美团、腾讯等 21 个品牌，本批次上线时共提供 23 个品牌、63 份来源文件。可前往 [腾讯](logo/tencent/)、[阿里巴巴](logo/alibaba/) 和 [华为](logo/huawei/) 详情页选择素材。

### 体验改进与修复

- 目录增加品牌分类和文件格式筛选，手机通过分类抽屉浏览，分类选项跟随实际收录内容生成。
- 增加独立品牌详情页，支持选择图稿和格式，切换浅色、深色与棋盘格预览背景，并查看具体文件的来源与使用条件。
- 支持复制 SVG 源码、PNG 图片、HTML、Markdown 和素材分享地址。仅含 SVG 的图稿支持生成长边 1024px 的 PNG。
- 网站启用 LogoDock 名称与夹页小鸟标识，完整资源清单整理至 [资源清单](docs/catalog.md)。

## 2026-11-06 · 初版搜索目录上线

本批次于北京时间 2026-11-06 成功上线。[查看部署记录](https://github.com/didilili/logodock/actions/runs/42223360456)

### 新增收录

- 首批收录 [Codeberg](logo/codeberg/) 的两份 PNG 和 [GitLab](logo/gitlab/) 历史图标，共 2 个品牌、3 份来源文件。

### 体验改进与修复

- 支持按名称、别名、文件名和许可搜索素材。
- 详情区支持切换素材、下载原图和复制固定版本地址，同时展示来源、许可和使用说明。
