import { Provider, Wallet, Contract } from "zksync-ethers";
import { keccak256, toUtf8Bytes } from "ethers"; // v6
import * as hre from "hardhat";

async function main() {
  const TOKEN_ADDR   = process.env.TRYF_LENS!;         // địa chỉ token
  const MINTER_ADDR  = process.env.BRIDGE_MINTER!;     // BridgeMinterLens
  const ADMIN_PK     = process.env.PRIVATE_KEY!;       // ví đã được grant DEFAULT_ADMIN_ROLE trong constructor

  const provider = new Provider(hre.network.config.url as string); // https://rpc.testnet.lens.xyz
  const wallet   = new Wallet(ADMIN_PK, provider);                 // signer thực sự

  const artifact = await hre.artifacts.readArtifact("Testnet_Rise_Your_Future");
  const token = new Contract(TOKEN_ADDR, artifact.abi, wallet);    // contract GẮN signer

  const MINTER_ROLE = keccak256(toUtf8Bytes("MINTER_ROLE"));
  const tx = await token.grantRole(MINTER_ROLE, MINTER_ADDR);
  console.log("tx sent:", tx.hash);
  await tx.wait();
  console.log("✅ MINTER_ROLE granted to", MINTER_ADDR);
}

main().catch((e) => { console.error(e); process.exit(1); });
