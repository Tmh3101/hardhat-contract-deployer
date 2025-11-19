import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  const privateKey = process.env.PRIVATE_KEY;
  const admin = process.env.ADMIN_ADDRESS;

  if (!privateKey) {
    throw new Error("❌ Missing PRIVATE_KEY in .env");
  }

  if (!admin) {
    throw new Error("❌ Missing ADMIN_ADDRESS in .env");
  }

  const wallet = new Wallet(privateKey);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("Rise_Your_Future_Token");

  // constructor(name, symbol, admin)
  const NAME = "Rise Your Future";
  const SYMBOL = "RYF";

  console.log("🚀 Deploying Rise_Your_Future_Token...");
  const contract = await deployer.deploy(artifact, [NAME, SYMBOL, admin]);
  const addr = await contract.getAddress();

  console.log("✅ Rise_Your_Future_Token deployed at:", addr);

  // ===== VERIFY SAU KHI DEPLOY =====
  console.log("🔍 Verifying contract on explorer...");
  try {
    await hre.run("verify:verify", {
      // address: addr,
      address: "0x93198F5e56443286b50Cf749dFb6A27f251aA630",
      contract: "contracts/RYF_LensChain.sol:Rise_Your_Future_Token",
      constructorArguments: [NAME, SYMBOL, admin],
    });

    console.log("✅ Verification successful!");
  } catch (err: any) {
    console.error("⚠️ Verification failed:", err.message || err);
  }
}
