# 隔离试用样例

[English](README.md) | 中文

这个公共输入属于官方 HanaWorlds Desktop origin。它没有业务功能、世界写入、凭据操作、后台任务、重试、boot flag、模拟 Host 或伪造诊断日志。它不修复 Inspector，也不解释历史 Inspector 激活失败。

通过正常 Plugins → Add plugin → Install → Enable now 路径安装准确提交所产出的 tar。bundle patch 使用公共 `insert` 操作添加组件；只有 `id` 的行仅覆盖已有组件，不能创建组件。0.1.1 版修正该输入，并导出包元数据和英中标签。真实 Host 入口启用时没有副作用。Host 的正常模块图提供 `client.js`，该文件通过公开 lazy-CJS 协议注册。真实客户端首次物化 factory 时抛出醒目标为样例的错误。正常 Quit 后冷启动必须走同一正常激活路径；单元测试或 fixture（测试前置数据）结果不是运行时隔离证据。

试用预期结果：首页和 Plugins 页可用，`hanaworlds-isolation-trial-sample` 的具名失败保留第一条原始 message、stack 和 factory phase，另一个健康插件的真实面板可用。核对这些结果时保持本 entry 启用。样例刻意不提供客户端导出或自身面板。它不发布 invariant installer：本输入没有独立的运行时关系；产品试用分别观察 Host、Loader、失败提示和健康面板。

包身份、准确 tar 摘要、全部交付文件以及冻结的 Desktop 源码提交记录在消费卡的公共 REPORT 中。缺少源码 stamp 时保持 unknown，不以历史或无关来源替代。源码工程检查在 fixture 中通过真实 composer、Loader 和模块机制执行供给的客户端产物，分别记录组件发现和 factory 异常，不声称 App 冷启动或健康面板已经证明。
