# Lens-Hardhat Bridge Project

Dự án bridge token giữa BSC Testnet và Lens Testnet, sử dụng Hardhat với zkSync plugin để deploy smart contracts lên Lens Chain (ZK rollup).

## 📋 Mục lục

- [Cài đặt](#-cài-đặt)
- [Cấu trúc dự án](#-cấu-trúc-dự-án)
- [Cấu hình môi trường](#-cấu-hình-môi-trường)
- [Deploy Contracts](#-deploy-contracts)
- [Scripts quản trị](#-scripts-quản-trị)

---

## 🚀 Cài đặt

### Yêu cầu hệ thống
- Node.js >= 16
- npm hoặc yarn
- Git

### Cài đặt dependencies

```bash
# Clone repository
git clone https://github.com/Tmh3101/hardhat-contract-deployer.git
cd lens-hardhat

# Cài đặt các gói thư viện
npm install
```

### Các gói thư viện chính

```json
{
  "devDependencies": {
    "@matterlabs/hardhat-zksync": "^1.6.2",           // ZKsync plugin cho Hardhat
    "@matterlabs/hardhat-zksync-deploy": "^1.8.0",   // Deploy lên ZKsync
    "@matterlabs/hardhat-zksync-solc": "^1.5.1",     // Compiler ZKsync
    "@nomicfoundation/hardhat-toolbox": "^6.1.0",    // Hardhat toolbox
    "@openzeppelin/contracts": "^5.4.0",              // OpenZeppelin contracts v5
    "hardhat": "^2.27.0",                             // Hardhat framework
    "ts-node": "^10.9.2",                             // TypeScript runtime
    "typescript": "^5.9.3",                           // TypeScript
    "zksync-ethers": "^6.21.0",                       // ZKsync ethers provider
    "dotenv": "^17.2.3"                               // Quản lý biến môi trường
  }
}
```

### Compile contracts

```bash
# Compile tất cả contracts (ZKsync mode)
npx hardhat compile

# Compile với stack traces (debug)
npx hardhat compile --show-stack-traces
```

---

## 📁 Cấu trúc dự án

```
lens-hardhat/
├── contracts/                      # Smart contracts (Solidity)
│   ├── BridgeGatewayBSC.sol       # Bridge gateway trên BSC (lock/unlock pool)
│   ├── BridgeMinterLens.sol       # Bridge minter trên Lens (mint/burn)
│   ├── tRYF_LensChain.sol         # Wrapped token trên Lens Chain (tRYF)
│   ├── Ruby_Token.sol             # Ruby token contract
│   └── interfaces/                 # Interfaces
│       └── IERC20MintableBurnable.sol
│
├── deploy/                         # Deploy scripts cho zkSync
│   ├── deploy-tryf.ts             # Deploy tRYF token lên Lens
│   ├── deploy-bridge-minter-lens.ts  # Deploy BridgeMinterLens
│   ├── deploy-bridge-gateway-bsc.ts  # Deploy BridgeGatewayBSC
│   └── deploy-ruby-token.ts       # Deploy Ruby Token
│
├── scripts/                        # Utility scripts
│   ├── encode-args.ts             # Encode constructor arguments
│   ├── grant-bridge-role-bsc.ts   # Grant BRIDGE_ROLE trên BSC
│   ├── grant-bridge-role-lens.ts  # Grant MINTER_ROLE trên Lens
│   ├── grant-minter-on-token.ts   # Grant MINTER_ROLE cho bridge
│   ├── lock-bsc.ts                # Lock tokens từ BSC
│   └── burn-lens.ts               # Burn tokens trên Lens
│
├── artifacts/                      # Compiled artifacts (standard)
├── artifacts-zk/                   # Compiled artifacts (ZKsync)
├── typechain-types/               # TypeScript typings cho contracts
├── hardhat.config.ts              # Hardhat configuration
├── tsconfig.json                  # TypeScript configuration
├── .env                           # Biến môi trường (cần tạo)
└── package.json                   # Dependencies
```

### Chi tiết contracts

#### 1. **tRYF_LensChain.sol** (`Testnet_Rise_Your_Future`)
- Token wrapped trên Lens Chain
- ERC20 với Mintable/Burnable, Pausable, Blacklist
- Initial supply = 0 (mint theo bridge)
- Roles: `MINTER_ROLE` (BridgeMinterLens), `PAUSER_ROLE`, `DEFAULT_ADMIN_ROLE`

#### 2. **BridgeMinterLens.sol**
- Bridge contract trên Lens Chain
- Chức năng: `mint()` (BSC → Lens), `burn()` (Lens → BSC)
- Tính phí bridge, chống double-mint
- Roles: `BRIDGE_ROLE` (relayer), `PAUSER_ROLE`

#### 3. **BridgeGatewayBSC.sol**
- Bridge contract trên BSC
- Chức năng: `lock()` (BSC → Lens), `unlock()` (Lens → BSC)
- Pool-based (lock/unlock token gốc)
- Roles: `BRIDGE_ROLE` (relayer), `PAUSER_ROLE`

#### 4. **Ruby_Token.sol**
- Token Ruby với free mint feature
- Pausable, Ownable

---

## ⚙️ Cấu hình môi trường

Tạo file `.env` ở thư mục root:

```bash
# Private keys
PRIVATE_KEY=0x...           # Private key để deploy lên Lens Testnet
PRIVATE_KEY_BSC=0x...       # Private key để deploy lên BSC Testnet

# Admin addresses
ADMIN_ADDRESS=0x...         # Địa chỉ admin (quản trị contracts)

# Network RPCs
BSC_RPC_HTTP=https://data-seed-prebsc-1-s1.binance.org:8545

# Contract addresses (sau khi deploy)
TRYF_BSC=0x...              # Địa chỉ token gốc trên BSC
TRYF_LENS=0x...             # Địa chỉ token wrapped trên Lens
BRIDGE_GATEWAY_BSC=0x...    # Địa chỉ BridgeGatewayBSC
BRIDGE_MINTER_LENS=0x...    # Địa chỉ BridgeMinterLens

# Bridge config
BSC_DST_CHAIN_ID=37111      # Lens Testnet chain ID

# Fee config (optional)
FEE_BPS=50                  # 0.5% (50 basis points)
TREASURY=0x...              # Địa chỉ nhận phí
```

---

## 🚢 Deploy Contracts

### Luồng deploy chuẩn

#### **Bước 1: Deploy lên Lens Testnet**

Các contract cần deploy lên Lens Chain (ZK rollup):

```bash
# 1. Deploy tRYF token (wrapped token)
npx hardhat deploy-zksync --script deploy-tryf.ts --network lensTestnet

# Cập nhật TRYF_LENS trong .env với địa chỉ vừa deploy

# 2. Deploy BridgeMinterLens
npx hardhat deploy-zksync --script deploy-bridge-minter-lens.ts --network lensTestnet

# Cập nhật BRIDGE_MINTER_LENS trong .env
```

#### **Bước 2: Deploy lên BSC Testnet** (nếu cần)

Nếu bạn deploy cả BridgeGatewayBSC:

```bash
# Deploy BridgeGatewayBSC
npx hardhat deploy-zksync --script deploy-bridge-gateway-bsc.ts --network bscTestnet

# Cập nhật BRIDGE_GATEWAY_BSC trong .env
```

> **Lưu ý**: BSC không dùng zkSync, nhưng Hardhat vẫn có thể deploy bình thường. Nếu muốn deploy BSC thuần, bạn có thể dùng `hardhat run` thay vì `deploy-zksync`.

#### **Bước 3: Grant roles**

```bash
# Grant MINTER_ROLE cho BridgeMinterLens trên token tRYF
npx ts-node scripts/grant-minter-on-token.ts

# Grant BRIDGE_ROLE cho relayer trên Lens
npx ts-node scripts/grant-bridge-role-lens.ts

# Grant BRIDGE_ROLE cho relayer trên BSC
npx ts-node scripts/grant-bridge-role-bsc.ts
```

### Cấu trúc deploy script

Các file deploy trong folder `deploy/` phải:
1. Export một `default async function` nhận `HardhatRuntimeEnvironment`
2. Sử dụng `Deployer` từ `@matterlabs/hardhat-zksync`
3. Tên file khớp với argument `--script` (relative path từ `deploy/`)

**Ví dụ**: `deploy/deploy-tryf.ts`

```typescript
import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("Testnet_Rise_Your_Future");

  const NAME = "Testnet Rise Your Future";
  const SYMBOL = "tRYF";
  const ADMIN = process.env.ADMIN_ADDRESS!;

  const contract = await deployer.deploy(artifact, [NAME, SYMBOL, ADMIN]);
  const addr = await contract.getAddress();
  console.log("✅ Testnet_Rise_Your_Future deployed at:", addr);
}
```

**Chạy deploy script:**

```bash
npx hardhat deploy-zksync --script <tên-file.ts> --network <network-name>
```

- `<tên-file.ts>`: Tên file trong folder `deploy/` (ví dụ: `deploy-tryf.ts`)
- `<network-name>`: Network trong `hardhat.config.ts` (ví dụ: `lensTestnet`)

---

## 🛠️ Scripts quản trị

### 1. Encode constructor arguments

```bash
npx ts-node scripts/encode-args.ts "Testnet Rise Your Future" "tRYF" 0xc7562ac08581e687ade8424f3f69f21fdb7879fb
```

Output: ABI-encoded hex string để verify contract trên block explorer.

### 2. Lock tokens (BSC → Lens)

```bash
npx ts-node scripts/lock-bsc.ts
```

Gửi tokens từ BSC sang Lens (gọi `lock()` trên BridgeGatewayBSC).

### 3. Burn tokens (Lens → BSC)

```bash
npx ts-node scripts/burn-lens.ts
```

Burn tokens trên Lens để unlock về BSC (gọi `burn()` trên BridgeMinterLens).

### 4. Grant roles

```bash
# Grant MINTER_ROLE
npx ts-node scripts/grant-minter-on-token.ts

# Grant BRIDGE_ROLE trên Lens
npx ts-node scripts/grant-bridge-role-lens.ts

# Grant BRIDGE_ROLE trên BSC
npx ts-node scripts/grant-bridge-role-bsc.ts
```

---

## 🌐 Networks

### Lens Testnet
- **Chain ID**: 37111
- **RPC**: https://rpc.testnet.lens.xyz
- **Explorer**: https://block-explorer.testnet.lens.xyz
- **Type**: zkSync Era

### BSC Testnet
- **Chain ID**: 97
- **RPC**: https://data-seed-prebsc-1-s1.binance.org:8545
- **Explorer**: https://testnet.bscscan.com
- **Type**: EVM

---

## 📝 Notes

### OpenZeppelin v5 Breaking Changes

Dự án sử dụng OpenZeppelin Contracts v5, một số module đã đổi path:
- ❌ `@openzeppelin/contracts/security/Pausable.sol`
- ✅ `@openzeppelin/contracts/utils/Pausable.sol`
- ❌ `@openzeppelin/contracts/security/ReentrancyGuard.sol`
- ✅ `@openzeppelin/contracts/utils/ReentrancyGuard.sol`

### Troubleshooting

**Error: Deploy script not found**
```bash
# Sai
npx hardhat deploy-zksync --script deploy/deploy-tryf.ts --network lensTestnet

# Đúng (chỉ tên file, không cần đường dẫn deploy/)
npx hardhat deploy-zksync --script deploy-tryf.ts --network lensTestnet
```

**Error: HH404 File not found (OpenZeppelin)**
```bash
# Chạy lại npm install để cài @openzeppelin/contracts
npm install
```

---