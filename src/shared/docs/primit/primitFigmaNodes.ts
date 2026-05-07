/**
 * Primit UI Components Guidelines（Figma）文件与章节节点对照。
 * 用于 Storybook Design 插件、文档链接；node-id 使用 URL 中的连字符形式。
 */

export const FIGMA_PRIMIT_GUIDELINES_FILE_KEY = "Xy4iA3ZnzAZPmOduAyqmtG";

const BASE = `https://www.figma.com/design/${FIGMA_PRIMIT_GUIDELINES_FILE_KEY}/Primit-UI-Components-Guidelines`;

/** 构建带 Dev Mode 的稿面链接 */
export function primitGuidelinesFigmaUrl(nodeIdDash: string): string {
  return `${BASE}?node-id=${nodeIdDash}&m=dev`;
}

/** 第 11 章 Popup_PC 主 frame（`228-3282`）— 对应 `Modal` 的 `variant="primit"` */
export const PRIMIT_MODAL_POPUP_PC_FIGMA_URL = primitGuidelinesFigmaUrl("228-3282");

/** 与仓库内已嵌入章节 / Story 对应的 Figma 节点（精确到 frame/section） */
export const primitChapterFigmaNode: Record<
  "index" | "01" | "03" | "04" | "05" | "07" | "08" | "09" | "10" | "11" | "12" | "15",
  { nodeId: string; label: string; extraNodes?: { nodeId: string; label: string }[] }
> = {
  index: {
    nodeId: "0-1",
    label: "Cover",
  },
  "01": {
    nodeId: "1-17",
    label: "1. Typography-desktop / 字体排版-桌面端",
    extraNodes: [
      { nodeId: "16-173", label: "字体与行高" },
      { nodeId: "16-752", label: "字号阶梯" },
    ],
  },
  "03": {
    nodeId: "6-440",
    label: "Layout System / 布局",
  },
  "04": {
    nodeId: "1-20",
    label: "Colors / 颜色",
    extraNodes: [
      { nodeId: "112-357", label: "深色主题" },
      { nodeId: "112-445", label: "浅色主题" },
      { nodeId: "112-287", label: "Others · 深色" },
      { nodeId: "112-373", label: "Others · 浅色" },
    ],
  },
  "05": {
    nodeId: "1-21",
    label: "5. Icons / 图标",
    extraNodes: [
      { nodeId: "36-412", label: "图标设计规范" },
      { nodeId: "154-315", label: "General Icon · 通用图标" },
      { nodeId: "112-463", label: "System Icon · 系统图标" },
      { nodeId: "36-465", label: "Function Icon · 功能图标" },
      { nodeId: "36-416", label: "Guide Icon · 引导图标" },
    ],
  },
  "07": {
    nodeId: "1-23",
    label: "7. Button / 按钮",
    extraNodes: [
      { nodeId: "36-475", label: "按钮 · Desktop" },
      { nodeId: "119-1124", label: "MainBtn · 40" },
      { nodeId: "119-1450", label: "IconBtn · 40" },
      { nodeId: "147-337", label: "Small TabBtn · 24" },
    ],
  },
  "08": {
    nodeId: "1-24",
    label: "8. Input & Select / 输入框&选择框",
    extraNodes: [
      { nodeId: "112-668", label: "Select / 输入（section）" },
      { nodeId: "121-1970", label: "Select_Main_40" },
      { nodeId: "152-758", label: "Select_24" },
      { nodeId: "155-974", label: "Select_Secondary_40" },
      { nodeId: "167-1470", label: "Select_Icon_40" },
      { nodeId: "167-1607", label: "Expand · 选项 Item" },
      { nodeId: "167-1773", label: "Expand · 面板" },
      { nodeId: "155-987", label: "Input_40" },
      { nodeId: "155-1425", label: "Input_24（紧凑示意）" },
      { nodeId: "230-3296", label: "Input_24（完整状态矩阵）" },
    ],
  },
  "09": {
    nodeId: "1-25",
    label: "9. Nav & Bar / 导航和栏",
    extraNodes: [
      { nodeId: "109-278", label: "导航栏 · PC · Dark" },
      { nodeId: "109-276", label: "Header / 顶栏" },
      { nodeId: "146-455", label: "Tab 标签选项 / Item" },
      { nodeId: "146-627", label: "Tab 标签选项" },
      { nodeId: "152-691", label: "Big_Tab 大标签选项 / Item" },
      { nodeId: "240-3703", label: "Progress_bar" },
    ],
  },
  "10": {
    nodeId: "1-26",
    label: "10. Card / 业务卡片",
    extraNodes: [
      { nodeId: "145-422", label: "Card / 卡片" },
      { nodeId: "145-421", label: "Information_Bar" },
      { nodeId: "153-556", label: "Order book / 订单簿" },
      { nodeId: "155-1773", label: "Order_bar" },
      { nodeId: "155-1772", label: "Order · Market" },
      { nodeId: "155-1771", label: "Order · Limit" },
      { nodeId: "226-2376", label: "Order · Stop Loss Market" },
      { nodeId: "226-2843", label: "Order · Take Profi Market" },
      { nodeId: "155-1785", label: "Assets" },
      { nodeId: "201-2665", label: "Coin_list" },
      { nodeId: "216-3530", label: "Coin_list/列表下拉选项 Item" },
      { nodeId: "221-1398", label: "Time_select" },
      { nodeId: "240-3886", label: "Points_Card/积分页卡片" },
      { nodeId: "242-778", label: "Referrals_Card/邀请页卡片" },
      { nodeId: "244-980", label: "Fee & VIP_Card/VIP卡片" },
    ],
  },
  "11": {
    nodeId: "1-27",
    label: "11. Popup / 弹窗",
    extraNodes: [
      { nodeId: "228-3106", label: "Popup / 弹窗（section）" },
      { nodeId: "228-3282", label: "Popup_PC / 弹窗" },
      { nodeId: "228-3280", label: "Size=Small · Title=on" },
      { nodeId: "228-3281", label: "Size=Small · Title=off" },
      { nodeId: "228-3193", label: "Size=Middle · Title=on" },
      { nodeId: "228-3194", label: "Size=Middle · Title=off" },
      { nodeId: "228-3124", label: "Size=Big · Title=on" },
      { nodeId: "228-3125", label: "Size=Big · Title=off" },
    ],
  },
  "12": {
    nodeId: "1-28",
    label: "12. Divider / 分割线",
    extraNodes: [
      { nodeId: "147-431", label: "Divider / 分割线" },
      { nodeId: "147-430", label: "Divider 组件 frame" },
    ],
  },
  "15": {
    nodeId: "1-31",
    label: "15. Tag / 标签",
    extraNodes: [
      { nodeId: "119-789", label: "Tag / 标签" },
      { nodeId: "121-1771", label: "Tag 组件 frame" },
    ],
  },
};
