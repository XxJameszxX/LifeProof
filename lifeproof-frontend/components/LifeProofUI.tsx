"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMetaMask } from "../hooks/metamask/useMetaMaskProvider";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { createFhevmInstance } from "../fhevm/internal/fhevm";
import { LifeProofABI } from "../abi/LifeProofABI";
import { LifeProofAddresses } from "../abi/LifeProofAddresses";
import { ethers } from "ethers";

type LifeEvent = {
  title: string;
  description: string;
  imageURI: string;
  category: string;
  timestamp: bigint;
  isPublic: boolean;
};

const categoryEmojis: Record<string, string> = {
  Travel: "✈️",
  Graduation: "🎓",
  Marriage: "💑",
  Work: "💼",
  Achievement: "🏆",
  Birthday: "🎂",
  Other: "📌",
};

export function LifeProofUI() {
  const { isConnected, connect } = useMetaMask();
  const { provider, chainId, ethersSigner, ethersReadonlyProvider } = useMetaMaskEthersSigner();

  const [instance, setInstance] = useState<any | undefined>(undefined);
  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>(undefined);
  const [events, setEvents] = useState<LifeEvent[]>([]);
  const [message, setMessage] = useState<string>("");
  const [moodHandle, setMoodHandle] = useState<string | undefined>(undefined);
  const [clearMood, setClearMood] = useState<bigint | undefined>(undefined);
  const [selectedTokenId, setSelectedTokenId] = useState<number | undefined>(undefined);
  const [isMinting, setIsMinting] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Resolve contract address
  useEffect(() => {
    if (!chainId) {
      setContractAddress(undefined);
      return;
    }
    const entry = LifeProofAddresses[chainId.toString()];
    setContractAddress(entry?.address as `0x${string}` | undefined);
  }, [chainId]);

  // Create FHEVM instance
  useEffect(() => {
    if (!provider || !chainId) return;
    setMessage("正在初始化 FHEVM...");
    createFhevmInstance({ provider, mockChains: { 31337: "http://localhost:8545" } })
      .then((inst) => {
        setInstance(inst);
        setMessage("FHEVM 已就绪");
      })
      .catch((e) => setMessage("FHEVM 初始化失败: " + (e?.message ?? e)));
  }, [provider, chainId]);

  const canMint = useMemo(() => instance && ethersSigner && contractAddress, [instance, ethersSigner, contractAddress]);

  const refreshMyEvents = useCallback(() => {
    // 使用 signer 调用以便 msg.sender = 用户地址；避免 balanceOf(0x0) 的合约自检报错
    if (!ethersSigner || !contractAddress) {
      setEvents([]);
      return;
    }
    const c = new ethers.Contract(contractAddress, LifeProofABI.abi, ethersSigner);
    c.getMyEvents()
      .then((list: LifeEvent[]) => {
        setEvents(list);
        setMessage("事件列表已更新");
      })
      .catch((e: any) => setMessage("获取事件失败: " + (e?.message ?? e)));
  }, [ethersSigner, contractAddress]);

  useEffect(() => {
    refreshMyEvents();
  }, [refreshMyEvents]);

  const formRef = useRef<HTMLFormElement | null>(null);

  const onMint = useCallback(async (formData: FormData) => {
    if (!canMint) return;
    setIsMinting(true);
    try {
      const title = String(formData.get("title") || "");
      const description = String(formData.get("description") || "");
      const imageURI = String(formData.get("imageURI") || "");
      const category = String(formData.get("category") || "Other");
      const isPublic = String(formData.get("isPublic") || "true") === "true";
      const mood = Number(formData.get("mood") || 50);

      setMessage("正在加密心情分数...");
      await new Promise(r => setTimeout(r, 120)); // 微延迟，给UI时间渲染按钮动画
      const input = instance.createEncryptedInput(contractAddress!, await ethersSigner!.getAddress());
      input.add8(BigInt(mood));
      const enc = await input.encrypt();

      setMessage("正在铸造 NFT...");
      const c = new ethers.Contract(contractAddress!, LifeProofABI.abi, ethersSigner);
      const tx = await c.mintLifeEvent(title, description, imageURI, category, isPublic, enc.handles[0], enc.inputProof);
      setMessage(`交易已提交: ${tx.hash.slice(0, 10)}...`);
      await tx.wait();
      setMessage("✨ 铸造成功！");
      formRef.current?.reset();
      refreshMyEvents();
    } catch (e: any) {
      setMessage("铸造失败: " + (e?.message ?? e));
    } finally {
      setIsMinting(false);
    }
  }, [canMint, contractAddress, ethersSigner, instance, refreshMyEvents]);

  const onGetMood = useCallback(async (tokenId: number) => {
    if (!contractAddress || !ethersSigner) return;
    setSelectedTokenId(tokenId);
    const c = new ethers.Contract(contractAddress, LifeProofABI.abi, ethersSigner);
    try {
      const handle = await c.getMoodHandle(tokenId); // 仅持有人可读
      setMoodHandle(handle);
      setMessage("已获取心情句柄，点击解密查看");
    } catch (e: any) {
      setMessage("获取句柄失败: " + (e?.message ?? e));
    }
  }, [contractAddress, ethersSigner]);

  const onDecryptMood = useCallback(async () => {
    if (!instance || !moodHandle || !contractAddress || !ethersSigner) return;
    setIsDecrypting(true);
    try {
      setMessage("正在解密心情分数...");
      const userAddress = (await ethersSigner.getAddress()) as `0x${string}`;

      // 1) 读取或创建一次性解密签名（缓存一年）
      const storageKey = `fhevm:decrypt:${contractAddress}:${userAddress}`;
      let sigJson = undefined as undefined | string;
      try { sigJson = localStorage.getItem(storageKey) ?? undefined; } catch {}
      let sig: any | undefined = undefined;
      if (sigJson) {
        try { sig = JSON.parse(sigJson); } catch { sig = undefined; }
        if (sig && Date.now() / 1000 >= (sig.startTimestamp + sig.durationDays * 24 * 60 * 60)) {
          sig = undefined; // 过期
        }
      }

      if (!sig) {
        const { publicKey, privateKey } = instance.generateKeypair();
        const startTimestamp = Math.floor(Date.now() / 1000);
        const durationDays = 365;
        const eip712 = instance.createEIP712(publicKey, [contractAddress], startTimestamp, durationDays);
        const signature = await ethersSigner.signTypedData(
          eip712.domain,
          { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
          eip712.message
        );
        sig = { publicKey, privateKey, signature, userAddress, contractAddresses: [contractAddress], startTimestamp, durationDays };
        try { localStorage.setItem(storageKey, JSON.stringify(sig)); } catch {}
      }

      // 2) 调用用户解密
      const resMap = await instance.userDecrypt(
        [{ handle: moodHandle, contractAddress }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays
      );
      const clear = resMap[moodHandle];
      setClearMood(clear);
      setMessage(`💖 心情分数: ${clear.toString()}/100`);
    } catch (e: any) {
      setMessage("解密失败: " + (e?.message ?? e));
    } finally {
      setIsDecrypting(false);
    }
  }, [instance, moodHandle, contractAddress, ethersSigner]);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card p-12 text-center max-w-md">
          <div className="text-6xl mb-6">🔐</div>
          <h1 className="text-3xl font-bold text-gradient mb-4">LifeProof</h1>
          <p className="text-gray-600 mb-8">生活事件上链档案</p>
          <button onClick={connect} className="btn-primary w-full text-lg">
            连接钱包
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gradient mb-4">LifeProof</h1>
          <p className="text-xl text-gray-600">记录生活，铭刻瞬间</p>
        </div>

        {/* Status Message */}
        {message && (
          <div className="glass-card p-4 mb-8 text-center">
            <p className="text-gray-700">{message}</p>
          </div>
        )}

        {/* Mint Form */}
        <div className="glass-card p-8 mb-12">
          <h2 className="text-2xl font-bold mb-6 text-gray-800">✨ 记录新事件</h2>
          <form
            ref={formRef}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              onMint(fd);
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">标题</label>
              <input name="title" placeholder="这是什么事件？" required className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">分类</label>
              <select name="category" className="input-field">
                {Object.entries(categoryEmojis).map(([cat, emoji]) => (
                  <option key={cat} value={cat}>{emoji} {cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">是否公开</label>
              <select name="isPublic" defaultValue="true" className="input-field">
                <option value="true">🌍 公开</option>
                <option value="false">🔒 私密</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">图片 URI</label>
              <input name="imageURI" placeholder="ipfs://... 或 https://..." className="input-field" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">描述</label>
              <textarea name="description" placeholder="写下你的故事..." rows={4} className="input-field" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">心情分数 (0-100)</label>
              <input name="mood" type="number" min={0} max={100} defaultValue={50} className="input-field" />
              <p className="text-xs text-gray-500 mt-1">此分数将被加密存储在链上</p>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={!canMint || isMinting}
                className={`btn-primary w-full text-lg ${isMinting ? 'animate-pulse' : ''}`}
              >
                {isMinting ? "⏳ 正在铸造..." : "🎖 铸造 LifeProof NFT"}
              </button>
            </div>
          </form>
        </div>

        {/* Events Timeline */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-8 text-gray-800">📅 我的生活时间轴</h2>
          {events.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500 text-lg">还没有记录任何事件</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((e, i) => (
                <div key={i} className="event-card">
                  <div className="flex items-start justify-between mb-4">
                    <div className="text-4xl">{categoryEmojis[e.category] || "📌"}</div>
                    <div className="text-xs px-3 py-1 rounded-full bg-gradient-to-r from-primary-100 to-accent-100 text-primary-700">
                      {e.isPublic ? "🌍 公开" : "🔒 私密"}
                    </div>
                  </div>
                  
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{e.title}</h3>
                  
                  <p className="text-sm text-gray-600 mb-3">{e.category}</p>
                  
                  <p className="text-gray-700 mb-4 line-clamp-3">{e.description}</p>
                  
                  <div className="text-xs text-gray-500 mb-4">
                    {new Date(Number(e.timestamp) * 1000).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>

                  <button
                    onClick={() => onGetMood(i + 1)}
                    className="btn-secondary w-full text-sm"
                  >
                    💖 查看心情分数
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mood Decryption */}
        {(moodHandle || clearMood !== undefined) && (
          <div className="glass-card p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">🔓 解密心情</h2>
            <div className="space-y-4">
              {selectedTokenId && (
                <div className="text-sm text-gray-600">
                  事件 ID: #{selectedTokenId}
                </div>
              )}
              
              {moodHandle && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">加密句柄</label>
                  <div className="input-field font-mono text-xs break-all bg-gray-50">
                    {moodHandle}
                  </div>
                </div>
              )}

              {clearMood !== undefined ? (
                <div className="p-6 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 text-center">
                  <div className="text-5xl font-bold text-gradient mb-2">{clearMood.toString()}</div>
                  <div className="text-gray-600">/ 100</div>
                </div>
              ) : moodHandle ? (
                <button
                  onClick={onDecryptMood}
                  disabled={isDecrypting}
                  className="btn-primary w-full"
                >
                  {isDecrypting ? "正在解密..." : "🔓 解密心情分数"}
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
