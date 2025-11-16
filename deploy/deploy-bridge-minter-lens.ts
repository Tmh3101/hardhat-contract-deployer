import { Deployer } from "@matterlabs/hardhat-zksync";
import { Wallet } from "zksync-ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("BridgeMinterLens");
  const token = process.env.TRYF_LENS!;        // địa chỉ token wrapped
  const admin = process.env.ADMIN_ADDRESS!;    // ví admin/ multisig

  const contract = await deployer.deploy(artifact, [token, admin]);
  console.log("BridgeMinterLens deployed:", await contract.getAddress());

  // (Tuỳ chọn) cấu hình phí ngay sau deploy
  if ((process.env.FEE_BPS ?? "0") !== "0") {
    const feeBps = BigInt(process.env.FEE_BPS!);
    const treasury = process.env.TREASURY!;
    const tx = await contract.setFee(feeBps, treasury);
    await tx.wait();
    console.log("setFee done:", feeBps.toString(), treasury);
  }
}
