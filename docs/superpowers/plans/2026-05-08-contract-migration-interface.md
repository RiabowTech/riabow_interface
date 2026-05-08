# Contract Migration (Interface) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the interface side of the Primit→ZTDX contract integration: replace 2 conflicting ABIs, add 4 new ABIs, rename brand identifiers in `custom/contracts.ts`, rename env variables, and update Earn modal call sites.

**Architecture:** The interface mostly relies on backend-signed EIP-712 payloads (frontend doesn't construct typed-data for `releaseFunds`/`redeemReward`/`joinPlan` itself; backend signs and frontend forwards). So this PR is mostly: (a) ABI swaps so contract methods are callable, (b) brand-name rename in env/config, (c) Earn modals' inline ABIs updated to new method names. **Spot module is OUT of scope** (placeholder, no contract refs).

**Tech Stack:** TypeScript / Vite / wagmi / viem / ethers. Verification = `yarn tscheck` (with baseline error diff) + `yarn lint`.

**Spec:** [`backend/docs/superpowers/specs/2026-05-08-contract-config-migration-design.md`](../../../../backend/docs/superpowers/specs/2026-05-08-contract-config-migration-design.md) — §5 Frontend changes covers this side.

**Key facts confirmed against contract source (verified 2026-05-08, not assumed):**

- Vault `releaseFunds` typed-data: `ReleaseFunds(address account, uint256 value, uint256 nonce, uint256 deadline)` — backend signs, frontend never constructs
- RewardRouter `redeemReward` typed-data: `RedeemReward(address account, uint256 value, uint256 nonce, uint256 deadline)` — backend signs
- TermYield `joinPlan` typed-data: `JoinPlan(address account, uint256 planId, uint256 principalAmount, uint256 deadline)` — backend signs
- TermYield `joinPlan` function signature on chain: `joinPlan(uint256 planId, uint256 amount, uint256 deadline, bytes signature)` (note: param name in Solidity is `amount`; typed-data schema names it `principalAmount` — wire format unaffected)
- AffiliateRegistry: **no user-callable bind method**; `attachTraderCode` requires `HANDLER_ROLE` — bind flow goes through backend's `/referral/bind` endpoint (already implemented)
- Earn `cancelPlan` and `refundCancelledPlan` exist on contract but no frontend caller currently
- `emergencyClaim` does NOT exist on the new contract — must be removed from frontend ABI

---

## File Map

**Modify**
- `interface/src/shared/sdk/abis/Vault.ts` — replace contents (GMX v1 → ZtdxReserveVault)
- `interface/src/shared/sdk/abis/ReferralStorage.ts` — replace contents (old → AffiliateRegistry)
- `interface/src/shared/config/custom/contracts.ts` — full rename: constants, env vars, TRADING_CONTRACTS keys, getter functions, comments
- `interface/vite-env.d.ts` — env var type declarations rename
- `interface/.env.local.example` — env var rename + `0x0000…` placeholders
- `interface/.env.production.example` — same
- `interface/src/modules/lighter/features/earn/components/SubscriptionModal/SubscriptionModal.tsx` — inline EARN_ABI: `subscribe`→`joinPlan`, `productId`→`planId`
- `interface/src/modules/lighter/features/earn/components/ClaimModal/ClaimModal.tsx` — inline EARN_CLAIM_ABI: `claim`→`redeemPlan`, `getSubscription`→`getPlanPosition`, `productId`→`planId`, remove `emergencyClaim`

**Create**
- `interface/src/shared/sdk/abis/ZtdxRewardRouter.ts` — new ABI
- `interface/src/shared/sdk/abis/ZtdxTermYield.ts` — new ABI
- `interface/src/shared/sdk/abis/MockUSDT.ts` — new ABI for test-network collateral

**Delete**
- (none)

---

## Out of scope — explicit list

These appear in greps but should NOT be touched in this PR:

1. **`interface/src/modules/lighter/domain/referrals/hooks/index.ts`** — functions `setTraderReferralCodeByUser`, `registerReferralCode`, `setAffiliateTier`. These are GMX-era helpers that look up the GMX `ReferralStorage` contract via `getContract(chainId, "ReferralStorage")` (a different SDK config that points to GMX address `0xe6fab3f0…`, NOT the ZTDX AffiliateRegistry). Renaming methods here would break these calls because the GMX contract doesn't have `attachTraderCode` etc. The ZTDX bind flow uses backend `/referral/bind` instead. Mark these as legacy paths; clean up in a future PR if confirmed dead.

2. **`interface/src/shared/components/Referrals/JoinReferralCode.tsx`** and **`interface/src/modules/lighter/features/referrals/pages/Referrals/Referrals.tsx`** — call the legacy hooks above. Out of scope by transitivity.

3. **GMX-era ABI files** (`GLP*.ts`, `Synthetics*.ts`, `MultichainVault.ts`, etc.) — unused by ZTDX flow. Spec says "only animate conflicts" — those exact 2 (Vault.ts, ReferralStorage.ts) are the conflicts. The rest stay.

4. **Spot module** (`LighterSpotPage.tsx`) — placeholder, no contract refs; nothing to migrate.

5. **`src/shared/sdk/configs/contracts.ts`** addresses — these are GMX-era addresses for the GMX-era `getContract` SDK helper. Updating them would be a separate "retire-GMX-helpers" PR.

6. **`getTradingVaultAddress`, `getReferralRebateAddress`, `getEarnContractAddress`, `getTradingUsdtAddress`** function NAMES — kept as-is (no "Primit" in their identifier; renaming them would touch many call sites for no semantic gain).

---

## Tooling cheat-sheet

Run from `/Users/ubuntu/Desktop/ztdx/interface/`:

```bash
# Type check (slow first run, ~30s warm)
yarn tscheck 2>&1 | tail -5

# Diff against baseline (159 pre-existing errors saved at /tmp/tscheck-baseline.txt)
yarn tscheck 2>&1 | grep "error TS" | sort -u > /tmp/tscheck-current.txt
diff /tmp/tscheck-baseline.txt /tmp/tscheck-current.txt

# Lint
yarn lint 2>&1 | tail -10

# Build (slow ~2m; only run for whole-PR final review)
yarn build 2>&1 | tail -5
```

**The tscheck gate**: 159 pre-existing errors are baseline. Plan's gate is "no NEW errors introduced". Any task that adds a line to `/tmp/tscheck-current.txt` not in `/tmp/tscheck-baseline.txt` is a regression.

---

### Task 1: Pre-flight check (controller-side, no subagent)

**Files:** none

- [ ] **Step 1: Verify branch + tree**
  ```bash
  git -C /Users/ubuntu/Desktop/ztdx/interface rev-parse --abbrev-ref HEAD
  git -C /Users/ubuntu/Desktop/ztdx/interface status --short
  ```
  Expected: branch `feat/contract-migration-interface`, no output for status. If on main, `git checkout -b feat/contract-migration-interface main`.

- [ ] **Step 2: Verify baseline tscheck saved**
  ```bash
  wc -l /tmp/tscheck-baseline.txt
  ```
  Expected: 159 lines (the unique error set).

- [ ] **Step 3: node_modules present**
  ```bash
  ls /Users/ubuntu/Desktop/ztdx/interface/node_modules > /dev/null && echo "OK"
  ```
  If missing, `cd interface && yarn install --frozen-lockfile`.

---

### Task 2: ABI files — replace 2 + add 3

**Files:**
- Modify: `interface/src/shared/sdk/abis/Vault.ts` (replace GMX v1 ABI with ZtdxReserveVault ABI)
- Modify: `interface/src/shared/sdk/abis/ReferralStorage.ts` (replace old ABI with AffiliateRegistry ABI)
- Create: `interface/src/shared/sdk/abis/ZtdxRewardRouter.ts`
- Create: `interface/src/shared/sdk/abis/ZtdxTermYield.ts`
- Create: `interface/src/shared/sdk/abis/MockUSDT.ts`

Each file follows the existing pattern: `export default [ ...abi entries... ] as const;`

- [ ] **Step 1: Read contract source for each ABI**
  ```bash
  rg "function |event " /Users/ubuntu/Desktop/ztdx/ztdx_contract/vault_contract/src/ZtdxReserveVault.sol
  rg "function |event " /Users/ubuntu/Desktop/ztdx/ztdx_contract/rebate_contract/src/contracts/core/referral/ZtdxRewardRouter.sol
  rg "function |event " /Users/ubuntu/Desktop/ztdx/ztdx_contract/referral_storage_contract/src/contracts/referral/AffiliateRegistry.sol
  rg "function |event " /Users/ubuntu/Desktop/ztdx/ztdx_contract/earn_contract/src/ZtdxTermYield.sol
  rg "function |event " /Users/ubuntu/Desktop/ztdx/ztdx_contract/earn_contract/src/MockUSDT.sol
  ```
  Use the listed function/event signatures. The minimum subset to include is whatever the frontend would plausibly call/listen to; YAGNI past that is fine. Recommended minimum sets:

  **Vault.ts (ZtdxReserveVault)** — replace contents with:
  ```typescript
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
  ```

  **ReferralStorage.ts (AffiliateRegistry)** — replace contents with the AffiliateRegistry interface (`createAffiliateCode`, `attachTraderCode`, `codeOwnerOf`, `traderCodeOf`, `affiliateTiers`, `tierSettings`, `resolveTraderAffiliate`, `configureTier`, `assignAffiliateTier`, plus events `AffiliateCodeCreated`, `TraderAffiliateAttached`, `AffiliateTierConfigured`, `AffiliateTierAssigned`). Use existing file's format for entries; one event sample:
  ```typescript
  { name: "AffiliateCodeCreated", type: "event", inputs: [
      { name: "code", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true }
    ], anonymous: false },
  ```

  **ZtdxRewardRouter.ts (NEW file)** — frontend signing flow uses backend; minimum viable set:
  ```typescript
  export default [
    { name: "redeemReward", type: "function", inputs: [
        { name: "amount", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "signature", type: "bytes" }
      ], outputs: [], stateMutability: "nonpayable" },
    { name: "rewardAccountInfo", type: "function", inputs: [
        { name: "user", type: "address" }
      ], outputs: [
        { name: "redeemed", type: "uint256" },
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
  ```

  **ZtdxTermYield.ts (NEW file)** — minimum viable:
  ```typescript
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
  ```

  **MockUSDT.ts (NEW file)** — standard ERC20 + a mint/burn function (test only):
  ```typescript
  export default [
    { name: "decimals", type: "function", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
    { name: "balanceOf", type: "function", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
    { name: "approve", type: "function", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
    { name: "transfer", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }], stateMutability: "nonpayable" },
    { name: "allowance", type: "function", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
    { name: "mint", type: "function", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  ] as const;
  ```

  If any of these recommended subsets is missing a method that a real call site needs (revealed by tscheck or the Earn modal task), expand the relevant ABI accordingly — that's expected.

- [ ] **Step 2: Replace `Vault.ts`**
  Open `interface/src/shared/sdk/abis/Vault.ts`. Replace ALL existing content (the GMX v1 ABI starting with `BuyUSDG` etc.) with the ZtdxReserveVault block above.

- [ ] **Step 3: Replace `ReferralStorage.ts`**
  Open `interface/src/shared/sdk/abis/ReferralStorage.ts`. Replace ALL existing content with the AffiliateRegistry ABI.

- [ ] **Step 4: Create the 3 new files**
  Each with `export default [ ... ] as const;` per blocks above.

- [ ] **Step 5: Run tscheck**
  ```bash
  cd /Users/ubuntu/Desktop/ztdx/interface && yarn tscheck 2>&1 | grep "error TS" | sort -u > /tmp/tscheck-current.txt
  diff /tmp/tscheck-baseline.txt /tmp/tscheck-current.txt
  ```
  Expected: empty diff (no new errors). New errors are likely if the GMX `Vault.ts` had types that other files imported by-name (e.g., `BuyUSDGEvent`); that's OK to surface — fix the imports or accept the small additional errors.

  **If new errors appear** because GMX-era code imports specific function/event names from the old `Vault.ts`/`ReferralStorage.ts`: those are the "GMX-era code paths" listed as out-of-scope. The implementer SHOULD NOT fix the GMX code; instead, document the new errors in the task report and note they're caused by removing GMX-era ABI exports. The whole-PR final review will confirm these are GMX-related and acceptable, OR the user can decide to add a follow-up task.

- [ ] **Step 6: Commit**
  ```bash
  git -C /Users/ubuntu/Desktop/ztdx/interface add src/shared/sdk/abis/Vault.ts src/shared/sdk/abis/ReferralStorage.ts src/shared/sdk/abis/ZtdxRewardRouter.ts src/shared/sdk/abis/ZtdxTermYield.ts src/shared/sdk/abis/MockUSDT.ts
  git -C /Users/ubuntu/Desktop/ztdx/interface commit -m "feat(abi): replace Vault/ReferralStorage with ZTDX contract ABIs and add new ABIs"
  ```

---

### Task 3: Rename `custom/contracts.ts`

**Files:**
- Modify: `interface/src/shared/config/custom/contracts.ts`

This is a centralized config — touching many constants/keys/functions. Whole-file rename pass.

- [ ] **Step 1: Identifier rename pass**

  In `interface/src/shared/config/custom/contracts.ts`, apply these renames:

  **Constants (L16-23):**
  ```typescript
  // OLD
  const PRIMIT_VAULT_PROXY = ...;
  const PRIMIT_REBATE_PROXY = ...;
  const PRIMIT_EARN_PROXY = ...;
  const PRIMIT_USDT = ...;

  // NEW
  const ZTDX_VAULT_PROXY =
    (import.meta.env.VITE_ZTDX_VAULT_PROXY as string | undefined) || "0x0000000000000000000000000000000000000000";
  const ZTDX_REBATE_PROXY =
    (import.meta.env.VITE_ZTDX_REBATE_PROXY as string | undefined) || "0x0000000000000000000000000000000000000000";
  const ZTDX_EARN_PROXY =
    (import.meta.env.VITE_ZTDX_EARN_PROXY as string | undefined) || "0x0000000000000000000000000000000000000000";
  const ZTDX_USDT =
    (import.meta.env.VITE_ZTDX_USDT as string | undefined) || "0x0000000000000000000000000000000000000000";
  ```

  Replace all 4 default fallback addresses with `0x0000…0000` per spec's placeholder strategy. The existing `0x27671c…` etc. addresses get overwritten; deployment fills env vars with real addresses.

  **TRADING_CONTRACTS keys (L37-50):**
  ```typescript
  // OLD
  PRIMIT_VAULT: PRIMIT_VAULT_PROXY,
  REFERRAL_REBATE: PRIMIT_REBATE_PROXY,
  EARN: PRIMIT_EARN_PROXY,

  // NEW
  ZTDX_VAULT: ZTDX_VAULT_PROXY,
  REFERRAL_REBATE: ZTDX_REBATE_PROXY,  // key stays — only constant rename
  EARN: ZTDX_EARN_PROXY,                // key stays
  USDT: ZTDX_USDT,                      // key stays
  ```

  Only `PRIMIT_VAULT` key has "Primit" in it; rename to `ZTDX_VAULT`. Other keys (`REFERRAL_REBATE`, `EARN`, `USDT`) stay.

  **Getter function update (L109-111):**
  ```typescript
  // OLD
  export function getTradingVaultAddress(chainId: number): string | undefined {
    return TRADING_CONTRACTS[chainId as keyof typeof TRADING_CONTRACTS]?.PRIMIT_VAULT;
  }

  // NEW
  export function getTradingVaultAddress(chainId: number): string | undefined {
    return TRADING_CONTRACTS[chainId as keyof typeof TRADING_CONTRACTS]?.ZTDX_VAULT;
  }
  ```

  Function name `getTradingVaultAddress` stays (no "Primit" in it). Only the key lookup changes.

  **JSDoc comment (L9-15):**
  ```typescript
  // OLD
  * 主网 ARBITRUM 的 ZTDX 代理合约地址支持从 .env 覆盖,便于部署/灰度切换而不改代码:
  *   VITE_PRIMIT_VAULT_PROXY   → PRIMIT_VAULT
  *   VITE_PRIMIT_REBATE_PROXY  → REFERRAL_REBATE
  *   VITE_PRIMIT_EARN_PROXY    → EARN
  * 没配置时回退到下面的默认值(当前版本上线时已部署的 v5 代理)。

  // NEW
  * ZTDX 代理合约地址从 .env 覆盖,便于部署/灰度切换而不改代码:
  *   VITE_ZTDX_VAULT_PROXY  → ZTDX_VAULT
  *   VITE_ZTDX_REBATE_PROXY → REFERRAL_REBATE
  *   VITE_ZTDX_EARN_PROXY   → ZTDX_EARN_PROXY
  *   VITE_ZTDX_USDT         → USDT
  * 没配置时回退到 0x0000…0000 占位 (部署时通过 .env 填充实际地址)。
  ```

  **MARKET_SYMBOL_TO_ADDRESS** (L58-80) — `"PRIMIT-USD"` and `PRIMITUSDT` keys are market-symbol strings used by API adapters. They might map to specific market contract addresses for testnet. **Keep these unchanged** — they're business symbols, not brand identifiers (renaming would break market lookup logic until backend also renames the symbol). If you're unsure, leave them and flag in the task report.

- [ ] **Step 2: Run tscheck diff**
  ```bash
  cd /Users/ubuntu/Desktop/ztdx/interface && yarn tscheck 2>&1 | grep "error TS" | sort -u > /tmp/tscheck-current.txt
  diff /tmp/tscheck-baseline.txt /tmp/tscheck-current.txt
  ```
  Expected: empty diff. If new errors arise (e.g., `Property 'PRIMIT_VAULT' does not exist on type ...`), grep for stale references:
  ```bash
  rg "PRIMIT_VAULT|PRIMIT_REBATE_PROXY|PRIMIT_EARN_PROXY|PRIMIT_USDT|PRIMIT_VAULT_PROXY" interface/src
  ```
  Each hit needs renaming. Common locations: API adapters, hooks calling `TRADING_CONTRACTS[chainId].PRIMIT_VAULT` directly.

- [ ] **Step 3: Cleanup pass — search for stale brand strings**
  ```bash
  cd /Users/ubuntu/Desktop/ztdx/interface
  rg "Primit Vault|Primit Rebate|Primit Earn|Primit Points" src
  rg "VITE_PRIMIT_" src
  rg "PRIMIT_VAULT_PROXY|PRIMIT_REBATE_PROXY|PRIMIT_EARN_PROXY|PRIMIT_USDT\b" src
  ```
  All three should return 0 hits in `src/` after this task.

- [ ] **Step 4: Commit**
  ```bash
  git -C /Users/ubuntu/Desktop/ztdx/interface add src/shared/config/custom/contracts.ts
  git -C /Users/ubuntu/Desktop/ztdx/interface commit -m "feat(config): rebrand custom/contracts.ts identifiers Primit → ZTDX"
  ```

---

### Task 4: Env var rename

**Files:**
- Modify: `interface/vite-env.d.ts` (env var type declarations)
- Modify: `interface/.env.local.example`
- Modify: `interface/.env.production.example`

- [ ] **Step 1: Update `vite-env.d.ts`**
  Find the block declaring `VITE_PRIMIT_*` (around lines 44-47 per the recon). Replace each:
  ```typescript
  // OLD
  readonly VITE_PRIMIT_VAULT_PROXY: string;
  readonly VITE_PRIMIT_REBATE_PROXY: string;
  readonly VITE_PRIMIT_EARN_PROXY: string;
  readonly VITE_PRIMIT_APP_ORIGIN: string;

  // NEW
  readonly VITE_ZTDX_VAULT_PROXY: string;
  readonly VITE_ZTDX_REBATE_PROXY: string;
  readonly VITE_ZTDX_EARN_PROXY: string;
  readonly VITE_ZTDX_USDT: string;       // ADD - was missing from old declarations
  readonly VITE_ZTDX_APP_ORIGIN: string; // already exists; ensure both old and new available, or consolidate
  ```

  The recon mentioned `VITE_PRIMIT_APP_ORIGIN` falls back to `VITE_ZTDX_APP_ORIGIN` in `links.ts` already. Since we're going hard-switchover, **drop `VITE_PRIMIT_APP_ORIGIN`** entirely from this file; ensure `links.ts` no longer references it (Step 1.5 below).

- [ ] **Step 1.5: Drop `VITE_PRIMIT_APP_ORIGIN` from `links.ts`**
  ```bash
  grep -n "VITE_PRIMIT_APP_ORIGIN\|VITE_ZTDX_APP_ORIGIN" interface/src/shared/config/links.ts
  ```
  If `links.ts` reads `VITE_PRIMIT_APP_ORIGIN ?? VITE_ZTDX_APP_ORIGIN`, change to use ONLY `VITE_ZTDX_APP_ORIGIN`. Drop the fallback. (Per spec: hard switchover, no backwards-compat fallbacks.)

- [ ] **Step 2: Update `.env.local.example`**
  Replace each `VITE_PRIMIT_*=` line:
  ```
  # OLD
  VITE_PRIMIT_REBATE_PROXY=0x630500A1f46e88f37F1979DB70fE8d768709cb93
  VITE_PRIMIT_VAULT_PROXY=0x10BD9b5deaa4357048B95B24e5b3d3CfDAd6606A
  VITE_PRIMIT_EARN_PROXY=0x63A141CDAf78db3Ca08a7D64bd215E86F780492b

  # NEW (placeholders per spec; deployment fills real addresses)
  VITE_ZTDX_VAULT_PROXY=0x0000000000000000000000000000000000000000
  VITE_ZTDX_REBATE_PROXY=0x0000000000000000000000000000000000000000
  VITE_ZTDX_EARN_PROXY=0x0000000000000000000000000000000000000000
  VITE_ZTDX_USDT=0x0000000000000000000000000000000000000000
  VITE_ZTDX_APP_ORIGIN=http://localhost:3012
  ```

  Add a comment at top of contract block explaining "deployment fills real addresses".

- [ ] **Step 3: Update `.env.production.example`**
  Same rename pattern as Step 2. Use `https://app.ztdx.io` (or similar) for `VITE_ZTDX_APP_ORIGIN` if a production-style placeholder is needed; otherwise use `<your-prod-origin>`.

- [ ] **Step 4: Verify**
  ```bash
  cd /Users/ubuntu/Desktop/ztdx/interface
  rg "VITE_PRIMIT_" .
  ```
  Expected: 0 hits (after also touching links.ts).

  ```bash
  yarn tscheck 2>&1 | grep "error TS" | sort -u > /tmp/tscheck-current.txt
  diff /tmp/tscheck-baseline.txt /tmp/tscheck-current.txt
  ```
  Expected: empty diff. (`vite-env.d.ts` rename + Task 3's `import.meta.env.VITE_ZTDX_*` reads should match.)

- [ ] **Step 5: Commit**
  ```bash
  git -C /Users/ubuntu/Desktop/ztdx/interface add vite-env.d.ts .env.local.example .env.production.example src/shared/config/links.ts
  git -C /Users/ubuntu/Desktop/ztdx/interface commit -m "feat(env): rename VITE_PRIMIT_* env vars to VITE_ZTDX_* with placeholder addresses"
  ```

---

### Task 5: Earn `SubscriptionModal` — `subscribe` → `joinPlan`

**Files:**
- Modify: `interface/src/modules/lighter/features/earn/components/SubscriptionModal/SubscriptionModal.tsx`

- [ ] **Step 1: Replace inline `EARN_ABI`**
  Around lines 46-66, replace:
  ```typescript
  const EARN_ABI = [
    {
      name: "subscribe",
      type: "function",
      inputs: [
        { name: "productId", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "signature", type: "bytes" },
      ],
      outputs: [],
    },
    {
      name: "usdtToken",
      type: "function",
      inputs: [],
      outputs: [{ type: "address" }],
      stateMutability: "view",
    },
  ] as const;
  ```
  with:
  ```typescript
  const EARN_ABI = [
    {
      name: "joinPlan",
      type: "function",
      inputs: [
        { name: "planId", type: "uint256" },
        { name: "amount", type: "uint256" },
        { name: "deadline", type: "uint256" },
        { name: "signature", type: "bytes" },
      ],
      outputs: [],
      stateMutability: "nonpayable",
    },
  ] as const;
  ```

  **Drop the `usdtToken` entry**: the new ZtdxTermYield contract takes the USDT address as an init parameter, not via a `usdtToken()` getter. If the modal calls `usdtToken()` anywhere (search with `rg "usdtToken" SubscriptionModal.tsx`), replace with `getTradingUsdtAddress(chainId)` from `src/shared/config/custom/contracts.ts`. If no caller, just drop the entry.

- [ ] **Step 2: Update method calls in the component**
  Find all `functionName: "subscribe"` references (around L289, L310). Replace with `functionName: "joinPlan"`.

  Find all references to `productId` in the call args (around L277, L289). The variable name in TypeScript can stay (`productId` as a variable) since it holds a value the backend gives us. But the ABI parameter name is now `planId`. The viem `writeContract` uses positional args, so just ensure the variable name `productId` still holds the same value the backend returned.

  Actually: search for `productId:` (object literal field) or `productId =` (variable name). For style consistency post-rename, **rename the local TypeScript variable** `productId` → `planId` in this file. This is a cosmetic improvement.

  Search and replace:
  ```bash
  grep -n "productId" SubscriptionModal.tsx
  ```
  Each hit: rename to `planId` if it's a local variable / argument. If it's a struct field name from a backend response type (e.g., `EarnSubscribePrepareResponse`), check if backend's response field is renamed (it shouldn't be — backend kept JSON wire format).

  **If backend response uses `product_id` or `productId` field name**: the local destructure can rename via `const { product_id: planId } = response;`. **Do NOT change the wire format expected from backend.**

- [ ] **Step 3: Update log/comment strings**
  ```bash
  grep -n "subscribe transaction\|subscribe function\|approve + subscribe\|subscribed amount" SubscriptionModal.tsx
  ```
  Update narrative strings ("Estimate gas for a subscribe transaction" → "Estimate gas for a joinPlan transaction") for consistency. UI-visible strings (button labels users see) — verify they don't say "subscribe" in a user-facing way; if they do, leave alone (UI copy is product/UX decision, not in our scope).

- [ ] **Step 4: tscheck**
  ```bash
  cd /Users/ubuntu/Desktop/ztdx/interface && yarn tscheck 2>&1 | grep "error TS" | sort -u > /tmp/tscheck-current.txt
  diff /tmp/tscheck-baseline.txt /tmp/tscheck-current.txt
  ```
  Empty diff expected.

- [ ] **Step 5: Commit**
  ```bash
  git -C /Users/ubuntu/Desktop/ztdx/interface add src/modules/lighter/features/earn/components/SubscriptionModal/SubscriptionModal.tsx
  git -C /Users/ubuntu/Desktop/ztdx/interface commit -m "feat(earn-modal): migrate SubscriptionModal subscribe → joinPlan ABI"
  ```

---

### Task 6: Earn `ClaimModal` — `claim` → `redeemPlan`, `getSubscription` → `getPlanPosition`

**Files:**
- Modify: `interface/src/modules/lighter/features/earn/components/ClaimModal/ClaimModal.tsx`

- [ ] **Step 1: Replace inline `EARN_CLAIM_ABI`**
  Around lines 28-60, replace:
  ```typescript
  const EARN_CLAIM_ABI = [
    {
      name: "claim",
      type: "function",
      inputs: [{ name: "productId", type: "uint256" }],
      outputs: [],
    },
    {
      name: "emergencyClaim",
      type: "function",
      inputs: [{ name: "productId", type: "uint256" }],
      outputs: [],
    },
    {
      name: "getSubscription",
      type: "function",
      inputs: [
        { name: "productId", type: "uint256" },
        { name: "user", type: "address" },
      ],
      outputs: [
        { name: "amount", type: "uint256" },
        { name: "expectedReturn", type: "uint256" },
        { name: "actualReturn", type: "uint256" },
        { name: "subscribedAt", type: "uint256" },
        { name: "claimed", type: "bool" },
      ],
      stateMutability: "view",
    },
  ] as const;
  ```
  with:
  ```typescript
  const EARN_CLAIM_ABI = [
    {
      name: "redeemPlan",
      type: "function",
      inputs: [{ name: "planId", type: "uint256" }],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      name: "getPlanPosition",
      type: "function",
      inputs: [
        { name: "planId", type: "uint256" },
        { name: "user", type: "address" },
      ],
      outputs: [
        { name: "amount", type: "uint256" },
        { name: "expectedReturn", type: "uint256" },
        { name: "actualReturn", type: "uint256" },
        { name: "subscribedAt", type: "uint256" },
        { name: "claimed", type: "bool" },
      ],
      stateMutability: "view",
    },
  ] as const;
  ```

  **Note**: `emergencyClaim` is removed — the new ZtdxTermYield contract has `cancelPlan(planId)` and `refundCancelledPlan(planId)` for similar disaster recovery, but they're admin-only (different semantics). The user-facing `emergencyClaim` is gone.

- [ ] **Step 2: Update method calls**
  ```
  L142: functionName: "getSubscription" → "getPlanPosition"
  L165: functionName: "claim" → "redeemPlan"
  L190: functionName: "claim" → "redeemPlan"
  ```

  Also update the comment on L138 (`// Check if user has subscription and hasn't claimed yet`) to "Check if user has plan position and hasn't redeemed yet".

- [ ] **Step 3: Handle `emergencyClaim` callers**
  ```bash
  grep -n "emergencyClaim" interface/src/modules/lighter/features/earn/components/ClaimModal/ClaimModal.tsx
  ```
  If still 1+ hit (other than the deleted ABI entry), there's a UI button or fallback flow that called it. Decide:
  - If it's wired to a button that's only shown in disaster scenarios → comment out the button + log a warning, OR delete it entirely (UI cleanup pass)
  - If it's in `try/catch` fallback logic → replace with no-op + comment

  Whatever the choice, the implementer should report it (DONE_WITH_CONCERNS) so the user can confirm UX implication.

- [ ] **Step 4: Variable rename `productId` → `planId`** (style consistency)
  ```bash
  grep -n "productId" interface/src/modules/lighter/features/earn/components/ClaimModal/ClaimModal.tsx
  ```
  Same approach as Task 5 Step 2.

- [ ] **Step 5: tscheck**
  ```bash
  cd /Users/ubuntu/Desktop/ztdx/interface && yarn tscheck 2>&1 | grep "error TS" | sort -u > /tmp/tscheck-current.txt
  diff /tmp/tscheck-baseline.txt /tmp/tscheck-current.txt
  ```
  Empty diff.

- [ ] **Step 6: Commit**
  ```bash
  git -C /Users/ubuntu/Desktop/ztdx/interface add src/modules/lighter/features/earn/components/ClaimModal/ClaimModal.tsx
  git -C /Users/ubuntu/Desktop/ztdx/interface commit -m "feat(earn-modal): migrate ClaimModal claim → redeemPlan, drop emergencyClaim"
  ```

---

### Task 7: Final acceptance + push + PR

- [ ] **Step 1: Final negative-grep sweep**
  ```bash
  cd /Users/ubuntu/Desktop/ztdx/interface
  echo "=== A: Primit brand literals ===" && rg "Primit Vault|Primit Rebate|Primit Earn|Primit Points|VITE_PRIMIT_" src vite-env.d.ts .env.local.example .env.production.example
  echo "=== B: Primit identifier prefix ===" && rg "PRIMIT_VAULT_PROXY|PRIMIT_REBATE_PROXY|PRIMIT_EARN_PROXY|PRIMIT_USDT\b" src
  echo "=== C: Old contract methods (Earn) ===" && rg "EARN_ABI.*subscribe|EARN_CLAIM_ABI.*claim\b|emergencyClaim" src
  echo "=== D: Old typed-data primary types ===" && rg "primaryType.*\"Subscribe\"|primaryType.*\"ClaimRebate\"|primaryType.*\"Withdraw\"" src
  echo "=== ALL DONE ==="
  ```

  Expected:
  - A: 0 hits
  - B: 0 hits
  - C: 0 hits
  - D: 0 hits (the spec's `Subscribe`/`ClaimRebate`/`Withdraw` primary types are backend-signed; frontend never declares these as `primaryType`. If any hit appears, that's a code path doing client-side typed-data construction that needs migration.)

- [ ] **Step 2: tscheck baseline diff**
  ```bash
  yarn tscheck 2>&1 | grep "error TS" | sort -u > /tmp/tscheck-current.txt
  diff /tmp/tscheck-baseline.txt /tmp/tscheck-current.txt | head -30
  ```
  Expected: empty diff. If non-empty:
  - New errors caused by removing GMX-era exports from old `Vault.ts`/`ReferralStorage.ts` → expected, document in PR
  - Other new errors → fix per task

- [ ] **Step 3: lint**
  ```bash
  yarn lint 2>&1 | tail -5
  ```
  No new errors.

- [ ] **Step 4: Build smoke**
  ```bash
  yarn build 2>&1 | tail -10
  ```
  Build succeeds. (Vite catches things tsc doesn't, like unresolved imports.) ~2 min.

- [ ] **Step 5: Push**
  ```bash
  git -C /Users/ubuntu/Desktop/ztdx/interface push -u origin feat/contract-migration-interface
  ```

- [ ] **Step 6: Surface PR link**
  Print `https://github.com/ztdx-iov2/interface/pull/new/feat/contract-migration-interface` and provide PR description draft including:
  - Spec link
  - Plan link
  - Out-of-scope notes (GMX-era helpers, GLP/Synthetics ABIs)
  - Deployment-followup: env vars `VITE_ZTDX_*` must be set in deployment env to real addresses post-merge

---

## Self-review checklist (run by implementer at the end)

- [ ] Task 2: All 5 ABI files exist with the documented function/event subsets.
- [ ] Task 3: `custom/contracts.ts` has 0 `PRIMIT_*` identifiers.
- [ ] Task 4: 0 `VITE_PRIMIT_*` references in any tracked file.
- [ ] Task 5+6: Earn modals use new method names; `emergencyClaim` is removed.
- [ ] Task 7: tscheck baseline diff is empty.
- [ ] No HTTP route URLs touched (frontend doesn't have routes — N/A).
- [ ] No JSON wire format field names changed (struct destructures use `: localName` aliasing if needed).
- [ ] Single-purpose commits per task.

---

## Out-of-scope reminders (per spec)

- DO NOT touch `interface/src/modules/lighter/domain/referrals/hooks/index.ts` — GMX-era helpers, separate cleanup PR.
- DO NOT touch GMX-era ABI files (`GLP*.ts`, `Synthetics*.ts`, etc.) — unused by ZTDX.
- DO NOT change `src/shared/sdk/configs/contracts.ts` addresses — GMX-era SDK helper, separate retire-GMX PR.
- DO NOT change function names like `getTradingVaultAddress` — internal helper, no "Primit" in name.
- Spot module is placeholder — nothing to migrate.

---

## Risks

| Risk | Mitigation |
|---|---|
| Removing GMX exports from `Vault.ts`/`ReferralStorage.ts` causes downstream tscheck errors in unrelated GMX code paths | Spec scopes "fix GMX path" out of this PR; document errors in PR description; user can decide follow-up |
| `emergencyClaim` removal breaks UI button | Step 6.3 surfaces this; if button exists, propose follow-up UX change |
| Env var rename forces deployment env update | Documented in PR description; deployment checklist already lists `VITE_ZTDX_*` |
| `MARKET_SYMBOL_TO_ADDRESS` still has `PRIMIT-USD` / `PRIMITUSDT` symbols | Out of scope — these are business symbols, not brand identifiers |

**Rollback**: `git revert <PR>`. Frontend has no live users on these contracts (ABIs swapped means old GMX-flow ABIs are gone — but those flows are separate from ZTDX flow). Risk is low.
