import { AccountId, Felt } from "@miden-sdk/miden-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMessagePayload,
  createConversationSummaries,
  decodeMessageRecord,
  loadContacts,
  normalizeAccountIdLike,
  removeContact,
  resolveRecipient,
  saveSentMessages,
  saveContacts,
  touchContact,
  upsertContact,
  loadSentMessages,
} from "../messenger";

describe("messenger lib", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-13T12:00:00Z"));
  });

  it("stores and reloads contacts from localStorage", () => {
    const contacts = upsertContact([], {
      label: "Alice",
      accountId: "mtst1alice123",
    });
    saveContacts(contacts);

    expect(loadContacts()).toEqual(contacts);
  });

  it("normalizes legacy stored contact identities on load", () => {
    localStorage.setItem(
      "miden-messenger.contacts",
      JSON.stringify([
        {
          id: "alice",
          label: "Alice",
          accountId: "mtst1alice123_qruqqypuyph",
        },
      ]),
    );

    expect(loadContacts()).toEqual([
      expect.objectContaining({
        id: "alice",
        label: "Alice",
        accountId: normalizeAccountIdLike("mtst1alice123_qruqqypuyph"),
      }),
    ]);
  });

  it("preserves sent-message history for multiple owners", () => {
    saveSentMessages("mtst1alice123", [
      {
        ownerAccountId: "mtst1alice123",
        messageId: "0x1111111111111111111111111111111111111111111111111111111111111111",
        threadId: "1:2:3:4",
        from: "mtst1alice123",
        to: "mtst1bob123",
        body: "hello bob",
        direction: "sent",
        observedAt: 1,
      },
    ]);

    saveSentMessages("mtst1bob123", [
      {
        ownerAccountId: "mtst1bob123",
        messageId: "0x2222222222222222222222222222222222222222222222222222222222222222",
        threadId: "5:6:7:8",
        from: "mtst1bob123",
        to: "mtst1alice123",
        body: "hello alice",
        direction: "sent",
        observedAt: 2,
      },
    ]);

    expect(loadSentMessages("mtst1alice123")).toEqual([
      expect.objectContaining({
        ownerAccountId: "mtst1alice123",
        body: "hello bob",
      }),
    ]);
    expect(loadSentMessages("mtst1bob123")).toEqual([
      expect.objectContaining({
        ownerAccountId: "mtst1bob123",
        body: "hello alice",
      }),
    ]);
  });

  it("updates and removes contacts", () => {
    const contacts = upsertContact([], {
      id: "alice",
      label: "Alice",
      accountId: "mtst1alice123",
    });

    const touched = touchContact(contacts, "mtst1alice123");
    expect(touched[0].lastUsedAt).toBe(Date.now());
    expect(removeContact(touched, "alice")).toEqual([]);
  });

  it("deduplicates contacts across equivalent identity forms", () => {
    const aliceInput = "mtst1aru8adnrqspgcsr3drk2n990lyc070ll";
    const aliceAddress = normalizeAccountIdLike(aliceInput);
    const aliceHex = resolveRecipient(aliceInput).accountId.toString();

    const contacts = upsertContact(
      [
        {
          id: "alice",
          label: "Alice",
          accountId: aliceAddress,
        },
      ],
      {
        label: "Alice Updated",
        accountId: aliceHex,
      },
    );

    expect(contacts).toEqual([
      expect.objectContaining({
        label: "Alice Updated",
        accountId: aliceAddress,
      }),
    ]);
  });

  it("builds a messenger payload with reply metadata", () => {
    const payload = buildMessagePayload(
      "mtst1aru8adnrqspgcsr3drk2n990lyc070ll",
      "hello",
      "1:2:3:4",
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    );

    expect(payload).toHaveLength(18);
    expect(payload[1].asInt()).toBe(1n);
    expect(payload[12].asInt()).toBe(5n);
  });

  it("resolves wallet addresses and account ids to the same canonical recipient", () => {
    const fromAccountId = resolveRecipient("mtst1alice123");
    const fromWalletAddress = resolveRecipient("mtst1alice123_qruqqypuyph");

    expect(fromWalletAddress.canonicalAccountId).toBe(fromAccountId.canonicalAccountId);
    expect(normalizeAccountIdLike("mtst1alice123_qruqqypuyph")).toBe(
      fromAccountId.canonicalAccountId,
    );
  });

  it("decodes received notes using the connected account as the recipient", () => {
    const payload = buildMessagePayload("mtst1me123", "hello", "1:2:3:4");
    const sender = AccountId.fromBech32("mtst1sender123");
    const connectedAccountId = normalizeAccountIdLike("mtst1me123_qruqqypuyph");

    const note = {
      metadata: () => ({
        tag: () => ({ asU32: () => 404 }),
        sender: () => sender,
      }),
      details: () => ({
        recipient: () => ({
          inputs: () => ({
            values: () => payload,
          }),
        }),
      }),
      id: () => ({
        toString: () => "0xnote1",
      }),
    };

    expect(decodeMessageRecord(note as never, new Set([connectedAccountId]))).toEqual(
      expect.objectContaining({
        messageId: "0xnote1",
        from: normalizeAccountIdLike("mtst1sender123"),
        to: "",
        direction: "received",
        body: "hello",
      }),
    );
  });

  it("skips sent notes during decode to avoid payload-derived recipient reconstruction", () => {
    const payload = [
      new Felt(1n),
      new Felt(0n),
      new Felt(1n),
      new Felt(2n),
      new Felt(3n),
      new Felt(4n),
      new Felt(0n),
      new Felt(0n),
      new Felt(0n),
      new Felt(0n),
      new Felt(5n),
      new Felt(6n),
      new Felt(0n),
    ];
    const sender = AccountId.fromBech32("mtst1sender123");
    const connectedAccountId = normalizeAccountIdLike("mtst1sender123");

    const note = {
      metadata: () => ({
        tag: () => ({ asU32: () => 404 }),
        sender: () => sender,
      }),
      details: () => ({
        recipient: () => ({
          inputs: () => ({
            values: () => payload,
          }),
        }),
      }),
      id: () => ({
        toString: () => "0xnote2",
      }),
    };

    expect(decodeMessageRecord(note as never, new Set([connectedAccountId]))).toBeNull();
  });

  it("groups conversations by latest message per thread", () => {
    const summaries = createConversationSummaries(
      [
        {
          messageId: "0x1",
          threadId: "a",
          from: "me",
          to: "peer",
          body: "first",
          direction: "sent",
          observedAt: 1,
        },
        {
          messageId: "0x2",
          threadId: "a",
          from: "peer",
          to: "me",
          body: "second",
          direction: "received",
          observedAt: 2,
        },
      ],
      [{ id: "peer", label: "Peer", accountId: "peer" }],
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0].peerLabel).toBe("Peer");
    expect(summaries[0].lastMessage.body).toBe("second");
  });

  it("matches contacts across equivalent identity forms", () => {
    const aliceInput = "mtst1aru8adnrqspgcsr3drk2n990lyc070ll";
    const aliceBech32 = normalizeAccountIdLike(aliceInput);
    const aliceHex = resolveRecipient(aliceInput).accountId.toString();

    const summaries = createConversationSummaries(
      [
        {
          messageId: "0x3",
          threadId: "b",
          from: aliceHex,
          to: "mtst1me123",
          body: "hello",
          direction: "received",
          observedAt: 3,
        },
      ],
      [{ id: "alice", label: "Alice", accountId: aliceBech32 }],
    );

    expect(summaries).toHaveLength(1);
    expect(summaries[0].peerLabel).toBe("Alice");
    expect(summaries[0].peerAccountId).toBe(aliceBech32);
  });
});
