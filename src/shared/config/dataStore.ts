/**
 * DataStore Configuration Export
 *
 * 根据使用场景导出对应的 DataStore 配置：
 * - 永续/链上交易路由使用 trading/dataStore（链上合约键）
 * - Trade 路由使用 custom/dataStore（API 后端，无需链上键）
 *
 * 默认导出链上交易配置以保持向后兼容
 */
export * from "./trading/dataStore";
