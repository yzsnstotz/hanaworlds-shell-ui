/** Register through the public lazy-CJS protocol; throw only when the real Loader imports it. */
window.__ModuleLoader__.load({
  id: 'hanaworlds-isolation-trial-sample',
  factory() {
    throw new Error('隔离试用样例：预期的首次客户端导入失败。无业务功能；此结果不代表旧 Inspector 故障已修复。');
  },
});
