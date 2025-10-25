"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, ethers } from "ethers";
import { useMetaMask } from "./useMetaMaskProvider";

type Ctx = {
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: React.MutableRefObject<(chainId: number | undefined) => boolean>;
  sameSigner: React.MutableRefObject<(
    ethersSigner: ethers.JsonRpcSigner | undefined
  ) => boolean>;
  provider: any | undefined;
  chainId: number | undefined;
};

const C = createContext<Ctx | undefined>(undefined);

export const MetaMaskEthersSignerProvider: React.FC<{
  children: React.ReactNode;
  initialMockChains?: Readonly<Record<number, string>>;
}> = ({ children }) => {
  const { provider, chainId } = useMetaMask();
  const [ethersSigner, setSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);
  const [readonly, setReadonly] = useState<ethers.ContractRunner | undefined>(undefined);

  const chainRef = useRef<number | undefined>(chainId);
  const signerRef = useRef<ethers.JsonRpcSigner | undefined>(undefined);

  useEffect(() => {
    chainRef.current = chainId;
  }, [chainId]);

  useEffect(() => {
    if (!provider) {
      setSigner(undefined);
      setReadonly(undefined);
      return;
    }
    const p = new BrowserProvider(provider);
    // try silently to get signer if accounts already authorized
    (async () => {
      try {
        const accounts: string[] = await provider.request({ method: "eth_accounts" });
        if (Array.isArray(accounts) && accounts.length > 0) {
          const s = await p.getSigner();
          signerRef.current = s;
          setSigner(s);
        } else {
          setSigner(undefined);
        }
        setReadonly(p);
      } catch {
        setReadonly(p);
      }
    })();
  }, [provider]);

  const sameChain = useRef<(cid: number | undefined) => boolean>((cid) => cid === chainRef.current);
  const sameSigner = useRef<(
    s: ethers.JsonRpcSigner | undefined
  ) => boolean>((s) => s?.address === signerRef.current?.address);

  const value = useMemo(
    () => ({ ethersSigner, ethersReadonlyProvider: readonly, sameChain, sameSigner, provider, chainId }),
    [ethersSigner, readonly, provider, chainId]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
};

export const useMetaMaskEthersSigner = () => {
  const ctx = useContext(C);
  if (!ctx) throw new Error("useMetaMaskEthersSigner must be used within provider");
  return ctx;
};


