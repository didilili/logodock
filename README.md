# LogoDock

由社区维护的品牌 Logo 资源库，收录公司、产品与组织的 Logo，提供搜索、预览、下载和复制。每个文件保留来源、分发依据及 SHA-256 摘要。

A community-maintained brand logo collection with a searchable website and traceable sources.

[浏览资源清单](docs/catalog.md) · [JSON 索引](index.json) · [贡献指南](CONTRIBUTING.md) · [变更记录](CHANGELOG.md)

## 使用 Logo

在[资源清单](docs/catalog.md)中选择品牌与文件，按仓库中的原始路径下载或复制到自己的项目。项目支持 SVG、PNG、WebP 和 JPG；各品牌仅提供实际收录的格式与版本。

第三方 Logo 的使用条件以各文件的 `rights` 记录及其引用依据为准。仓库收录不代表品牌方授权或背书，也不替代商标使用要求，详见 [NOTICE.md](NOTICE.md)。

需要固定文件版本时，使用已推送的完整 commit SHA：

```text
https://raw.githubusercontent.com/didilili/logodock/<full-commit-sha>/logos/<id>/<asset-file>
```

将上述占位部分替换为真实提交和资源路径。网站的图片地址跟随网站更新；本地 `127.0.0.1` 地址不能作为他人的公共图片源。固定版本链接的核验方式见[贡献指南](CONTRIBUTING.md#链接与兼容性)。

## 本地运行网站

推荐 Node.js 22.22.3，与 `.node-version` 和 CI 保持一致。

```sh
npm ci --ignore-scripts
npm run hooks:install
npm run dev
```

打开终端显示的地址，默认是 `http://127.0.0.1:5173/`。端口占用时可用 `npm run dev -- --port 5174`。开发服务支持源码和素材热更新，不会发布到远端。

```sh
npm run build
npm run preview
```

网站使用 SvelteKit、TypeScript、Tailwind CSS 和 Bits UI，生产输出为 `_site/`，不需要在线 Node 服务或数据库。子路径预览示例：

```sh
BASE_PATH=/logodock npm run build
npm run preview -- --base /logodock/
```

## 目录与数据

```text
logos/<id>/       原始素材与 metadata.json，唯一维护来源
schema/           元数据契约，当前 schemaVersion 为 3
src/              页面、组件、搜索、预览与取用逻辑
scripts/          录入、校验、索引生成、构建与预览工具
tests/            数据、工具与浏览器回归测试
content/          尚未入库的来源候选，不提供可下载素材
docs/catalog.md   自动生成的完整资源清单
index.json        自动生成的公开资源索引
```

`static/`、`_site/` 和 `.svelte-kit/` 是生成产物，不能作为素材维护入口；依赖、构建结果和本地设计档案不进入版本库。产品行为与设计约定见 [PRODUCT.md](PRODUCT.md) 和 [DESIGN.md](DESIGN.md)。

## 贡献与检查

欢迎提交[收录建议、资源纠错或网站问题](https://github.com/didilili/logodock/issues/new/choose)。新增素材需要真实身份、可靠来源和逐文件分发依据；具体步骤见[贡献指南](CONTRIBUTING.md)。

修改原始素材或元数据后，更新派生文件并检查：

```sh
npm run build:index
npm run check
```

`build:index` 生成 `index.json` 与 `docs/catalog.md`，不会改写 README。`check` 包含代码、格式、资源、生成文件一致性、类型、构建和 Node 回归检查。网页交互修改还需浏览器回归：

```sh
npx playwright install chromium
npm run test:browser
```

本地提交钩子只检查暂存文件与提交信息，不运行完整套件。提交格式为 `type(scope): 中文说明`。测试按职责组织，新增回归放入对应的数据、录入工具或网页测试中。

PR 和分支推送运行自动检查；主分支发布在同一套检查及浏览器回归成功后，才生成带 Pages 路径配置的发布产物并部署。版本、路径和数据契约的兼容约定见 [docs/versioning.md](docs/versioning.md)。

## 许可与反馈

原创代码和文档采用 [MIT License](LICENSE)。第三方 Logo 保留各自的版权、商标和使用条件，详见逐文件元数据与 [NOTICE.md](NOTICE.md)。

发现资源归属、版本或分发依据有误，请提交纠错或权利请求。无需在公开 Issue 或 PR 中上传私人授权文件、身份证明及其他敏感材料。
