import "dotenv/config";
import "@matterlabs/hardhat-zksync-solc";
import "@matterlabs/hardhat-zksync-deploy";
import "@nomicfoundation/hardhat-toolbox";
import { HardhatUserConfig } from "hardhat/config";

const config: HardhatUserConfig = {
  solidity: "0.8.25",
  zksolc: {
    version: "1.5.1",
    compilerSource: "binary",
    settings: {},
  },
  networks: {
    lensTestnet: {
      chainId: 37111,
      url: "https://rpc.testnet.lens.xyz",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL: "https://block-explorer-verify.testnet.lens.xyz/contract_verification",
    },
    bscTestnet: {
      chainId: 97,
      url: process.env.BSC_RPC_HTTP || "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: process.env.PRIVATE_KEY_BSC ? [process.env.PRIVATE_KEY_BSC] : [],
    },
    hardhat: { zksync: true },
  },
  
  sourcify: {
    enabled: true
  }
};

export default config;
