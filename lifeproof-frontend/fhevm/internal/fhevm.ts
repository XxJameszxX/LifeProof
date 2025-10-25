import { Eip1193Provider, JsonRpcProvider } from "ethers";
import { RelayerSDKLoader } from "./RelayerSDKLoader";

export type FhevmInstance = any;

export type CreateFhevmInstanceParams = {
  provider: Eip1193Provider | string;
  mockChains?: Record<number, string>;
};

async function getChainId(providerOrUrl: Eip1193Provider | string): Promise<number> {
  if (typeof providerOrUrl === "string") {
    const p = new JsonRpcProvider(providerOrUrl);
    return Number((await p.getNetwork()).chainId);
  }
  const chainId = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  const v = await rpc.send("web3_clientVersion", []);
  rpc.destroy();
  return v as string;
}

async function getRelayerMetadata(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  const meta = await rpc.send("fhevm_relayer_metadata", []);
  rpc.destroy();
  return meta as { ACLAddress: string; InputVerifierAddress: string; KMSVerifierAddress: string };
}

export async function createFhevmInstance({ provider, mockChains }: CreateFhevmInstanceParams): Promise<FhevmInstance> {
  const chainId = await getChainId(provider);
  const chains: Record<number, string> = { 31337: "http://localhost:8545", ...(mockChains ?? {}) };
  const rpcUrl = typeof provider === "string" ? provider : chains[chainId];

  if (chains[chainId] && rpcUrl) {
    const version = await getWeb3Client(rpcUrl);
    if (version.toLowerCase().includes("hardhat")) {
      try {
        const meta = await getRelayerMetadata(rpcUrl);
        const mod = await import("./mock/fhevmMock");
        return mod.fhevmMockCreateInstance({ rpcUrl, chainId, metadata: meta });
      } catch {
        // fallthrough to relayer sdk
      }
    }
  }

  const loader = new RelayerSDKLoader();
  await loader.load();
  const sdk = (window as any).relayerSDK;
  if (!sdk.__initialized__) {
    await sdk.initSDK();
    sdk.__initialized__ = true;
  }
  return await sdk.createInstance({ ...sdk.SepoliaConfig, network: provider });
}


