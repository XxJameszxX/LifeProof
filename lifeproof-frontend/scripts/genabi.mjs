import { promises as fs } from "fs";
import path from "path";

const ROOT = path.resolve(process.cwd(), "..");
const HARDHAT_DEPLOYMENTS = path.join(
  ROOT,
  "lifeproof-hardhat-template",
  "deployments"
);
const SITE_ABI_DIR = path.resolve(process.cwd(), "abi");

async function main() {
  await fs.mkdir(SITE_ABI_DIR, { recursive: true });

  // Copy ABI from artifacts if needed (we rely on TypeScript ABI stub here)
  // Only update addresses from deployments/*/LifeProof.json
  const networks = await fs.readdir(HARDHAT_DEPLOYMENTS);
  const map = {};
  for (const net of networks) {
    const p = path.join(HARDHAT_DEPLOYMENTS, net, "LifeProof.json");
    try {
      const j = JSON.parse(await fs.readFile(p, "utf-8"));
      // Some hardhat-deploy outputs don't include chainId; fallback by well-known network name
      const chainIdMap = { sepolia: 11155111, localhost: 31337, hardhat: 31337 };
      const chainId = j.chainId ?? chainIdMap[net];
      if (!chainId) throw new Error(`Unknown chainId for network ${net}`);
      map[chainId.toString()] = {
        address: j.address,
        chainId,
        chainName: net,
      };
    } catch {}
  }

  const addrFile = path.join(SITE_ABI_DIR, "LifeProofAddresses.ts");
  const content = `export const LifeProofAddresses: Record<string, { address: \`0x${"${string}"}\`; chainId: number; chainName?: string }> = ${JSON.stringify(
    map,
    null,
    2
  )};\n`;
  await fs.writeFile(addrFile, content);
  console.log("Updated:", addrFile);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


