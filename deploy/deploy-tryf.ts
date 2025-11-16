import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("Testnet_Rise_Your_Future");

  // constructor(name, symbol, admin)
  const NAME = "Testnet Rise Your Future";
  const SYMBOL = "tRYF";
  const ADMIN = process.env.ADMIN_ADDRESS!;

  const contract = await deployer.deploy(artifact, [NAME, SYMBOL, ADMIN]);
  const addr = await contract.getAddress();
  console.log("✅ Testnet_Rise_Your_Future deployed at:", addr);
}
