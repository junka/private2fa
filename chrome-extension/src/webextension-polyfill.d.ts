declare module "webextension-polyfill" {
  // polyfill 的严格泛型与既有无类型 chrome.* 代码不匹配；
  // 保持与之前一致的宽松行为（API 实际形状由浏览器运行时保证）
  const browser: any;
  export default browser;
}