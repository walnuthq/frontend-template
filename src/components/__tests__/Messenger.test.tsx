import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/useMessenger", () => ({
  useMessenger: vi.fn(),
}));

import { useMessenger } from "@/hooks/useMessenger";
import { Messenger } from "../Messenger";

const defaultHookReturn = {
  connected: true,
  walletAddress: "mtst1senderabc123",
  signerAccountId: "mtst1signerabc123",
  signerAccountAddress: "mtst1signerabc123",
  syncHeight: 999,
  isSyncing: false,
  isLoading: false,
  isSubmitting: false,
  error: null,
  contacts: [
    { id: "alice", label: "Alice", accountId: "mtst1alice123" },
    { id: "bob", label: "Bob", accountId: "mtst1bob123" },
  ],
  conversations: [
    {
      threadId: "1:2:3:4",
      peerAccountId: "mtst1alice123",
      peerLabel: "Alice",
      lastMessage: {
        messageId: "0x1",
        threadId: "1:2:3:4",
        from: "mtst1alice123",
        to: "mtst1senderabc123",
        body: "hello",
        direction: "received" as const,
        observedAt: 1,
      },
      lastObservedAt: 1,
    },
  ],
  selectedThreadId: "1:2:3:4",
  recipientAccountId: "mtst1alice123",
  activeConversation: {
    threadId: "1:2:3:4",
    peerAccountId: "mtst1alice123",
    peerLabel: "Alice",
    lastMessage: {
      messageId: "0x1",
      threadId: "1:2:3:4",
      from: "mtst1alice123",
      to: "mtst1senderabc123",
      body: "hello",
      direction: "received" as const,
      observedAt: 1,
    },
    lastObservedAt: 1,
  },
  activeMessages: [
    {
      messageId: "0x1",
      threadId: "1:2:3:4",
      from: "mtst1alice123",
      to: "mtst1senderabc123",
      body: "hello",
      direction: "received" as const,
      observedAt: 1,
    },
  ],
  setSelectedThreadId: vi.fn(),
  setRecipientAccountId: vi.fn(),
  addContact: vi.fn(),
  deleteContact: vi.fn(),
  sendMessage: vi.fn(async () => undefined),
  diagnostics: {
    walletAddress: "mtst1senderabc123_qruqqypuyph",
    walletIdentity: "mtst1senderabc123",
    walletAccountHex: "0x1234",
    signerAddress: "mtst1signerabc123_qruqqypuyph",
    signerAccountId: "mtst1signerabc123",
    signerIdentity: "mtst1signerabc123",
    noteCount: 1,
    conversationCount: 1,
    sentMessageCount: 0,
    hasMessengerTag: true,
    trackedTags: ["404"],
    trackedAccountIds: ["0x1234"],
    publicKeyCommitments: ["0xcommitment"],
    hasSigningKey: true,
    clientSyncHeight: 999,
    localAccountFound: true,
    localAccountId: "0x1234",
    addressInsertError: null,
    importError: null,
    accountLookupError: null,
    trackedAccountsError: null,
    trackedTagsError: null,
    clientSyncHeightError: null,
    authCommitmentsError: null,
    authKeyLookupError: null,
    fetchPrivateNotesError: null,
    lastBootstrapAt: 1,
    lastBootstrapReason: "wallet-bootstrap",
    lastFetchAt: 1,
    lastFetchReason: "sync:1",
  },
  isRunningDiagnostics: false,
  refreshDiagnostics: vi.fn(async () => undefined),
  refresh: vi.fn(async () => undefined),
  explorerUrl: "https://testnet.midenscan.com/account/mtst1senderabc123",
};

describe("Messenger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMessenger).mockReturnValue(defaultHookReturn);
  });

  it("renders contacts, conversations, and thread messages", () => {
    render(<Messenger />);

    expect(screen.getByText("Miden Messenger")).toBeInTheDocument();
    expect(
      screen.getByText(/Private note threads on Miden testnet\. Connect Miden wallet/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Alice")).toHaveLength(2);
    expect(screen.getAllByText("hello")).toHaveLength(2);
    expect(screen.getByText("Wallet identity: mtst1senderabc123")).toBeInTheDocument();
    expect(screen.getByText("Signer address: mtst1signerabc123_qruqqypuyph")).toBeInTheDocument();
    expect(screen.getByText("Messenger tag tracked: yes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open account" })).toHaveAttribute(
      "href",
      defaultHookReturn.explorerUrl,
    );
  });

  it("submits a reply using the current form state", async () => {
    render(<Messenger />);
    const user = userEvent.setup();

    await user.clear(screen.getByPlaceholderText("write the message body"));
    await user.type(screen.getByPlaceholderText("write the message body"), "reply");
    await user.click(screen.getByRole("button", { name: "Reply" }));

    expect(defaultHookReturn.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientAccountId: "mtst1alice123",
        body: "reply",
        threadId: "1:2:3:4",
        parentMessageId: "0x1",
      }),
    );
  });

  it("adds a contact from the contact form", async () => {
    render(<Messenger />);
    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText("label"), "Carol");
    await user.type(screen.getByPlaceholderText("mtst..."), "mtst1carol123");
    await user.click(screen.getByRole("button", { name: "Add contact" }));

    expect(defaultHookReturn.addContact).toHaveBeenCalledWith({
      label: "Carol",
      accountId: "mtst1carol123",
    });
  });
});
