import * as hre from "hardhat";
import { Provider, Wallet, Contract } from "zksync-ethers";
import { keccak256, toUtf8Bytes, getAddress } from "ethers"; // ethers v6

async function main() {
  const ADMIN_PK       = process.env.PRIVATE_KEY!;
  const MINTER_ADDR    = getAddress(process.env.BRIDGE_MINTER!);     // BridgeMinterLens
  const RELAYER_ADDR   = getAddress(process.env.RELAYER_ADDRESS!);   // ví nóng relayer
  const RPC_URL        = process.env.LENS_RPC!;  // https://rpc.testnet.lens.xyz

  if (!ADMIN_PK || !MINTER_ADDR || !RELAYER_ADDR) {
    throw new Error("Missing env: PRIVATE_KEY / BRIDGE_MINTER / RELAYER_LENS");
  }

  // Kết nối signer thật (tránh lỗi "contract runner does not support sending transactions")
  const provider = new Provider(RPC_URL);
  const wallet   = new Wallet(ADMIN_PK, provider);

  // Đọc ABI của BridgeMinterLens (đã compile trong project)
  const artifact = await hre.artifacts.readArtifact("BridgeMinterLens");
  const minter   = new Contract(MINTER_ADDR, artifact.abi, wallet);

  // Hash role
  const BRIDGE_ROLE = keccak256(toUtf8Bytes("BRIDGE_ROLE"));

  // Kiểm tra trước khi cấp
  const already = await minter.hasRole(BRIDGE_ROLE, RELAYER_ADDR);
  console.log("hasRole(BRIDGE_ROLE, relayer)?", already);

  if (!already) {
    const tx = await minter.grantRole(BRIDGE_ROLE, RELAYER_ADDR);
    console.log("tx sent:", tx.hash);
    await tx.wait();
    console.log("✅ BRIDGE_ROLE granted to", RELAYER_ADDR);
  } else {
    console.log("ℹ️ Role already granted. Nothing to do.");
  }

  // Verify lại
  const ok = await minter.hasRole(BRIDGE_ROLE, RELAYER_ADDR);
  console.log("Verify hasRole:", ok);
  if (!ok) throw new Error("Grant failed?");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
