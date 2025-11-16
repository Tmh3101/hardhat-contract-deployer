import { Deployer } from "@matterlabs/hardhat-zksync";
import { Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("BridgeGatewayBSC");
  const token = process.env.TRYF_BSC!;   
  const admin = process.env.ADMIN_ADDRESS!;    // ví admin/ multisig
  const dstChainId = process.env.BSC_DST_CHAIN_ID!;

  const contract = await deployer.deploy(artifact, [token, admin, dstChainId]);
  console.log("BridgeGatewayBSC deployed:", await contract.getAddress());
}
