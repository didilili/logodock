# company-logos

面向社区维护的公司 Logo 资源库，也收录明确标注身份的组织品牌。每个收录文件保留来源、分发依据和 SHA-256 摘要，方便下载、引用和核对。

A community-maintained company and organization logo collection with traceable sources and distribution permissions.

**[浏览与搜索 Logo](https://didilili.github.io/company-logos/)**

## 获取与使用

在仓库页面选择 **Code → Download ZIP**，或克隆仓库：

```sh
git clone https://github.com/didilili/company-logos.git
cd company-logos
```

从下方资源表选择文件，按仓库相对路径复制到自己的项目。`logos/<id>/metadata.json` 记录该公司的来源与分发依据；根目录 `index.json` 提供完整索引，文件路径位于 `brands[].assets[].path`。

第三方 Logo 的使用条件以各文件的 `rights` 记录及其引用的许可、品牌指南为准。仓库中的收录许可不替代商标使用要求，使用前请核对用途与品牌规范。

需要通过 URL 引用时，固定到已存在的 commit 或 tag：

```text
https://raw.githubusercontent.com/didilili/company-logos/<commit-or-tag>/logos/<id>/<asset-file>
```

上面是 URL 结构示例：将 `<commit-or-tag>` 换成完整 commit SHA 或实际 tag，将 `logos/<id>/<asset-file>` 换成资源表中的路径。固定版本可以避免文件随分支更新而变化。

## 资源

<!-- logos:start -->
| 预览 | 品牌 | 文件 / 类型 | 许可 | 说明 |
| --- | --- | --- | --- | --- |
| <img src="logos/codeberg/icon-blue.png" alt="codeberg" width="64" height="64"> | Codeberg e.V. | [icon-blue.png](logos/codeberg/icon-blue.png) / icon | [CC0-1.0](https://codeberg.org/Codeberg/Design/raw/commit/ac514aa9aaa2457d4af3c3e13df3ab136d22a49a/README.md) | 原始蓝色版本，未修改。Codeberg e.V. 是非营利组织，此处收录其组织品牌。素材版权采用 CC0；Codeberg 名称与 Logo 商标权保留。遵循官方品牌指南，不变形、不自定义染色，深色背景请选择官方白色版本。 |
| <img src="logos/codeberg/logo-vertical-blue.png" alt="codeberg" width="64" height="64"> | Codeberg e.V. | [logo-vertical-blue.png](logos/codeberg/logo-vertical-blue.png) / logo | [CC0-1.0](https://codeberg.org/Codeberg/Design/raw/commit/ac514aa9aaa2457d4af3c3e13df3ab136d22a49a/README.md) | 原始蓝色版本，未修改。Codeberg e.V. 是非营利组织，此处收录其组织品牌。素材版权采用 CC0；Codeberg 名称与 Logo 商标权保留。遵循官方品牌指南，不变形、不自定义染色，深色背景请选择官方白色版本。 |
| <img src="logos/gitlab/icon-legacy.png" alt="gitlab" width="64" height="64"> | GitLab | [icon-legacy.png](logos/gitlab/icon-legacy.png) / icon | [CC-BY-NC-SA-4.0](https://gitlab.com/gitlab-com/gitlab-artwork/-/raw/9b07772f44a9fa51f395a95928a6e41c61a5b1cb/README.md) | 历史标识：来自 GitLab 官方 Artwork 仓库的旧版图标，未修改，不代表当前官网标识。仅限非商业用途，需署名并保留许可链接；改编须按相同方式共享。商标权不随素材许可授予。此许可仅对应本文件，不能推及当前新版 Logo。 |
<!-- logos:end -->

当前为初始收录。GitLab 条目是官方 Artwork 仓库中的历史图标，采用非商业许可；Codeberg 条目为非营利组织品牌。具体用途条件见表格及各条目元数据。

## 目录与索引

```text
logos/
  <id>/
    metadata.json
    <asset-file>
index.json
```

`metadata.json` 和原始资源文件是维护来源。`index.json` 由脚本生成，包含公司名称、别名、官网、资源路径、来源、文件摘要和权利信息；不要手工修改。

## 贡献与检查

欢迎通过 Issue 提交收录建议、报告错误或提出权利请求；提交资源前请阅读 [贡献指南](CONTRIBUTING.md)。新资源需要说明所属公司、可靠来源，以及允许在本仓库分发的依据。

维护脚本需要 **Node.js 22 或更新版本**。在仓库根目录运行：

```sh
npm ci --ignore-scripts
npm test
npm run validate
npm run build:index
npm run check
```

`validate` 检查资源与元数据，`build:index` 更新索引与上方资源表，`check` 执行完整的本地检查。直接下载使用 Logo 不需要运行这些脚本。校验器检查许可声明字段是否完整，不代替实际权利核实；SVG 检查采用保守的静态子集规则，不会修改或清洗文件。

## 展示网页

网站按公司归组，可搜索名称、别名、文件名或许可，在详情区切换版本、下载原图或复制固定版本链接。网站从同一份资源元数据生成。

```sh
npm run build:site
python3 -m http.server 4173 --directory _site
```

打开 `http://localhost:4173` 预览。`site/` 为网页源码，`_site/` 是构建结果。主分支的更新会通过 GitHub Actions 部署到 GitHub Pages；资源贡献后无需另行维护网页数据。

## 许可

本仓库原创脚本和文档采用 [MIT License](LICENSE)。第三方 Logo 各自适用元数据记录的许可或品牌指南，详见 [NOTICE.md](NOTICE.md)。MIT 不授予第三方 Logo 的版权或商标使用权。
