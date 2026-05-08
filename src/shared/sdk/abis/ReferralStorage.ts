export default [
  { name: "createAffiliateCode", type: "function", inputs: [
      { name: "code", type: "bytes32" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "attachTraderCode", type: "function", inputs: [
      { name: "account", type: "address" },
      { name: "code", type: "bytes32" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "configureTier", type: "function", inputs: [
      { name: "tierId", type: "uint256" },
      { name: "totalRebate", type: "uint256" },
      { name: "discountShare", type: "uint256" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "assignAffiliateTier", type: "function", inputs: [
      { name: "referrer", type: "address" },
      { name: "tierId", type: "uint256" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "codeOwnerOf", type: "function", inputs: [
      { name: "code", type: "bytes32" }
    ], outputs: [{ type: "address" }], stateMutability: "view" },
  { name: "traderCodeOf", type: "function", inputs: [
      { name: "account", type: "address" }
    ], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  { name: "affiliateTiers", type: "function", inputs: [
      { name: "account", type: "address" }
    ], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "affiliateDiscountShares", type: "function", inputs: [
      { name: "account", type: "address" }
    ], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "tierSettings", type: "function", inputs: [
      { name: "tierLevel", type: "uint256" }
    ], outputs: [
      { name: "totalRebate", type: "uint256" },
      { name: "discountShare", type: "uint256" }
    ], stateMutability: "view" },
  { name: "resolveTraderAffiliate", type: "function", inputs: [
      { name: "account", type: "address" }
    ], outputs: [
      { name: "code", type: "bytes32" },
      { name: "affiliate", type: "address" }
    ], stateMutability: "view" },
  { name: "AffiliateCodeCreated", type: "event", inputs: [
      { name: "code", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true }
    ], anonymous: false },
  { name: "TraderAffiliateAttached", type: "event", inputs: [
      { name: "trader", type: "address", indexed: true },
      { name: "code", type: "bytes32", indexed: true },
      { name: "referrer", type: "address", indexed: true }
    ], anonymous: false },
  { name: "AffiliateTierConfigured", type: "event", inputs: [
      { name: "tierId", type: "uint256", indexed: true },
      { name: "totalRebate", type: "uint256", indexed: false },
      { name: "discountShare", type: "uint256", indexed: false }
    ], anonymous: false },
  { name: "AffiliateTierAssigned", type: "event", inputs: [
      { name: "referrer", type: "address", indexed: true },
      { name: "tierId", type: "uint256", indexed: true }
    ], anonymous: false },
] as const;
