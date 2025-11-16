import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("Ruby_Token");

  // constructor(name, symbol, admin)
  const NAME = "Ruby Token";
  const SYMBOL = "tRB";
  const ADMIN = "0x00399b4e7edcf538cc4ad03c4fcfe366b65234a6";

  const contract = await deployer.deploy(artifact, [NAME, SYMBOL, ADMIN]);
  const addr = await contract.getAddress();
  console.log("✅ Ruby_Token deployed at:", addr);
}
