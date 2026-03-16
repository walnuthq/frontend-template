import { type ReactNode } from "react";
import { MidenProvider } from "@miden-sdk/react";
import {
  AllowedPrivateData,
  MidenFiSignerProvider,
  PrivateDataPermission,
  WalletAdapterNetwork,
} from "@miden-sdk/miden-wallet-adapter";
import "@miden-sdk/miden-wallet-adapter/styles.css";
import {
  APP_NAME,
  MIDEN_NOTE_TRANSPORT_URL,
  MIDEN_PROVER,
  MIDEN_RPC_URL,
} from "@/config";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MidenFiSignerProvider
      appName={APP_NAME}
      network={WalletAdapterNetwork.Testnet}
      autoConnect={false}
      privateDataPermission={PrivateDataPermission.Auto}
      allowedPrivateData={AllowedPrivateData.All}
      storageMode="public"
    >
      <MidenProvider
        config={{
          rpcUrl: MIDEN_RPC_URL,
          prover: MIDEN_PROVER,
          noteTransportUrl: MIDEN_NOTE_TRANSPORT_URL,
          autoSyncInterval: 0,
        }}
        loadingComponent={
          <div className="loading">Loading Miden WASM...</div>
        }
      >
        {children}
      </MidenProvider>
    </MidenFiSignerProvider>
  );
}
