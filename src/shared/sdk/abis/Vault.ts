export default [
  { name: "fundAccount", type: "function", inputs: [
      { name: "amount", type: "uint256" },
      { name: "referralCode", type: "bytes32" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "releaseFunds", type: "function", inputs: [
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "bindAffiliateCode", type: "function", inputs: [
      { name: "code", type: "bytes32" }
    ], outputs: [], stateMutability: "nonpayable" },
  { name: "accountLiquidity", type: "function", inputs: [
      { name: "user", type: "address" }
    ], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "releaseNonces", type: "function", inputs: [
      { name: "user", type: "address" }
    ], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "AccountFunded", type: "event", inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "referralCode", type: "bytes32", indexed: false }
    ], anonymous: false },
  { name: "FundsReleased", type: "event", inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "nonce", type: "uint256", indexed: false }
    ], anonymous: false },
  { name: "AffiliateCodeBound", type: "event", inputs: [
      { name: "user", type: "address", indexed: true },
      { name: "code", type: "bytes32", indexed: true },
      { name: "referrer", type: "address", indexed: true }
    ], anonymous: false },
] as const;
