"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { ethers } from "ethers";
import { useMetaMaskEthersSigner } from "@/hooks/metamask/useMetaMaskEthersSigner";
import { LifeProofABI } from "@/abi/LifeProofABI";
import { LifeProofAddresses } from "@/abi/LifeProofAddresses";

export default function FeedPage() {
  const { ethersSigner, ethersReadonlyProvider, chainId } = useMetaMaskEthersSigner();
  const [items, setItems] = useState<number[]>([]);
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const contractAddress = useMemo(() => {
    if (!chainId) return undefined;
    return LifeProofAddresses[chainId.toString()]?.address as `0x${string}` | undefined;
  }, [chainId]);

  const refresh = useCallback(async () => {
    if (!ethersReadonlyProvider || !contractAddress) return;
    setIsLoading(true);
    setError("");
    try {
      const c = new ethers.Contract(contractAddress, LifeProofABI.abi, ethersReadonlyProvider);
      const ids: bigint[] = await c.getPublicFeed(0, 30);
      const filtered = ids.map((b) => Number(b)).filter((n) => n > 0);
      setItems(filtered);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setIsLoading(false);
    }
  }, [ethersReadonlyProvider, contractAddress]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">🌐 公共广场</h1>

        {error && (
          <div className="glass-card p-4 mb-6 text-red-600">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((tokenId) => (
            <FeedCard key={tokenId} tokenId={tokenId} contractAddress={contractAddress!} />
          ))}
        </div>

        {isLoading && <p className="text-center mt-6 text-gray-500">加载中...</p>}
      </div>
    </div>
  );
}

function FeedCard({ tokenId, contractAddress }: { tokenId: number; contractAddress: `0x${string}` }) {
  const { ethersSigner, ethersReadonlyProvider } = useMetaMaskEthersSigner();
  const [title, setTitle] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [timestamp, setTimestamp] = useState<number>(0);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);

  const refreshMeta = useCallback(async () => {
    if (!ethersReadonlyProvider) return;
    const c = new ethers.Contract(contractAddress, LifeProofABI.abi, ethersReadonlyProvider);
    // 注意：ethers v6 合约对象存在同名方法 getEvent（用于事件元信息）；
    // 这里显式通过函数签名调用合约的 getEvent(uint256) 以避免冲突
    const e = await (c as any)["getEvent(uint256)"](tokenId);
    setTitle(e.title);
    setCategory(e.category);
    setTimestamp(Number(e.timestamp));
    const cnt: bigint = await c.likeCounts(tokenId);
    setLikeCount(Number(cnt));
    // liked状态仅在已连接并有signer时查询
    if (ethersSigner) {
      const me = await ethersSigner.getAddress();
      const liked_ = await c.hasLiked(tokenId, me);
      setLiked(Boolean(liked_));
    } else {
      setLiked(false);
    }
  }, [ethersReadonlyProvider, ethersSigner, contractAddress, tokenId]);

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta]);

  const toggleLike = useCallback(async () => {
    if (!ethersSigner) return;
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
    <div className="event-card">
      <div className="text-xs text-gray-500 mb-2">#{tokenId}</div>
      <h3 className="text-lg font-semibold text-gray-800 mb-1">{title || "(无标题)"}</h3>
      <div className="text-sm text-gray-600 mb-2">{category}</div>
      <div className="text-xs text-gray-500 mb-4">
        {timestamp ? new Date(timestamp * 1000).toLocaleString() : ""}
      </div>
      <div className="flex gap-3">
        <button
          className={`btn-secondary flex-1 ${busy ? 'animate-pulse' : ''} ${liked ? 'ring-2 ring-primary-300' : ''}`}
          onClick={toggleLike}
          disabled={busy || !ethersSigner}
        >
          {ethersSigner ? (liked ? `✅ 已赞` : `👍 点赞`) : `请连接钱包点赞`}
        </button>
        <Link className="btn-primary flex-1 text-center" href={`/feed/${tokenId}`}>
          查看详情
        </Link>
      </div>
    </div>
  );
}


