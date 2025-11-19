import { HardhatRuntimeEnvironment } from "hardhat/types";
import { ethers } from "hardhat";

export default async function (hre: HardhatRuntimeEnvironment) {
  const token = process.env.RYF_BSC;          // địa chỉ RYF trên BSC
  const admin = process.env.ADMIN_ADDRESS;     // ví admin / multisig
  const dstChainIdEnv = 232;                  // chainId đích (Lens Mainnet)
  const treasury = admin;       // ví nhận fee

  if (!token) {
    throw new Error("❌ Missing TRYF_BSC (BSC token address) in .env");
  }

  if (!admin) {
    throw new Error("❌ Missing ADMIN_ADDRESS in .env");
  }

  if (!dstChainIdEnv) {
    throw new Error("❌ Missing BSC_DST_CHAIN_ID in .env");
  }

  if (!treasury) {
    throw new Error("❌ Missing TREASURY_ADDRESS in .env");
  }

  const dstChainId = BigInt(dstChainIdEnv); // uint256 trong constructor
  console.log("dstChainId:", dstChainId.toString());

  const [deployer] = await hre.ethers.getSigners();
  console.log("👤 Deployer address:", await deployer.getAddress());
  console.log("📦 Network:", hre.network.name);

  // ===== DEPLOY =====
  const Factory = await ethers.getContractFactory("BridgeGatewayBSC");
  console.log("🚀 Deploying BridgeGatewayBSC...");

  const contract = await Factory.deploy(token, admin, dstChainId);
  await contract.waitForDeployment();

  const addr = await contract.getAddress();
  console.log("✅ BridgeGatewayBSC deployed at:", addr);

  // ===== VERIFY SAU KHI DEPLOY =====
  console.log("🔍 Verifying BridgeGatewayBSC on explorer...");

  try {
    await hre.run("verify:verify", {
      address: addr,
      // chỉnh lại path nếu file nằm chỗ khác
      contract: "contracts/BridgeGatewayBSC.sol:BridgeGatewayBSC",
      constructorArguments: [token, admin, dstChainId],
    });

    console.log("✅ Verification successful!");
  } catch (err: any) {
    console.error("⚠️ Verification failed:", err?.message || err);
  }

  // ===== CONFIG FEE & LIMITS SAU KHI DEPLOY =====

  // 0.3% = 30 bps
  const feeBps = 30;

  // minPerTx = 10 RYF (giả định 18 decimals)
  const minPerTx = ethers.parseUnits("10", 18); // 10 * 1e18
  const maxPerTx = 0n;                          // 0 = không giới hạn

  console.log("⚙️ Setting fee (0.3%) and limits (min=10 RYF, max=0)...");

  // setFee(30, treasury)
  const txFee = await contract.setFee(feeBps, treasury);
  await txFee.wait();
  console.log("✅ setFee done:", feeBps, "bps, treasury:", treasury);

  // setLimits(10 * 1e18, 0)
  const txLimits = await contract.setLimits(minPerTx, maxPerTx);
  await txLimits.wait();
  console.log(
    "✅ setLimits done: minPerTx=",
    minPerTx.toString(),
    " maxPerTx=",
    maxPerTx.toString()
  );
}
