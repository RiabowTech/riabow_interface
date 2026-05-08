export default [
  { name: "redeemReward", type: "function", inputs: [
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "rewardAccountInfo", type: "function", inputs: [
      { name: "user", type: "address" }
    ], outputs: [
      { name: "claimed", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "affiliateCode", type: "bytes32" },
      { name: "affiliate", type: "address" },
      { name: "tierLevel", type: "uint256" }
    ], stateMutability: "view" },
  { name: "rewardNonces", type: "function", inputs: [
      { name: "user", type: "address" }
    ], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "RewardRedeemed", type: "event", inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "nonce", type: "uint256", indexed: false }
    ], anonymous: false },
] as const;
