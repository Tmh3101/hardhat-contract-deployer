import 'dotenv/config';
import { createWalletClient, createPublicClient, http, parseUnits, encodeFunctionData, getAddress, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { defineChain } from 'viem';

// Lens testnet chain
const lensTestnet = defineChain({
  id: 37111,
  name: 'Lens Testnet',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [process.env.LENS_RPC_HTTP!] } },
});

// ERC20 minimal
const ERC20_ABI = [
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{type:'address'},{type:'address'}], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{type:'address'},{type:'uint256'}], outputs: [{ type: 'bool' }] },
] as const;

// BridgeMinterLens
const BRIDGE_MINTER_LENS_ABI = parseAbi([
  "function burnToBsc(uint256 amount, address toOnBsc) external",
  "event Burned(address indexed from, uint256 amount, address indexed toOnBsc, uint256 nonce)"
]);

async function main() {
  const rpc = process.env.LENS_RPC_HTTP!;
  const pk  = process.env.LENS_PRIVATE_KEY as `0x${string}`;
  const token = getAddress(process.env.LENS_WRAPPED_ADDRESS!);
  const minter = getAddress(process.env.LENS_MINTER_ADDRESS!);
  const toOnBsc = getAddress(process.env.BSC_RECIPIENT!);

  const decimals = Number(process.env.TOKEN_DECIMALS ?? 18);
  const amountWei = process.env.BURN_AMOUNT_WEI
    ? BigInt(process.env.BURN_AMOUNT_WEI)
    : parseUnits(process.env.BURN_AMOUNT ?? '1', decimals);

  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: lensTestnet, transport: http(rpc) });
  const walletClient = createWalletClient({ chain: lensTestnet, transport: http(rpc), account });

  console.log('From:', account.address);
  console.log('Token:', token);
  console.log('Minter:', minter);
  console.log('Burn Amount (wei):', amountWei.toString());

  // 1) approve cho BridgeMinterLens để burnFrom
  const allowance = await publicClient.readContract({
    address: token,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, minter],
  }) as bigint;

  if (allowance < amountWei) {
    console.log(`Allowance ${allowance} < amount ${amountWei}, approving...`);
    const approveHash = await walletClient.writeContract({
      address: token,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [minter, amountWei],
    });
    console.log('approve tx:', approveHash);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  } else {
    console.log('Sufficient allowance.');
  }

  // 2) burnToBsc(amount, toOnBsc)
  const data = encodeFunctionData({
    abi: BRIDGE_MINTER_LENS_ABI,
    functionName: 'burnToBsc',
    args: [amountWei, toOnBsc],
  });

  const hash = await walletClient.sendTransaction({ to: minter, data });
  console.log('burn tx:', hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log('burn status:', receipt.status);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
