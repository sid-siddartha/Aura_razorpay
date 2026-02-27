import Link from "next/link"; // ✅ Fix 1: default import
import { Button } from "../components/ui/button"; // ✅ Fix 2: Ensure this path is correct and Button is exported properly

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white text-center px-6">
      <h1 className="text-[4rem] font-extrabold bg-gradient-to-br from-blue-500 to-purple-600 text-transparent bg-clip-text">
        404 <br /> Page Not Found
      </h1>
      <p className="mt-4 text-lg text-gray-600 max-w-xl">
        Oops! The page you’re looking for doesn’t exist or has been moved.
      </p>
      <div className="mt-6 flex gap-4">
        <Link href="/" passHref>
          <Button className="px-6 py-2 text-base hover:cursor-pointer">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
