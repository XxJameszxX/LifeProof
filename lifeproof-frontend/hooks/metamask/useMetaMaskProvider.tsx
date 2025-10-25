"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type MetaMaskContextState = {
  provider: any | undefined;
  chainId: number | undefined;
  accounts: string[];
  isConnected: boolean;
  connect: () => Promise<void>;
};

const MetaMaskContext = createContext<MetaMaskContextState | undefined>(undefined);

export const MetaMaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [provider, setProvider] = useState<any | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [accounts, setAccounts] = useState<string[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined" && (window as any).ethereum) {
      setProvider((window as any).ethereum);
    }
  }, []);

  // Initialize chainId even when not connected, and restore accounts if already authorized
  useEffect(() => {
    if (!provider) return;
    (async () => {
      // chainId is available without requesting accounts
      try {
        const cid = await provider.request({ method: "eth_chainId" });
        setChainId(parseInt(cid, 16));
      } catch {
        // ignore
      }

      // restore accounts if any are authorized (no prompt)
      try {
        const accs: string[] = await provider.request({ method: "eth_accounts" });
        setAccounts(Array.isArray(accs) ? accs : []);
      } catch {
        // ignore
      }
    })();
  }, [provider]);

  const connect = useCallback(async () => {
    if (!provider) return;
    const accs = await provider.request({ method: "eth_requestAccounts" });
    setAccounts(accs);
    const cid = await provider.request({ method: "eth_chainId" });
    setChainId(parseInt(cid, 16));
  }, [provider]);

  useEffect(() => {
    if (!provider) return;
    const onChainChanged = (cid: string) => setChainId(parseInt(cid, 16));
    const onAccountsChanged = (accs: string[]) => setAccounts(accs);
    const onConnect = (info: { chainId: string }) => {
      try {
        setChainId(parseInt(info.chainId, 16));
      } catch {}
    };
    provider.on?.("chainChanged", onChainChanged);
    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("connect", onConnect);
    return () => {
      provider.removeListener?.("chainChanged", onChainChanged);
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("connect", onConnect);
    };
  }, [provider]);

  const isConnected = useMemo(() => accounts.length > 0, [accounts]);

  const value = useMemo(
    () => ({ provider, chainId, accounts, isConnected, connect }),
    [provider, chainId, accounts, isConnected, connect]
  );

  return <MetaMaskContext.Provider value={value}>{children}</MetaMaskContext.Provider>;
};

export const useMetaMask = () => {
  const ctx = useContext(MetaMaskContext);
  if (!ctx) throw new Error("useMetaMask must be used within MetaMaskProvider");
  return ctx;
};


