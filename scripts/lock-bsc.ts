import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseUnits, encodeFunctionData, getAddress, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains'; // hoặc tự define chainId=97

// ERC20 tối thiểu cho approve
const ERC20_ABI = [
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{type:'address'},{type:'address'}], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{type:'address'},{type:'uint256'}], outputs: [{ type: 'bool' }] },
] as const;

// BridgeGatewayBSC fragments
const BRIDGE_GATEWAY_BSC_ABI = parseAbi([
  "function lock(uint256 amount, address toOnLens) external",
  "event Locked(address indexed from, address indexed toOnLens, uint256 amount, uint256 nonce, uint256 dstChainId)"
]);

async function main() {
  const rpc = process.env.BSC_RPC_HTTP!;
  const pk  = process.env.BSC_PRIVATE_KEY as `0x${string}`;
  const token = getAddress(process.env.BSC_TOKEN_ADDRESS!);
  const pool  = getAddress(process.env.BSC_POOL_ADDRESS!);
  const toOnLens = getAddress(process.env.LENS_RECIPIENT!);

  // amount
  const decimals = Number(process.env.TOKEN_DECIMALS ?? 18);
  const amountWei = process.env.LOCK_AMOUNT_WEI
    ? BigInt(process.env.LOCK_AMOUNT_WEI)
    : parseUnits(process.env.LOCK_AMOUNT ?? '1', decimals);

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: bscTestnet, transport: http(rpc) });
  const walletClient = createWalletClient({ chain: bscTestnet, transport: http(rpc), account });

  console.log('From:', account.address);
  console.log('Token:', token);
  console.log('Pool :', pool);
  console.log('Lock Amount (wei):', amountWei.toString());

  // 1) Kiểm tra & approve nếu cần
  const allowance = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, pool],
  }) as bigint;

  if (allowance < amountWei) {
    console.log(`Allowance ${allowance} < amount ${amountWei}, approving...`);
    const approveHash = await walletClient.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [pool, amountWei],
    });
    console.log('approve tx:', approveHash);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  } else {
    console.log('Sufficient allowance.');
  }

  // 2) lock(amount, toOnLens)
  const data = encodeFunctionData({
    abi: BRIDGE_GATEWAY_BSC_ABI,
    functionName: 'lock',
    args: [amountWei, toOnLens],
  });

  const hash = await walletClient.sendTransaction({ to: pool, data });
  console.log('lock tx:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('lock status:', receipt.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});