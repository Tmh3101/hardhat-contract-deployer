Tuyệt—dưới đây là **runbook gọn – rõ – đủ lệnh** cho quy trình:

# Runbook: tRYF_Lens ↔ BridgeMinterLens (Lens Testnet)

> Môi trường giả định: Hardhat + zkSync plugin, cấu hình như bạn đã nêu (chainId 37111, zksolc 1.5.1).
> Biến môi trường cần có: `PRIVATE_KEY` (ví admin của token), `ADMIN_ADDRESS` (multisig/admin), `LENS_RPC_HTTP`.

---

## 0) Chuẩn bị

`.env.example`

```
PRIVATE_KEY=0x...
ADMIN_ADDRESS=0x...          # admin token (DEFAULT_ADMIN_ROLE, PAUSER_ROLE)
LENS_RPC_HTTP=https://rpc.testnet.lens.xyz
TOKEN_NAME=Testnet Rise Your Future
TOKEN_SYMBOL=tRYF
```

Cài deps:

```bash
npm i -D @matterlabs/hardhat-zksync zksync-ethers @openzeppelin/contracts @nomicfoundation/hardhat-toolbox
```

---

## 1) Deploy token `tRYF_Lens`

**deploy/deploy-token.ts**

```ts
import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("Testnet_Rise_Your_Future");
  const name   = process.env.TOKEN_NAME || "Testnet Rise Your Future";
  const symbol = process.env.TOKEN_SYMBOL || "tRYF";
  const admin  = process.env.ADMIN_ADDRESS!;

  const token = await deployer.deploy(artifact, [name, symbol, admin]);
  console.log("tRYF_Lens deployed at:", await token.getAddress());
}
```

Chạy:

```bash
npx hardhat deploy-zksync --script deploy/deploy-token.ts --network lensTestnet
```

> Kết quả: ghi lại `TOKEN_ADDRESS`.

---

## 2) Deploy `BridgeMinterLens`

**deploy/deploy-bridge-minter.ts**

```ts
import { Deployer } from "@matterlabs/hardhat-zksync";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet } from "zksync-ethers";

export default async function (hre: HardhatRuntimeEnvironment) {
  const wallet = new Wallet(process.env.PRIVATE_KEY!);
  const deployer = new Deployer(hre, wallet);

  const artifact = await deployer.loadArtifact("BridgeMinterLens");

  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as string; // set sau bước 1
  const ADMIN_ADDRESS = process.env.ADMIN_ADDRESS as string;

  const bridge = await deployer.deploy(artifact, [TOKEN_ADDRESS, ADMIN_ADDRESS]);
  console.log("BridgeMinterLens deployed at:", await bridge.getAddress());
}
```

Chạy:

```bash
# Sau khi có TOKEN_ADDRESS, export vào env:
# (Windows PowerShell)
$env:TOKEN_ADDRESS="0x..."; $env:ADMIN_ADDRESS="0x..."
npx hardhat deploy-zksync --script deploy/deploy-bridge-minter.ts --network lensTestnet
```

> Kết quả: ghi lại `BRIDGE_MINTER_ADDRESS`.

---

## 3) Grant `MINTER_ROLE` cho `BridgeMinterLens`

**Vấn đề bạn gặp phải (“contract runner does not support sending transactions”)** xảy ra khi tạo instance **không gắn signer** (chỉ có provider). Cách khắc phục: **tạo Wallet** (zksync-ethers) và **connect** contract với **wallet**.

**scripts/grant-minter-on-token.ts**

```ts
import { ethers } from "hardhat";
import { Wallet } from "zksync-ethers";

// MINTER_ROLE = keccak256("MINTER_ROLE")
const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

async function main() {
  const rpc = process.env.LENS_RPC_HTTP!;
  const pk  = process.env.PRIVATE_KEY!;
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as `0x${string}`;
  const BRIDGE_MINTER = process.env.BRIDGE_MINTER_ADDRESS as `0x${string}`;

  // signer ví admin (đã có DEFAULT_ADMIN_ROLE)
  const wallet = new Wallet(pk);
  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = wallet.connect(provider);

  // ABI tối thiểu: grantRole/hasRole
  const abi = [
    "function grantRole(bytes32 role, address account) external",
    "function hasRole(bytes32 role, address account) public view returns (bool)"
  ];

  const token = new ethers.Contract(TOKEN_ADDRESS, abi, signer);

  console.log("Grant MINTER_ROLE to:", BRIDGE_MINTER);
  const tx = await token.grantRole(MINTER_ROLE, BRIDGE_MINTER);
  console.log("tx:", tx.hash);
  await tx.wait();

  const ok:boolean = await token.hasRole(MINTER_ROLE, BRIDGE_MINTER);
  console.log("hasRole(MINTER_ROLE, BRIDGE_MINTER) =", ok);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Chạy:

```bash
$env:TOKEN_ADDRESS="0x..."; $env:BRIDGE_MINTER_ADDRESS="0x..."
npx hardhat run scripts/grant-minter-on-token.ts --network lensTestnet
```

**Lưu ý quan trọng:**

* Script **phải** dùng **Wallet + Provider** (không dùng contract runner mặc định read-only).
* `DEFAULT_ADMIN_ROLE` của token ban đầu thuộc `admin_` (tham số constructor). Chỉ địa chỉ **có DEFAULT_ADMIN_ROLE** mới `grantRole`.

---

## 4) Verify bằng `hasRole()` (tự động hoặc trên explorer)

### Bằng script (đã có trong script trên)

* Đã in `hasRole(MINTER_ROLE, BRIDGE_MINTER)` → phải **true**.

### Trên explorer

* Vào contract token → **Read Contract** → `hasRole(bytes32,address)`
* `role` =
  `0x9f2df0fed2c77648de5860a4cc508cd0818c89bdb72a0f97b4f5f266ff7cbf7a`
  (hash của `"MINTER_ROLE"`)
* `account` = `BRIDGE_MINTER_ADDRESS`
  → Kết quả **true**.

---

## 5) Revoke role không cần thiết (nếu có)

**scripts/revoke-minter.ts**

```ts
import { ethers } from "hardhat";
import { Wallet } from "zksync-ethers";

const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));

async function main() {
  const rpc = process.env.LENS_RPC_HTTP!;
  const pk  = process.env.PRIVATE_KEY!;
  const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS as `0x${string}`;
  const ACCOUNT = process.env.REVOKE_ACCOUNT as `0x${string}`;

  const wallet = new Wallet(pk);
  const provider = new ethers.JsonRpcProvider(rpc);
  const signer = wallet.connect(provider);

  const abi = [
    "function revokeRole(bytes32 role, address account) external",
    "function hasRole(bytes32 role, address account) public view returns (bool)"
  ];
  const token = new ethers.Contract(TOKEN_ADDRESS, abi, signer);

  const tx = await token.revokeRole(MINTER_ROLE, ACCOUNT);
  console.log("revoke tx:", tx.hash);
  await tx.wait();

  const ok:boolean = await token.hasRole(MINTER_ROLE, ACCOUNT);
  console.log("hasRole after revoke =", ok);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

Chạy:

```bash
$env:TOKEN_ADDRESS="0x..."; $env:REVOKE_ACCOUNT="0x..."
npx hardhat run scripts/revoke-minter.ts --network lensTestnet
```

---

## Câu hỏi thường gặp (FAQ)

**❓ Có thể cấp `MINTER_ROLE` cho nhiều địa chỉ/contract?**
✔️ Được. `AccessControl` hỗ trợ **nhiều member** cho một role.

**❓ Ai có quyền grant/revoke role?**
Chỉ **role admin** của role đó (mặc định là `DEFAULT_ADMIN_ROLE`). Với token của bạn, `admin_` (truyền trong constructor) là người có **DEFAULT_ADMIN_ROLE** ban đầu.

**❓ Lỗi “contract runner does not support sending transactions”?**
Do bạn tạo contract instance **không gắn signer** (read-only). Sửa bằng cách tạo **Wallet + Provider**, rồi `new ethers.Contract(..., signer)` hoặc `contract.connect(signer)`.

**❓ Không verify được trên explorer → có dùng được không?**
Vẫn **dùng bình thường** (chỉ kém minh bạch/UX admin). Trên Lens testnet, verification đôi khi khắt khe bản compiler/optimizer. Bạn có thể tạm bỏ qua khi test, nhưng **mainnet nên verify**.

---

## Kiểm tra cuối (sanity checks)

* [ ] Token triển khai xong, **không pre-mint** (wrapped) ✔️
* [ ] BridgeMinterLens triển khai xong ✔️
* [ ] `grantRole(MINTER_ROLE, BridgeMinterLens)` thành công (hasRole = true) ✔️
* [ ] Mint thử (gọi `mintTo` từ ví có **BRIDGE_ROLE** trong BridgeMinterLens) → user nhận **amount - fee**, `treasury` nhận **fee** ✔️
* [ ] Burn thử (user `burn(amount)` hoặc `burnToBsc` + approve) ✔️

Cần mình gộp sẵn 3 script (`deploy-token`, `deploy-bridge`, `grant-minter`) thành **một lệnh duy nhất** (kèm log địa chỉ) không? Mình có thể đưa file `package.json` scripts để bạn chạy “1-click” cho môi trường testnet.
