import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";
import { LayoutDashboard, PenBox } from "lucide-react";
import { checkUser } from "../lib/checkUser";

const Header =async () => {
  await checkUser();
  return (
    <div className="fixed top-0 w-full bg-white/80 backdrop-md z-50 border-b">
      <nav className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/">
          <Image src={"/logo.png"}
          alt="aura logo"
          height={100}
          width={500}
          className="h-12 w-auto object-contain"
          />
        </Link>

      <div className="flex items-center space-x-4">
        <SignedIn>
          <Link
            href={"/dashboard"}
            className="text-gray-600 hover:text-blue-600 flex items-center gap-2"
          >
            <Button variant="outline" className={"hover:cursor-pointer"} >
              <LayoutDashboard size={18} />
              <span className="hidden md:inline">Dashboard</span>
            </Button>
          </Link>
          <Link href="/transaction/create">
            <Button className="flex items-center gap-2 hover:cursor-pointer">
              <PenBox size={18} />
              <span className="hidden md:inline">Add Transaction</span>
            </Button>
          </Link>
          <UserButton className="block"/>
        </SignedIn>
      </div>

      <SignedOut>
        <SignInButton>
          <Button variant={"outline"} className={"hover:cursor-pointer block"}>Login</Button>
        </SignInButton>
        </SignedOut>

      </nav>
    </div>
  );
};

export default Header;
