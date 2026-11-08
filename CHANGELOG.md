# 变更记录

面向使用者记录重要行为、素材与兼容性变化。版本和路径约定见 [docs/versioning.md](docs/versioning.md)。

## 未发布

- 删除 7 份已被替代且无独立用途的冗余图片及其元数据登记，仓库与正常目录均保留 56 份图片；历史原件及来源可通过 Git 追溯。删除路径与推荐替代见下表，替代文件的格式、配色或比例可能不同，以其当前记录为准。
- 删除后的旧图片地址返回 404。旧详情 `?asset=` 和旧首页 `?brand=&asset=` 仍支持已收录文件的选择，无效文件参数沿现有逻辑回到品牌默认，不提供逐文件替代映射。没有 JavaScript 时可浏览当前默认素材并下载现有文件。
- 备选仅保留有独立用途的版本，例如中兴小尺寸标准蓝字标。用友白字 SVG 与 PNG 归为同稿，腾讯同蓝色字标的紧凑画布 PNG 继续用于嵌入和复制；同稿更多文件按用途区分。
- 位图按原生像素限制预览放大，SVG 使用统一的预览区域；文件的尺寸、留白、背景与配色等质量说明靠近下载与复制操作展示。
- 新增可选的文件展示层级，旧记录省略时保持主要文件行为；已登记原件继续校验，品牌与分组默认只能指向仍收录且符合层级要求的文件，不自动判断视觉同稿。
- 分类列表根据已收录元数据生成，新增合法分类可以显示、筛选并保留在目录链接中。
- Pages 发布等待完整质量检查和浏览器回归成功，复用同一套验证流程。
- 完整资源清单移至自动生成的 [docs/catalog.md](docs/catalog.md)，README 保留使用、开发与贡献入口，仍收录的素材路径和 JSON 索引位置不变。
- 测试按数据校验、品牌身份、素材准备与图稿分组整理，继续验证旧目录入口及已收录文件的分享选择行为。

| 已删除路径                                 | 推荐替代                                            | 原因                                        |
| ------------------------------------------ | --------------------------------------------------- | ------------------------------------------- |
| `logos/meituan/logo-chinese.png`           | `logos/meituan/logo-chinese-official.png`           | 195 × 71 小尺寸来源文件已有清晰透明原件覆盖 |
| `logos/yonyou/wordmark-red.jpg`            | `logos/yonyou/wordmark-red-transparent.png`         | 白底、压缩边缘及较小尺寸，已有透明原件覆盖  |
| `logos/minimax/logo-gradient-vertical.png` | `logos/minimax/logo-gradient-vertical-official.png` | 较小来源文件，旧渐变未确认为独立现行版本    |
| `logos/lenovo/logo-red-2015.png`           | `logos/lenovo/logo-red-official.svg`                | 来源红色偏差，已有标准红路径 SVG            |
| `logos/lenovo/logo-red-brandworld.png`     | `logos/lenovo/logo-red-official.svg`                | 原色与标准红不同，未提供需要单独保留的用途  |
| `logos/zte/wordmark-cyan-2015.png`         | `logos/zte/wordmark-blue-official.png`              | 非标准青色未确认为独立现行配色              |
| `logos/zte/wordmark-cyan-commons.svg`      | `logos/zte/wordmark-blue-official.png`              | 非标准青色无独立用途，矢量格式不足以保留    |
