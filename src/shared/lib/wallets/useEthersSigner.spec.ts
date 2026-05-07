import { beforeEach, describe, expect, it, vi } from "vitest";

const browserProviderMock = vi.fn();
const uncheckedSignerMock = vi.fn();

vi.mock("ethers", () => ({
  ethers: {
    BrowserProvider: browserProviderMock,
  },
}));

vi.mock("lib/rpc/UncheckedJsonRpcSigner", () => ({
  UncheckedJsonRpcSigner: uncheckedSignerMock,
}));

describe("clientToSigner", () => {
  beforeEach(() => {
    browserProviderMock.mockReset();
    uncheckedSignerMock.mockReset();
    browserProviderMock.mockImplementation((transport, network) => ({ transport, network }));
    uncheckedSignerMock.mockImplementation((provider, account) => ({ provider, account }));
  });

  it("uses the client chain when present", async () => {
    const { clientToSigner } = await import("./useEthersSigner");

    const signer = clientToSigner(
      {
        chain: {
          id: 42161,
          name: "Arbitrum",
          contracts: {
            ensRegistry: { address: "0x0000000000000000000000000000000000000001" },
          },
        },
        transport: { type: "fallback" },
      } as any,
      "0x0000000000000000000000000000000000000002"
    );

    expect(signer.address).toBe("0x0000000000000000000000000000000000000002");
    expect(browserProviderMock).toHaveBeenCalledWith(
      { type: "fallback" },
      {
        chainId: 42161,
        name: "Arbitrum",
        ensAddress: "0x0000000000000000000000000000000000000001",
      }
    );
  });

  it("falls back to an explicit chain when wallet client chain is missing", async () => {
    const { clientToSigner } = await import("./useEthersSigner");

    expect(() =>
      clientToSigner(
        {
          chain: undefined,
          transport: { type: "fallback" },
        } as any,
        "0x0000000000000000000000000000000000000002",
        {
          id: 42161,
          name: "Arbitrum",
          contracts: {
            ensRegistry: { address: "0x0000000000000000000000000000000000000001" },
          },
        } as any
      )
    ).not.toThrow();
  });
});
