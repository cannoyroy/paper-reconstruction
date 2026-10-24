# 开发与发布

Node.js 22.13+ 与 pnpm 10.13.1。pnpm-lock.yaml 锁定依赖；使用 pnpm install --frozen-lockfile。核心逻辑在 core，浏览器在 viewer；确定性导出由 cli 与发布包共用。

## 验证

```sh
pnpm test
pnpm examples:check
pnpm build
pnpm package:skill
pnpm exec playwright install chromium
pnpm test:e2e
```

Windows 如已安装 Edge，PowerShell 可执行 `$env:PLAYWRIGHT_CHANNEL='msedge'` 再跑浏览器测试。测试使用独立无头实例，浏览器数据与用户日常配置分开。

Skill 打包把同一份校验器与 Schema 放入 release 目录，并生成 ZIP；辅助 CLI 不需要另装 npm 包。以解压包在仓库外运行 validate、markdown 和 discussion，检验其自足性。发布包只包含分发必需内容。

## GitHub Actions 与 Pages

main 的 CI 执行核心测试、案例校验、类型检查、生产构建、Skill 打包及 Chromium 浏览器测试；通过后部署 Pages。拉取请求执行相同验证但不部署。部署使用 GitHub 官方 Pages artifact 与 deploy 流程。

Vite 默认使用相对资源路径；CI 构建使用仓库子路径 /paper-reconstruction/。UI 不依赖 history 路由，刷新页面不需要后端回退。页面只加载项目自带静态资源，用户分析留在浏览器。

推送 v* 标签会在通过检查后创建 GitHub Release，附带 Skill ZIP。发布前确认版本、文档、格式和示例同步。不要将 work、原始论文、私人结果、凭据、浏览器缓存或测试追踪提交到仓库。

## 案例维护

ResNet 与 CRISPR 为打磨案例，scripts/curate-examples.ts 保留原创编辑内容，运行会更新生成时间并重新生成两份案例，不是自动论文分析器。LIGO 通过冻结后独立试用制作。修改方法后，记录它解决的具体缺陷，不以案例文字长度或节点数作为收益指标。
