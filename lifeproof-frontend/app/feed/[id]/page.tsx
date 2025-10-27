"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import Link from "next/link";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { LifeProofABI } from "@/abi/LifeProofABI";
import { LifeProofAddresses } from "@/abi/LifeProofAddresses";
import { createFhevmInstance } from "@/fhevm/internal/fhevm";

export default function FeedDetailPage({ params }: { params: { id: string } }) {
  const tokenId = Number(params.id);
  const { provider, chainId, ethersSigner, ethersReadonlyProvider } = useMetaMaskEthersSigner();

  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>(undefined);
  const [event, setEvent] = useState<any | undefined>(undefined);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const [instance, setInstance] = useState<any | undefined>(undefined);
  const [moodHandle, setMoodHandle] = useState<string | undefined>(undefined);
  const [clearMood, setClearMood] = useState<bigint | undefined>(undefined);

  useEffect(() => {
    if (!chainId) return;
    setContractAddress(LifeProofAddresses[chainId.toString()]?.address as `0x${string}` | undefined);
  }, [chainId]);

  useEffect(() => {
    if (!provider || !chainId) return;
    createFhevmInstance({ provider, mockChains: { 31337: "http://localhost:8545" } })
      .then(setInstance)
      .catch(() => setInstance(undefined));
  }, [provider, chainId]);

  const refresh = useCallback(async () => {
    if (!ethersReadonlyProvider || !contractAddress) return;
    const c = new ethers.Contract(contractAddress, LifeProofABI.abi, ethersReadonlyProvider);
    const e = await (c as any)["getEvent(uint256)"](tokenId);
    setEvent(e);
    const cnt: bigint = await c.likeCounts(tokenId);
    setLikeCount(Number(cnt));
    if (ethersSigner) {
      const me = await ethersSigner.getAddress();
      const liked_ = await c.hasLiked(tokenId, me);
      setLiked(Boolean(liked_));
    }
  }, [ethersReadonlyProvider, contractAddress, tokenId, ethersSigner]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onGetHandle = useCallback(async () => {
    if (!ethersSigner || !contractAddress) return;
    const c = new ethers.Contract(contractAddress, LifeProofABI.abi, ethersSigner);
    try {
      const h = await c.getMoodHandle(tokenId);
      setMoodHandle(h);
    } catch {}
  }, [ethersSigner, contractAddress, tokenId]);

  const onDecrypt = useCallback(async () => {
    if (!instance || !moodHandle || !ethersSigner || !contractAddress) return;
    const userAddress = (await ethersSigner.getAddress()) as `0x${string}`;
    const { publicKey, privateKey } = instance.generateKeypair();
    const startTimestamp = Math.floor(Date.now() / 1000);
    const durationDays = 365;
    const eip712 = instance.createEIP712(publicKey, [contractAddress], startTimestamp, durationDays);
    const signature = await ethersSigner.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    const resMap = await instance.userDecrypt(
      [{ handle: moodHandle, contractAddress }],
      privateKey,
      publicKey,
      signature,
      [contractAddress],
      userAddress,
      startTimestamp,
      durationDays
    );
    setClearMood(resMap[moodHandle]);
  }, [instance, moodHandle, ethersSigner, contractAddress]);

  const toggleLike = useCallback(async () => {
    if (!ethersSigner || !contractAddress) return;
    setBusy(true);
    try {
      const c = new ethers.Contract(contractAddress, LifeProofABI.abi, ethersSigner);
      const tx = await c.like(tokenId, !liked);
      await tx.wait();
      setLiked((v) => !v);
      setLikeCount((n) => (liked ? Math.max(0, n - 1) : n + 1));
    } finally {
      setBusy(false);
    }
  }, [ethersSigner, contractAddress, tokenId, liked]);

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6"><Link className="text-primary-600" href="/feed">← 返回广场</Link></div>
        <div className="event-card">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-500">#{tokenId}</div>
            <div className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-primary-100 to-accent-100 text-primary-700">
              {event?.isPublic ? "🌍 公开" : "🔒 私密"}
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">{event?.title}</h1>
          <div className="text-gray-600 mb-4">{event?.category}</div>
          <p className="text-gray-700 whitespace-pre-wrap mb-6">{event?.description}</p>

          <div className="flex gap-3 mb-6">
            <button
              className={`btn-secondary flex-1 ${busy ? 'animate-pulse' : ''} ${liked ? 'ring-2 ring-primary-300' : ''}`}
              onClick={toggleLike}
              disabled={busy || !ethersSigner}
            >
              {ethersSigner ? (liked ? `✅ 已赞` : `👍 点赞`) : `请连接钱包点赞`}
            </button>
            {!moodHandle ? (
              <button className="btn-primary flex-1" onClick={onGetHandle} disabled={!ethersSigner}>获取心情句柄</button>
            ) : (
              <button className="btn-primary flex-1" onClick={onDecrypt} disabled={!ethersSigner || !instance}>🔓 解密心情</button>
            )}
          </div>

          {clearMood !== undefined && (
            <div className="p-6 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 text-center">
              <div className="text-5xl font-bold text-gradient mb-2">{clearMood.toString()}</div>
              <div className="text-gray-600">/ 100</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}





