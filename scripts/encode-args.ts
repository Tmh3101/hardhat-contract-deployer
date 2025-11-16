import { AbiCoder } from "@ethersproject/abi";

// Usage: npx ts-node scripts/encode-args.ts "Name" "SYM" 0xadminAddress
const args = process.argv.slice(2);

if (args.length < 3) {
  console.error("Usage: npx ts-node scripts/encode-args.ts \"Name\" \"SYMBOL\" 0xAdminAddress");
  process.exit(1);
}

const [name, symbol, admin] = args;

try {
  const coder = new AbiCoder();
  const encoded = coder.encode(["string", "string", "address"], [name, symbol, admin]);
  console.log(encoded);
} catch (err: any) {
  console.error("Failed to encode arguments:", err.message || err);
  process.exit(2);
}
