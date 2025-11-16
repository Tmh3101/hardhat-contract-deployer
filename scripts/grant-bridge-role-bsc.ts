import "dotenv/config";
import * as hre from "hardhat";
import { keccak256, toUtf8Bytes, getAddress, Wallet, JsonRpcProvider, Contract } from "ethers";

async function main() {
  const ADMIN_PK      = process.env.PRIVATE_KEY!;
  const GATEWAY_ADDR  = getAddress(process.env.BRIDGE_GATEWAY_BSC!); // BridgeGatewayBSC trên BSC
  const RELAYER_ADDR  = getAddress(process.env.RELAYER_ADDRESS!);
  const RPC_URL       = process.env.BSC_RPC_HTTP || (hre.network.config.url as string);

  if (!ADMIN_PK || !GATEWAY_ADDR || !RELAYER_ADDR) {
    throw new Error("Missing env: PRIVATE_KEY_BSC / BRIDGE_GATEWAY_BSC / RELAYER_BSC");
  }

  // Provider + signer ethers v6 (EVM chuẩn, KHÔNG dùng zksync-ethers ở đây)
  const provider = new JsonRpcProvider(RPC_URL, { chainId: 97, name: "bsc-testnet" });
  const wallet   = new Wallet(ADMIN_PK, provider);

  // Lấy ABI BridgeGatewayBSC từ artifacts (đã compile bằng Hardhat)
  const artifact = await hre.artifacts.readArtifact("BridgeGatewayBSC");
  const gateway  = new Contract(GATEWAY_ADDR, artifact.abi, wallet);

  const BRIDGE_ROLE = keccak256(toUtf8Bytes("BRIDGE_ROLE"));

  // Kiểm tra trước
  const already = await gateway.hasRole(BRIDGE_ROLE, RELAYER_ADDR);
  console.log("hasRole(BRIDGE_ROLE, relayer)?", already);

  if (!already) {
    const tx = await gateway.grantRole(BRIDGE_ROLE, RELAYER_ADDR);
    console.log("tx sent:", tx.hash);
    await tx.wait();
    console.log("✅ BRIDGE_ROLE granted to", RELAYER_ADDR);
  } else {
    console.log("ℹ️ Role already granted. Nothing to do.");
  }

  // Xác minh lại
  const ok = await gateway.hasRole(BRIDGE_ROLE, RELAYER_ADDR);
  console.log("Verify hasRole:", ok);
  if (!ok) throw new Error("Grant failed?");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
