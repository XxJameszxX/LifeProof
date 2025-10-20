"use client";

import type { ReactNode } from "react";
import { MetaMaskProvider } from "@/hooks/metamask/useMetaMaskProvider";
import { MetaMaskEthersSignerProvider } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MetaMaskProvider>
      <MetaMaskEthersSignerProvider initialMockChains={{ 31337: "http://localhost:8545" }}>
        <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
      </MetaMaskEthersSignerProvider>
    </MetaMaskProvider>
  );
}





