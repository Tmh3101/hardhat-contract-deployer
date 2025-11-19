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
    settings: {
      optimizer: {
        enabled: false,
        runs: 200,
      },
    },
  },
  networks: {
    // Testnet
    lensTestnet: {
      chainId: 37111,
      url: "https://rpc.testnet.lens.xyz",
      ethNetwork: "sepolia",
      zksync: true,
      verifyURL: "https://block-explorer-verify.testnet.lens.xyz/contract_verification",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    bscTestnet: {
      chainId: 97,
      url: process.env.BSC_RPC_HTTP || "https://data-seed-prebsc-1-s1.binance.org:8545",
      zksync: false,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // Mainnet
    lensMainnet: {
      chainId: 232, 
      ethNetwork: "sepolia",
      url: process.env.RPC_LENS_MAINNET || "https://rpc.lens.xyz",
      verifyURL: "https://verify.lens.xyz/contract_verification",
      zksync: true,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    bscMainnet: {
      chainId: 56,
      url: process.env.RPC_BSC_MAINNET || "https://bsc-dataseed.binance.org",
      zksync: false,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // hardhat localnet
    hardhat: { zksync: true },
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY || "",
  },
  sourcify: {
    enabled: true
  }
};

export default config;
