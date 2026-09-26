import Link from "next/link";
import { buttonVariants } from "@/lib/classes";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-xl place-items-center px-4 py-28 text-center">
      <p className="font-mono text-7xl font-semibold text-cyan text-neon">404</p>
      <h1 className="mt-4 text-2xl font-semibold">Nothing on this frequency</h1>
      <p className="mt-2 text-dim">The page or product you were looking for doesn&apos;t exist — or was removed from the catalogue.</p>
      <div className="mt-8 flex gap-3">
        <Link href="/products" className={buttonVariants.primary}>
          Browse products
        </Link>
        <Link href="/" className={buttonVariants.secondary}>
          Home
        </Link>
      </div>
    </div>
  );
}
