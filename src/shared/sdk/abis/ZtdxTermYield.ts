export default [
  { name: "joinPlan", type: "function", inputs: [
      { name: "planId", type: "uint256" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "redeemPlan", type: "function", inputs: [
      { name: "planId", type: "uint256" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "getPlanConfig", type: "function", inputs: [
      { name: "planId", type: "uint256" }
    ], outputs: [
      { name: "name", type: "string" },
      { name: "maxAnnualRateBps", type: "uint256" },
      { name: "durationSeconds", type: "uint256" },
      { name: "totalQuota", type: "uint256" },
      { name: "minAmount", type: "uint256" },
      { name: "maxAmountPerUser", type: "uint256" }
    ], stateMutability: "view" },
  { name: "getPlanPosition", type: "function", inputs: [
      { name: "planId", type: "uint256" },
      { name: "user", type: "address" }
    ], outputs: [
      { name: "amount", type: "uint256" },
      { name: "expectedReturn", type: "uint256" },
      { name: "actualReturn", type: "uint256" },
      { name: "subscribedAt", type: "uint256" },
      { name: "claimed", type: "bool" }
    ], stateMutability: "view" },
  { name: "PlanJoined", type: "event", inputs: [
      { name: "planId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "expectedReturn", type: "uint256", indexed: false }
    ], anonymous: false },
  { name: "PlanRedeemed", type: "event", inputs: [
      { name: "planId", type: "uint256", indexed: true },
      { name: "user", type: "address", indexed: true },
      { name: "principal", type: "uint256", indexed: false },
      { name: "interest", type: "uint256", indexed: false }
    ], anonymous: false },
] as const;
