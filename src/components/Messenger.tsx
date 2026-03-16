import { useState } from "react";
import { useMessenger } from "@/hooks/useMessenger";
import { formatTimestamp, shortAddress } from "@/lib/messenger";

export function Messenger() {
  const {
    connected,
    walletAddress,
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
    refreshDiagnostics,
    refresh,
    explorerUrl,
  } = useMessenger();

  const [label, setLabel] = useState("");
  const [contactAccountId, setContactAccountId] = useState("");
  const [body, setBody] = useState("");

  const canSend =
    connected && body.trim().length > 0 && recipientAccountId.trim().length > 0;

  return (
    <main className="messenger-shell">
      <section className="hero">
        <h1>Miden Messenger</h1>
        <p className="lede">
          Private note threads on Miden testnet. Connect Miden wallet, sync
          your account, keep contacts locally, and exchange messages with the
          least amount of UI chrome we can get away with.
        </p>
        <div className="meta-row">
          <span>
            Account: {signerAccountAddress ? shortAddress(signerAccountAddress) : "not ready"}
          </span>
          <span>
            Wallet: {walletAddress ? shortAddress(walletAddress) : "not connected"}
          </span>
          <span>Block: {syncHeight ?? "syncing..."}</span>
          <button type="button" onClick={() => void refresh()} disabled={isSyncing}>
            {isSyncing ? "Syncing..." : "Sync"}
          </button>
          {explorerUrl && (
            <a href={explorerUrl} target="_blank" rel="noreferrer">
              Open account
            </a>
          )}
        </div>
      </section>

      <hr />

      <section className="layout-grid">
        <aside className="sidebar">
          <div className="section-block">
            <h2>CONTACTS</h2>
            <form
              className="stack-form contact-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!label.trim() || !contactAccountId.trim()) {
                  return;
                }

                addContact({ label, accountId: contactAccountId });
                setLabel("");
                setContactAccountId("");
              }}
            >
              <input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="label"
              />
              <input
                value={contactAccountId}
                onChange={(event) => setContactAccountId(event.target.value)}
                placeholder="mtst..."
              />
              <button type="submit">Add contact</button>
            </form>
            <ul className="plain-list">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setRecipientAccountId(contact.accountId)}
                  >
                    {contact.label}
                  </button>
                  <span>{shortAddress(contact.accountId)}</span>
                  <button
                    type="button"
                    className="link-button muted"
                    onClick={() => deleteContact(contact.id)}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="section-block">
            <h2>CONVERSATIONS</h2>
            <ul className="plain-list">
              {conversations.map((conversation) => (
                <li key={conversation.threadId}>
                  <button
                    type="button"
                    className={
                      conversation.threadId === selectedThreadId
                        ? "thread-link active"
                        : "thread-link"
                    }
                    onClick={() => {
                      setSelectedThreadId(conversation.threadId);
                      setRecipientAccountId(conversation.peerAccountId);
                    }}
                  >
                    <span>{conversation.peerLabel ?? shortAddress(conversation.peerAccountId)}</span>
                    <span>{conversation.lastMessage.body}</span>
                    <span>{formatTimestamp(conversation.lastObservedAt)}</span>
                  </button>
                </li>
              ))}
              {conversations.length === 0 && (
                <li className="muted">No synced conversations yet.</li>
              )}
            </ul>
          </div>

        </aside>

        <section className="main-column">
          <div className="section-block">
            <h2>COMPOSE</h2>
            <form
              className="stack-form compose-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!canSend) {
                  return;
                }

                void sendMessage({
                  recipientAccountId,
                  body,
                  threadId: activeConversation?.threadId,
                  parentMessageId: activeMessages.at(-1)?.messageId,
                });
                setBody("");
              }}
            >
              <input
                value={recipientAccountId}
                onChange={(event) => setRecipientAccountId(event.target.value)}
                placeholder="recipient address or account (mtst...)"
              />
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={5}
                placeholder="write the message body"
              />
              <button type="submit" disabled={!canSend || isSubmitting}>
                {isSubmitting ? "Sending..." : activeConversation ? "Reply" : "Send"}
              </button>
            </form>
          </div>

          <div className="section-block">
            <h2>THREAD</h2>
            {isLoading ? <p className="muted">Loading notes…</p> : null}
            {!activeConversation && !isLoading ? (
              <p className="muted">Select a conversation or send a first message.</p>
            ) : null}
            <ul className="message-list">
              {activeMessages.map((message) => (
                <li key={message.messageId} className="message-row">
                  <p className="message-meta">
                    {message.direction === "sent" ? "You" : shortAddress(message.from)} /{" "}
                    {formatTimestamp(message.observedAt)}
                  </p>
                  <p>{message.body}</p>
                </li>
              ))}
            </ul>
            {error ? <p className="error">{error}</p> : null}
          </div>
        </section>
      </section>

      <section className="section-block diagnostics-block">
        <div className="diagnostics-header">
          <h2>DIAGNOSTICS</h2>
          <button
            type="button"
            onClick={() => void refreshDiagnostics()}
            disabled={isRunningDiagnostics}
          >
            {isRunningDiagnostics ? "Running..." : "Run diagnostics"}
          </button>
        </div>
        <ul className="plain-list diagnostics-list">
          <li>Wallet address: {diagnostics.walletAddress ?? "n/a"}</li>
          <li>Wallet identity: {diagnostics.walletIdentity ?? "n/a"}</li>
          <li>Wallet account hex: {diagnostics.walletAccountHex ?? "n/a"}</li>
          <li>Signer address: {diagnostics.signerAddress ?? "n/a"}</li>
          <li>Signer account id: {diagnostics.signerAccountId ?? "n/a"}</li>
          <li>Signer identity: {diagnostics.signerIdentity ?? "n/a"}</li>
          <li>Client sync height: {diagnostics.clientSyncHeight ?? "n/a"}</li>
          <li>
            Local account present:{" "}
            {diagnostics.localAccountFound == null
              ? "unknown"
              : diagnostics.localAccountFound
                ? "yes"
                : "no"}
          </li>
          <li>
            Signing key available:{" "}
            {diagnostics.hasSigningKey == null
              ? "unknown"
              : diagnostics.hasSigningKey
                ? "yes"
                : "no"}
          </li>
          <li>Messenger tag tracked: {diagnostics.hasMessengerTag ? "yes" : "no"}</li>
          <li>Tracked tags: {diagnostics.trackedTags.join(", ") || "none"}</li>
          <li>Tracked accounts: {diagnostics.trackedAccountIds.join(", ") || "none"}</li>
          <li>
            Public key commitments: {diagnostics.publicKeyCommitments.join(", ") || "none"}
          </li>
          <li>Notes loaded: {diagnostics.noteCount}</li>
          <li>Conversations loaded: {diagnostics.conversationCount}</li>
          <li>Local sent messages: {diagnostics.sentMessageCount}</li>
          <li>
            Last bootstrap:{" "}
            {diagnostics.lastBootstrapAt
              ? `${diagnostics.lastBootstrapReason ?? "unknown"} / ${formatTimestamp(
                  diagnostics.lastBootstrapAt,
                )}`
              : "never"}
          </li>
          <li>
            Last private fetch:{" "}
            {diagnostics.lastFetchAt
              ? `${diagnostics.lastFetchReason ?? "unknown"} / ${formatTimestamp(
                  diagnostics.lastFetchAt,
                )}`
              : "never"}
          </li>
          {diagnostics.addressInsertError ? (
            <li className="error">insertAccountAddress: {diagnostics.addressInsertError}</li>
          ) : null}
          {diagnostics.importError ? (
            <li className="error">importAccountById: {diagnostics.importError}</li>
          ) : null}
          {diagnostics.accountLookupError ? (
            <li className="error">getAccount: {diagnostics.accountLookupError}</li>
          ) : null}
          {diagnostics.trackedAccountsError ? (
            <li className="error">getAccounts: {diagnostics.trackedAccountsError}</li>
          ) : null}
          {diagnostics.clientSyncHeightError ? (
            <li className="error">getSyncHeight: {diagnostics.clientSyncHeightError}</li>
          ) : null}
          {diagnostics.authCommitmentsError ? (
            <li className="error">
              getPublicKeyCommitmentsOfAccount: {diagnostics.authCommitmentsError}
            </li>
          ) : null}
          {diagnostics.authKeyLookupError ? (
            <li className="error">
              getAccountAuthByPubKeyCommitment: {diagnostics.authKeyLookupError}
            </li>
          ) : null}
          {diagnostics.trackedTagsError ? (
            <li className="error">listTags: {diagnostics.trackedTagsError}</li>
          ) : null}
          {diagnostics.fetchPrivateNotesError ? (
            <li className="error">fetchPrivateNotes: {diagnostics.fetchPrivateNotesError}</li>
          ) : null}
        </ul>
      </section>
    </main>
  );
}
