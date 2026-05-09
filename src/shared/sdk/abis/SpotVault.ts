export default [
  {
    name: "deposit",
    type: "function",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "depositNative",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
  {
    name: "withdraw",
    type: "function",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "releaseNonces",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "SpotDeposit",
    type: "event",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    name: "SpotWithdrawal",
    type: "event",
    inputs: [
      { name: "account", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "nonce", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  { name: "InvalidSignature", type: "error", inputs: [] },
  { name: "NativeTransferFailed", type: "error", inputs: [] },
  { name: "ZeroAddress", type: "error", inputs: [] },
  { name: "ZeroAmount", type: "error", inputs: [] },
  { name: "EmptyDomainName", type: "error", inputs: [] },
  { name: "EmptyDomainVersion", type: "error", inputs: [] },
  {
    name: "TokenNotRegistered",
    type: "error",
    inputs: [{ name: "token", type: "address" }],
  },
  {
    name: "InsufficientVaultBalance",
    type: "error",
    inputs: [
      { name: "token", type: "address" },
      { name: "requested", type: "uint256" },
      { name: "available", type: "uint256" },
    ],
  },
  {
    name: "SignatureExpired",
    type: "error",
    inputs: [
      { name: "deadline", type: "uint256" },
      { name: "currentTime", type: "uint256" },
    ],
  },
] as const;
