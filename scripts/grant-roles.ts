import "dotenv/config";
import * as hre from "hardhat";
import {
  keccak256,
  toUtf8Bytes,
  getAddress,
  Wallet,
  JsonRpcProvider,
  Contract,
} from "ethers";

async function grantRoleIfNeeded(
  contract: Contract,
  role: string,
  grantee: string,
  roleName: string
) {
  const already = await contract.hasRole(role, grantee);
  console.log(`🔍 hasRole(${roleName}, ${grantee})? =>`, already);

  if (!already) {
    const tx = await contract.grantRole(role, grantee);
    console.log(`   ⛓️  tx sent: ${tx.hash}`);
    await tx.wait();
    console.log(`   ✅ Granted ${roleName} to ${grantee}`);
  } else {
    console.log(`   ℹ️ ${roleName} already granted. Skipped.`);
  }
}

async function main() {
  // ===== ENV =====
  const ADMIN_PK = process.env.PRIVATE_KEY!;
  const RELAYER = getAddress(process.env.ADMIN_ADDRESS!);

  const TRYF_LENS = getAddress(process.env.RYF_LENS!);
  const MINTER_LENS = getAddress(process.env.BRIDGE_MINTER_LENS!);

  const TRYF_BSC = getAddress(process.env.RYF_BSC!);
  const GATEWAY_BSC = getAddress(process.env.BRIDGE_GATEWAY_BSC!);

  const LENS_RPC = process.env.RPC_LENS_MAINNET || "https://rpc.lens.xyz";
  const BSC_RPC = process.env.RPC_BSC_MAINNET || "https://bsc-dataseed.binance.org";

  if (!ADMIN_PK || !RELAYER || !TRYF_LENS || !MINTER_LENS || !GATEWAY_BSC) {
    throw new Error("❌ Missing env variables. Check .env file.");
  }

  console.log("\n========================================");
  console.log("🚀 START GRANTING ROLES FOR BRIDGE SYSTEM");
  console.log("========================================\n");

  // ===== ROLE CONSTANTS =====
  const MINTER_ROLE = keccak256(toUtf8Bytes("MINTER_ROLE"));
  const BRIDGE_ROLE = keccak256(toUtf8Bytes("BRIDGE_ROLE"));

  // ======================================================
  // 1) GRANT MINTER_ROLE TO BRIDGE_MINTER_LENS FOR TOKEN LENS
  // ======================================================
  {
    console.log("🔵 Step 1: Lens Chain → Grant MINTER_ROLE to BridgeMinterLens");

    const provider = new JsonRpcProvider(LENS_RPC);
    const wallet = new Wallet(ADMIN_PK, provider);

    // Load Rise_Your_Future_Token ABI
    const tokenArtifact = await hre.artifacts.readArtifact("Rise_Your_Future_Token");
    const tokenContract = new Contract(TRYF_LENS, tokenArtifact.abi, wallet);

    await grantRoleIfNeeded(
      tokenContract,
      MINTER_ROLE,
      MINTER_LENS,
      "MINTER_ROLE"
    );
  }

  // ======================================================
  // 2) GRANT BRIDGE_ROLE OF BridgeMinterLens TO RELAYER (ADMIN)
  // ======================================================
  {
    console.log("\n🔵 Step 2: Lens Chain → Grant BRIDGE_ROLE to RELAYER on BridgeMinterLens");

    const provider = new JsonRpcProvider(LENS_RPC);
    const wallet = new Wallet(ADMIN_PK, provider);

    const minterArtifact = await hre.artifacts.readArtifact("BridgeMinterLens");
    const minterContract = new Contract(
      MINTER_LENS,
      minterArtifact.abi,
      wallet
    );

    await grantRoleIfNeeded(
      minterContract,
      BRIDGE_ROLE,
      RELAYER,
      "BRIDGE_ROLE (Lens)"
    );
  }

  // ======================================================
  // 3) GRANT BRIDGE_ROLE OF BridgeGatewayBSC TO RELAYER
  // ======================================================
  {
    console.log("\n🟡 Step 3: BSC Chain → Grant BRIDGE_ROLE to RELAYER on BridgeGatewayBSC");

    const provider = new JsonRpcProvider(BSC_RPC);
    const wallet = new Wallet(ADMIN_PK, provider);

    const gatewayArtifact = await hre.artifacts.readArtifact("BridgeGatewayBSC");
    const gatewayContract = new Contract(
      GATEWAY_BSC,
      gatewayArtifact.abi,
      wallet
    );

    await grantRoleIfNeeded(
      gatewayContract,
      BRIDGE_ROLE,
      RELAYER,
      "BRIDGE_ROLE (BSC)"
    );
  }

  console.log("\n========================================");
  console.log("🎉 ALL ROLES GRANTED SUCCESSFULLY");
  console.log("========================================\n");
}

main().catch((err) => {
  console.error("❌ Script failed:", err);
  process.exit(1);
});
