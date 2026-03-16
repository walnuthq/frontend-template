import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@miden-sdk/react", () => import("@/__tests__/mocks/miden-sdk-react"));
vi.mock("@miden-sdk/miden-wallet-adapter", () => ({
  Transaction: {
    createCustomTransaction: vi.fn(),
  },
}));
vi.mock("@miden-sdk/miden-wallet-adapter-react", () => ({
  useMidenFiWallet: vi.fn(),
}));

import { useMiden, useNotes, useSyncState } from "@miden-sdk/react";
import { useMidenFiWallet } from "@miden-sdk/miden-wallet-adapter-react";
import { SENT_MESSAGES_STORAGE_KEY } from "@/config";
import type { SentMessageRecord } from "@/lib/messenger";
import { useMessenger } from "../useMessenger";

describe("useMessenger", () => {
  const addTag = vi.fn(async () => undefined);
  const listTags = vi.fn(async () => ["404"]);
  const insertAccountAddress = vi.fn(async () => undefined);
  const importAccountById = vi.fn(async () => undefined);
  const getAccounts = vi.fn(async () => []);
  const getAccount = vi.fn(async () => undefined);
  const getSyncHeight = vi.fn(async () => 12345);
  const getPublicKeyCommitmentsOfAccount = vi.fn(async () => []);
  const getAccountAuthByPubKeyCommitment = vi.fn(async () => ({}));
  const fetchPrivateNotes = vi.fn(async () => undefined);
  const refetch = vi.fn(async () => undefined);
  const sync = vi.fn(async () => undefined);

  let walletState: {
    address: string | null;
    connected: boolean;
    requestTransaction: ReturnType<typeof vi.fn>;
  };
  let midenState: {
    client: {
      addTag: typeof addTag;
      listTags: typeof listTags;
      insertAccountAddress: typeof insertAccountAddress;
      importAccountById: typeof importAccountById;
      getAccounts: typeof getAccounts;
      getAccount: typeof getAccount;
      getSyncHeight: typeof getSyncHeight;
      getPublicKeyCommitmentsOfAccount: typeof getPublicKeyCommitmentsOfAccount;
      getAccountAuthByPubKeyCommitment: typeof getAccountAuthByPubKeyCommitment;
      fetchPrivateNotes: typeof fetchPrivateNotes;
    } | null;
    isReady: boolean;
    isInitializing: boolean;
    error: Error | null;
    sync: typeof sync;
    runExclusive: <T>(fn: () => Promise<T>) => Promise<T>;
    prover: null;
    signerAccountId: string | null;
  };
  let syncState: {
    syncHeight: number;
    isSyncing: boolean;
    lastSyncTime: number | null;
    error: Error | null;
    sync: typeof sync;
  };
  let notesState: {
    notes: never[];
    consumableNotes: never[];
    noteSummaries: never[];
    consumableNoteSummaries: never[];
    isLoading: boolean;
    error: Error | null;
    refetch: typeof refetch;
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    walletState = {
      address: "mtst1sender123_qruqqypuyph",
      connected: true,
      requestTransaction: vi.fn(),
    };

    midenState = {
      client: {
        addTag,
        listTags,
        insertAccountAddress,
        importAccountById,
        getAccounts,
        getAccount,
        getSyncHeight,
        getPublicKeyCommitmentsOfAccount,
        getAccountAuthByPubKeyCommitment,
        fetchPrivateNotes,
      },
      isReady: true,
      isInitializing: false,
      error: null,
      sync,
      runExclusive: async <T,>(fn: () => Promise<T>) => fn(),
      prover: null,
      signerAccountId: "mtst1sender123",
    };

    syncState = {
      syncHeight: 12345,
      isSyncing: false,
      lastSyncTime: 1,
      error: null,
      sync,
    };

    notesState = {
      notes: [],
      consumableNotes: [],
      noteSummaries: [],
      consumableNoteSummaries: [],
      isLoading: false,
      error: null,
      refetch,
    };

    vi.mocked(useMidenFiWallet).mockImplementation(() => walletState as never);
    vi.mocked(useMiden).mockImplementation(() => midenState as never);
    vi.mocked(useSyncState).mockImplementation(() => syncState as never);
    vi.mocked(useNotes).mockImplementation(() => notesState as never);
  });

  it("fetches all note states and refreshes private notes after sync", async () => {
    renderHook(() => useMessenger());

    expect(useNotes).toHaveBeenCalledWith({ status: "all" });

    await waitFor(() => {
      expect(fetchPrivateNotes).toHaveBeenCalledTimes(1);
    });

    expect(refetch).toHaveBeenCalled();
  });

  it("captures bootstrap diagnostics for account import failures", async () => {
    importAccountById.mockRejectedValueOnce(new Error("account import failed"));
    getAccount.mockResolvedValue(undefined);
    getAccounts.mockResolvedValue([]);
    getPublicKeyCommitmentsOfAccount.mockResolvedValue([]);

    const { result } = renderHook(() => useMessenger());

    await act(async () => {
      await result.current.refreshDiagnostics();
    });

    await waitFor(() => {
      expect(result.current.diagnostics.importError).toBe("account import failed");
    });

    expect(result.current.diagnostics.walletAddress).toBe("mtst1sender123_qruqqypuyph");
    expect(result.current.diagnostics.walletIdentity).toBe("mtst1sender123");
    expect(result.current.diagnostics.walletAccountHex).toBeDefined();
    expect(result.current.diagnostics.localAccountFound).toBe(false);
    expect(result.current.diagnostics.hasMessengerTag).toBe(false);
    expect(result.current.diagnostics.trackedTags).toEqual([]);
  });

  it("bootstraps the signer account when wallet and signer identities diverge", async () => {
    walletState = {
      ...walletState,
      address: "mtst1wallet123_qruqqypuyph",
    };
    midenState = {
      ...midenState,
      signerAccountId: "0x7123456789abcdef0000000000000001",
    };

    const { result } = renderHook(() => useMessenger());

    await act(async () => {
      await result.current.refreshDiagnostics();
    });

    await waitFor(() => {
      expect(importAccountById).toHaveBeenCalledTimes(1);
    });

    const [importedAccount] = (importAccountById.mock.calls as unknown as Array<
      [{ toString(): string }]
    >)[0] ?? [undefined];
    const [insertedAccount] = (insertAccountAddress.mock.calls as unknown as Array<
      [{ toString(): string }]
    >)[0] ?? [undefined];
    const [lookedUpAccount] = (getAccount.mock.calls as unknown as Array<
      [{ toString(): string }]
    >)[0] ?? [undefined];
    const [commitmentsAccount] = (getPublicKeyCommitmentsOfAccount.mock.calls as unknown as Array<
      [{ toString(): string }]
    >)[0] ?? [undefined];

    expect(importedAccount?.toString()).toBe("0x7123456789abcdef0000000000000001");
    expect(insertedAccount?.toString()).toBe("0x7123456789abcdef0000000000000001");
    expect(lookedUpAccount?.toString()).toBe("0x7123456789abcdef0000000000000001");
    expect(commitmentsAccount?.toString()).toBe("0x7123456789abcdef0000000000000001");
    expect(importedAccount?.toString()).not.toBe(result.current.diagnostics.walletAccountHex);
    expect(result.current.diagnostics.lastBootstrapReason).toBe("manual-diagnostics");
  });

  it("refetches private notes when the signer switches accounts", async () => {
    const { rerender } = renderHook(() => useMessenger());

    await waitFor(() => {
      expect(fetchPrivateNotes).toHaveBeenCalledTimes(1);
    });

    walletState = {
      ...walletState,
      address: "mtst1recipient123_qruqqypuyph",
    };
    midenState = {
      ...midenState,
      signerAccountId: "mtst1recipient123",
    };

    rerender();

    await waitFor(() => {
      expect(fetchPrivateNotes).toHaveBeenCalledTimes(2);
    });
  });

  it("reloads per-account history and selects the new account thread after a signer switch", async () => {
    const storedMessages: SentMessageRecord[] = [
      {
        ownerAccountId: "mtst1alice123",
        messageId:
          "0x1111111111111111111111111111111111111111111111111111111111111111",
        threadId: "11:12:13:14",
        from: "mtst1alice123",
        to: "mtst1bob123",
        body: "hello from alice",
        direction: "sent",
        observedAt: 1,
      },
      {
        ownerAccountId: "mtst1bob123",
        messageId:
          "0x2222222222222222222222222222222222222222222222222222222222222222",
        threadId: "21:22:23:24",
        from: "mtst1bob123",
        to: "mtst1alice123",
        body: "hello from bob",
        direction: "sent",
        observedAt: 2,
      },
    ];

    localStorage.setItem(SENT_MESSAGES_STORAGE_KEY, JSON.stringify(storedMessages));

    walletState = {
      ...walletState,
      address: "mtst1alice123_qruqqypuyph",
    };
    midenState = {
      ...midenState,
      signerAccountId: "mtst1alice123",
    };

    const { result, rerender } = renderHook(() => useMessenger());

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.activeMessages).toHaveLength(1);
    });

    expect(result.current.conversations[0].lastMessage.body).toBe("hello from alice");
    expect(result.current.selectedThreadId).toBe("11:12:13:14");

    walletState = {
      ...walletState,
      address: "mtst1bob123_qruqqypuyph",
    };
    midenState = {
      ...midenState,
      signerAccountId: "mtst1bob123",
    };

    rerender();

    await waitFor(() => {
      expect(result.current.conversations).toHaveLength(1);
      expect(result.current.conversations[0].lastMessage.body).toBe("hello from bob");
      expect(result.current.selectedThreadId).toBe("21:22:23:24");
      expect(result.current.activeMessages).toHaveLength(1);
    });
  });
});
