import { Deployer } from "@matterlabs/hardhat-zksync";
import { Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function (hre: HardhatRuntimeEnvironment) {
  const privateKey = process.env.PRIVATE_KEY;
  const token = process.env.RYF_LENS;        // địa chỉ token wrapped RYF trên Lens
  const admin = process.env.ADMIN_ADDRESS;   // ví admin / multisig
  const treasury = admin;     // ví nhận fee

  if (!privateKey) {
    throw new Error("❌ Missing PRIVATE_KEY in .env");
  }

  if (!token) {
    throw new Error("❌ Missing RYF_LENS (wrapped token address) in .env");
  }

  if (!admin) {
    throw new Error("❌ Missing ADMIN_ADDRESS in .env");
  }

  const wallet = new Wallet(privateKey);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("BridgeMinterLens");

  console.log("🚀 Deploying BridgeMinterLens...");
  const contract = await deployer.deploy(artifact, [token, admin]);
  const addr = await contract.getAddress();
  console.log("✅ BridgeMinterLens deployed at:", addr);

  console.log("🔍 Verifying BridgeMinterLens on explorer...");

  try {
    await hre.run("verify:verify", {
      address: addr,
      contract: "contracts/BridgeMinterLens.sol:BridgeMinterLens",
      constructorArguments: [token, admin],
    });

    console.log("✅ Verification successful!");
  } catch (err: any) {
    console.error("⚠️ Verification failed:", err?.message || err);
  }

  // ========== CONFIG FEE & LIMITS SAU KHI DEPLOY ==========
  // 0.3% = 30 bps
  const feeBps = 30;
  // minPerTx = 10 tRYF_Lens (giả định 18 decimals)
  const minPerTx = 10n * 10n ** 18n; // 10 * 1e18
  const maxPerTx = 0n;               // 0 = không giới hạn

  console.log("⚙️ Setting fee (0.3%) and limits (min=10, max=0)...");

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
