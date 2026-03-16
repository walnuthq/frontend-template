import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import {
  useMiden,
  useNotes,
  useSyncState,
} from "@miden-sdk/react";
import {
  Address,
  FeltArray,
  Note,
  NoteAssets,
  NoteInputs,
  NoteMetadata,
  NoteRecipient,
  NoteScript,
  NoteType,
  OutputNote,
  OutputNoteArray,
  Package,
  TransactionRequestBuilder,
} from "@miden-sdk/miden-sdk";
import { Transaction } from "@miden-sdk/miden-wallet-adapter";
import {
  EXPLORER_BASE_URL,
  MESSENGER_TAG,
  MESSENGER_PACKAGE_PATH,
} from "@/config";
import { useMidenFiWallet } from "@miden-sdk/miden-wallet-adapter-react";
import {
  addressToBech32,
  addressToExplorerAccount,
  buildMessagePayload,
  createThreadId,
  createConversationSummaries,
  decodeMessageRecord,
  findContactByAccountId,
  isCanonicalNoteId,
  loadSentMessages,
  loadContacts,
  messagesForThread,
  messengerTag,
  randomWord,
  removeContact,
  resolveRecipient,
  saveContacts,
  saveSentMessages,
  shortAddress,
  touchContact,
  normalizeAccountIdLike,
  tryNormalizeAccountIdLike,
  tryParseAccountIdLike,
  upsertSentMessage,
  type Contact,
  type ConversationSummary,
  type DraftMessage,
  type MessageRecord,
  type SentMessageRecord,
  upsertContact,
} from "@/lib/messenger";

interface MessengerDiagnosticsState {
  addressInsertError: string | null;
  importError: string | null;
  accountLookupError: string | null;
  trackedAccountsError: string | null;
  trackedTagsError: string | null;
  clientSyncHeightError: string | null;
  authCommitmentsError: string | null;
  authKeyLookupError: string | null;
  fetchPrivateNotesError: string | null;
  trackedTags: string[];
  trackedAccountIds: string[];
  publicKeyCommitments: string[];
  hasSigningKey: boolean | null;
  clientSyncHeight: number | null;
  localAccountFound: boolean | null;
  localAccountId: string | null;
  lastBootstrapAt: number | null;
  lastBootstrapReason: string | null;
  lastFetchAt: number | null;
  lastFetchReason: string | null;
}

const EMPTY_DIAGNOSTICS_STATE: MessengerDiagnosticsState = {
  addressInsertError: null,
  importError: null,
  accountLookupError: null,
  trackedAccountsError: null,
  trackedTagsError: null,
  clientSyncHeightError: null,
  authCommitmentsError: null,
  authKeyLookupError: null,
  fetchPrivateNotesError: null,
  trackedTags: [],
  trackedAccountIds: [],
  publicKeyCommitments: [],
  hasSigningKey: null,
  clientSyncHeight: null,
  localAccountFound: null,
  localAccountId: null,
  lastBootstrapAt: null,
  lastBootstrapReason: null,
  lastFetchAt: null,
  lastFetchReason: null,
};

export function useMessenger() {
  const [contacts, setContacts] = useState<Contact[]>(() => loadContacts());
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [recipientAccountId, setRecipientAccountId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentMessages, setSentMessages] = useState<SentMessageRecord[]>([]);
  const [diagnosticsState, setDiagnosticsState] = useState<MessengerDiagnosticsState>(
    EMPTY_DIAGNOSTICS_STATE,
  );
  const fetchedPrivateNotesRef = useRef<{ client: unknown; key: string } | null>(null);

  const { address, connected, requestTransaction } = useMidenFiWallet();
  const { client, signerAccountId, runExclusive } = useMiden();
  const { sync, syncHeight, isSyncing, lastSyncTime } = useSyncState();
  const walletIdentity = address ? tryNormalizeAccountIdLike(address) ?? address : null;
  const signerIdentity =
    tryNormalizeAccountIdLike(signerAccountId) ??
    signerAccountId ??
    walletIdentity;
  const walletAccountId = useMemo(
    () => tryParseAccountIdLike(address),
    [address],
  );
  const signerAccount = useMemo(
    () => tryParseAccountIdLike(signerAccountId),
    [signerAccountId],
  );
  const signerAddressRecord = useMemo(() => {
    if (!signerAccount) {
      return null;
    }

    return Address.fromAccountId(signerAccount);
  }, [signerAccount]);
  const signerTransportAddress = useMemo(() => {
    if (!signerAddressRecord) {
      return null;
    }

    return addressToBech32(signerAddressRecord);
  }, [signerAddressRecord]);
  const { notes, isLoading, refetch } = useNotes({
    status: "all",
  });

  useEffect(() => {
    saveContacts(contacts);
  }, [contacts]);

  const ownedAccountIds = useMemo(() => {
    const ids = new Set<string>();
    if (signerIdentity) {
      ids.add(signerIdentity);
    }
    if (walletIdentity) {
      ids.add(walletIdentity);
    }

    return ids;
  }, [signerIdentity, walletIdentity]);

  useEffect(() => {
    setSentMessages(loadSentMessages(signerIdentity));
  }, [signerIdentity]);

  useEffect(() => {
    setSelectedThreadId(null);
    setRecipientAccountId("");
    setDiagnosticsState(EMPTY_DIAGNOSTICS_STATE);
  }, [signerIdentity]);

  useEffect(() => {
    saveSentMessages(signerIdentity, sentMessages);
  }, [sentMessages, signerIdentity]);

  const inspectSignerAccount = useEffectEvent(async (reason: string) => {
    if (!client || !signerIdentity || !signerAccount || !signerAddressRecord) {
      return;
    }

    setIsRunningDiagnostics(true);

    const nextDiagnostics: MessengerDiagnosticsState = {
      ...EMPTY_DIAGNOSTICS_STATE,
      lastBootstrapAt: Date.now(),
      lastBootstrapReason: reason,
      lastFetchAt: diagnosticsState.lastFetchAt,
      lastFetchReason: diagnosticsState.lastFetchReason,
      fetchPrivateNotesError: diagnosticsState.fetchPrivateNotesError,
    };

    try {
      await runExclusive(async () => {
        try {
          await client.insertAccountAddress(signerAccount, signerAddressRecord);
        } catch (addressError) {
          nextDiagnostics.addressInsertError = formatDiagnosticsError(addressError);
        }

        try {
          await client.importAccountById(signerAccount);
        } catch (importError) {
          nextDiagnostics.importError = formatDiagnosticsError(importError);
        }

        try {
          const accounts = await client.getAccounts();
          nextDiagnostics.trackedAccountIds = accounts.map((account) =>
            account.id().toString(),
          );
        } catch (accountsError) {
          nextDiagnostics.trackedAccountsError = formatDiagnosticsError(accountsError);
        }

        try {
          const account = await client.getAccount(signerAccount);
          nextDiagnostics.localAccountFound = account != null;
          nextDiagnostics.localAccountId = account?.id().toString() ?? null;
        } catch (accountLookupError) {
          nextDiagnostics.accountLookupError = formatDiagnosticsError(accountLookupError);
        }

        try {
          nextDiagnostics.clientSyncHeight = await client.getSyncHeight();
        } catch (syncHeightError) {
          nextDiagnostics.clientSyncHeightError = formatDiagnosticsError(syncHeightError);
        }

        try {
          const commitments = await client.getPublicKeyCommitmentsOfAccount(signerAccount);
          nextDiagnostics.publicKeyCommitments = commitments.map((commitment) =>
            commitment.toString(),
          );

          if (commitments.length > 0) {
            try {
              await client.getAccountAuthByPubKeyCommitment(commitments[0]);
              nextDiagnostics.hasSigningKey = true;
            } catch (authLookupError) {
              nextDiagnostics.hasSigningKey = false;
              nextDiagnostics.authKeyLookupError = formatDiagnosticsError(authLookupError);
            }
          }
        } catch (authCommitmentsError) {
          nextDiagnostics.authCommitmentsError = formatDiagnosticsError(authCommitmentsError);
        }
      });
    } finally {
      setDiagnosticsState(nextDiagnostics);
      setIsRunningDiagnostics(false);
    }
  });

  useEffect(() => {
    if (!client || !signerIdentity) {
      return;
    }

    const fetchKey = `${signerIdentity}:${lastSyncTime ?? 0}`;
    if (
      fetchedPrivateNotesRef.current?.client === client &&
      fetchedPrivateNotesRef.current.key === fetchKey
    ) {
      return;
    }

    fetchedPrivateNotesRef.current = { client, key: fetchKey };

    let cancelled = false;

    void (async () => {
      try {
        await runExclusive(() => client.fetchPrivateNotes());
        setDiagnosticsState((current) => ({
          ...current,
          fetchPrivateNotesError: null,
          lastFetchAt: Date.now(),
          lastFetchReason: `sync:${lastSyncTime ?? 0}`,
        }));
        if (!cancelled) {
          await refetch();
        }
      } catch (fetchError) {
        setDiagnosticsState((current) => ({
          ...current,
          fetchPrivateNotesError: formatDiagnosticsError(fetchError),
          lastFetchAt: Date.now(),
          lastFetchReason: `sync:${lastSyncTime ?? 0}`,
        }));
        console.warn("[messenger] failed to fetch private notes", fetchError);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client, lastSyncTime, refetch, runExclusive, signerIdentity]);

  const messages = useMemo<MessageRecord[]>(() => {
    if (!signerIdentity) {
      return [];
    }

    const syncedMessages = notes
      .map((note) => decodeMessageRecord(note, ownedAccountIds))
      .filter((message): message is MessageRecord => message !== null)
      .sort((left, right) => right.observedAt - left.observedAt);

    console.log("[messenger] note decode summary", {
      signerIdentity,
      totalNotes: notes.length,
      decodedMessages: syncedMessages.length,
      localSentMessages: sentMessages.length,
    });

    const merged = new Map<string, MessageRecord>();
    for (const message of [...sentMessages, ...syncedMessages]) {
      merged.set(message.messageId, message);
    }

    return Array.from(merged.values()).sort((left, right) => right.observedAt - left.observedAt);
  }, [notes, ownedAccountIds, sentMessages, signerIdentity]);

  const conversations = useMemo<ConversationSummary[]>(() => {
    if (!signerIdentity) {
      return [];
    }
    return createConversationSummaries(messages, contacts);
  }, [contacts, messages, signerIdentity]);

  useEffect(() => {
    if (selectedThreadId || conversations.length === 0) {
      return;
    }

    setSelectedThreadId(conversations[0].threadId);
  }, [conversations, selectedThreadId]);

  const activeMessages = useMemo(
    () => messagesForThread(messages, selectedThreadId),
    [messages, selectedThreadId],
  );

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.threadId === selectedThreadId,
      ) ?? null,
    [conversations, selectedThreadId],
  );

  useEffect(() => {
    setRecipientAccountId(activeConversation?.peerAccountId ?? "");
  }, [activeConversation?.peerAccountId]);

  async function sendMessage(draft: DraftMessage) {
    if (!client || !signerAccount || !requestTransaction || !address) {
      setError("Connect your wallet before sending messages.");
      return;
    }

    if (!signerIdentity) {
      setError("Wallet signer is still initializing.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    let step = "start";
    try {
      step = "normalize recipient";
      const recipientInput = draft.recipientAccountId.trim();
      const resolvedRecipient = resolveRecipient(recipientInput);
      const recipientAddress = resolvedRecipient.address;
      const recipientAccountId = resolvedRecipient.accountId;
      const normalizedRecipient = resolvedRecipient.canonicalAccountId;
      const resolvedThreadId = draft.threadId ?? createThreadId();
      const parentMessageId = isCanonicalNoteId(draft.parentMessageId)
        ? draft.parentMessageId
        : undefined;
      console.log("[messenger] preparing send", {
        recipientInput,
        normalizedRecipient,
        resolvedThreadId,
        parentMessageId: parentMessageId ?? null,
        bodyLength: draft.body.length,
      });

      step = "parse signer";
      console.log("[messenger] signer ready", {
        signerAccountId,
        senderId: signerAccount.toString(),
        walletAddress: address,
      });

      step = "load package";
      const pkg = await loadMessengerPackage();

      step = "create note script";
      const noteScript = NoteScript.fromPackage(pkg);

      step = "build payload";
      const payload = buildMessagePayload(
        recipientAccountId,
        draft.body,
        resolvedThreadId,
        parentMessageId,
      );

      step = "build note inputs";
      const inputFelts = new FeltArray();
      for (const felt of payload) {
        inputFelts.push(felt);
      }
      const inputs = new NoteInputs(inputFelts);

      step = "build recipient";
      const recipient = new NoteRecipient(randomWord(), noteScript, inputs);

      step = "build metadata";
      const metadata = new NoteMetadata(
        signerAccount,
        NoteType.Private,
        messengerTag(),
      );

      step = "build note";
      const noteBytes = new Note(new NoteAssets(), metadata, recipient).serialize();
      const transactionNote = Note.deserialize(noteBytes);
      const transportNote = Note.deserialize(noteBytes);
      const messageId = transactionNote.id().toString();

      step = "build output notes";
      const outputNotes = new OutputNoteArray();
      outputNotes.push(OutputNote.full(transactionNote));

      step = "build transaction request";
      const request = new TransactionRequestBuilder()
        .withOwnOutputNotes(outputNotes)
        .build();

      step = "request wallet transaction";
      const transactionId = await requestTransaction(
        Transaction.createCustomTransaction(
          address,
          resolvedRecipient.canonicalAddress,
          request,
        ),
      );
      console.log("[messenger] wallet transaction requested", {
        transactionId,
        sender: address,
        recipient: recipientInput || normalizedRecipient,
      });

      setSentMessages((current) =>
        upsertSentMessage(current, {
          ownerAccountId: signerIdentity,
          messageId,
          threadId: resolvedThreadId,
          parentMessageId,
          from: signerIdentity,
          to: normalizedRecipient,
          body: draft.body,
          direction: "sent",
          observedAt: Date.now(),
        }),
      );

      setContacts((current) =>
        touchContact(
          upsertContact(current, {
            label:
              findContactByAccountId(current, normalizedRecipient)?.label ??
              shortAddress(normalizedRecipient),
            accountId: normalizedRecipient,
            lastUsedAt: Date.now(),
          }),
          normalizedRecipient,
        ),
      );

      step = "send private note";
      await runExclusive(() => client.sendPrivateNote(transportNote, recipientAddress));
      console.log("[messenger] private note sent to transport", {
        recipient: recipientInput || normalizedRecipient,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("messenger send failed", err);
      setError(`${step}: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function addContact(contact: { label: string; accountId: string }) {
    try {
      const normalizedAccountId = normalizeAccountIdLike(contact.accountId);
      setError(null);
      setContacts((current) =>
        upsertContact(current, {
          label: contact.label,
          accountId: normalizedAccountId,
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`add contact: ${message}`);
    }
  }

  function deleteContact(id: string) {
    setContacts((current) => removeContact(current, id));
  }

  const signerAccountAddress = signerTransportAddress ?? signerIdentity;
  const explorerAccount = signerTransportAddress
    ? addressToExplorerAccount(signerTransportAddress)
    : address
      ? addressToExplorerAccount(address)
      : null;
  const explorerUrl = explorerAccount
    ? `${EXPLORER_BASE_URL}/account/${explorerAccount}`
    : null;
  const diagnostics = {
    walletAddress: address ?? null,
    walletIdentity,
    walletAccountHex: walletAccountId?.toString() ?? null,
    signerAddress: signerTransportAddress,
    signerAccountId: signerAccountId ?? null,
    signerIdentity,
    noteCount: notes.length,
    conversationCount: conversations.length,
    sentMessageCount: sentMessages.length,
    hasMessengerTag: diagnosticsState.trackedTags.includes(String(MESSENGER_TAG)),
    ...diagnosticsState,
  };

  return {
    connected,
    walletAddress: address,
    signerAccountId,
    signerAccountAddress,
    syncHeight,
    isSyncing,
    isLoading,
    isSubmitting,
    error,
    contacts,
    conversations,
    selectedThreadId,
    recipientAccountId,
    activeConversation,
    activeMessages,
    setSelectedThreadId,
    setRecipientAccountId,
    addContact,
    deleteContact,
    sendMessage,
    diagnostics,
    isRunningDiagnostics,
    refreshDiagnostics: async () => {
      await inspectSignerAccount("manual-diagnostics");
    },
    refresh: async () => {
      if (!client) {
        return;
      }
      console.log("[messenger] manual refresh start");
      try {
        console.log("[messenger] manual refresh fetching private notes");
        await runExclusive(() => client.fetchPrivateNotes());
        console.log("[messenger] manual refresh fetched private notes");
        setDiagnosticsState((current) => ({
          ...current,
          fetchPrivateNotesError: null,
          lastFetchAt: Date.now(),
          lastFetchReason: "manual-refresh",
        }));
        console.log("[messenger] manual refresh syncing state");
        await sync();
        console.log("[messenger] manual refresh sync completed");
        await refetch();
        console.log("[messenger] manual refresh refetch completed");
      } catch (refreshError) {
        const message = formatDiagnosticsError(refreshError);
        setDiagnosticsState((current) => ({
          ...current,
          fetchPrivateNotesError: message,
          lastFetchAt: Date.now(),
          lastFetchReason: "manual-refresh-failed",
        }));
        console.warn("[messenger] manual refresh failed", refreshError);
        setError(`refresh: ${message}`);
      }
    },
    explorerUrl,
  };
}

async function loadMessengerPackage() {
  const buffer = await fetch(MESSENGER_PACKAGE_PATH).then((response) => {
    if (!response.ok) {
      throw new Error("Failed to load messenger note package");
    }

    return response.arrayBuffer();
  });

  return Package.deserialize(new Uint8Array(buffer));
}

function formatDiagnosticsError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
