import DashboardPage from "./page";
import { BarLoader } from "react-spinners";
import { Suspense } from "react";

export default function Layout() {
  return (
    <div className="px-5 mt-[-10px]">
      <div className="flex items-center justify-between mb-5">
        <h1 className="mx-auto text-6xl md:text-4xl lg:text-[90px] pb-6 font-extrabold tracking-tighter bg-gradient-to-br from-blue-600 to-purple-600 text-transparent bg-clip-text">
          Dashboard
        </h1>
      </div>
      <Suspense
        fallback={<BarLoader className="mt-4" width={"100%"} color="#9333ea" />}
      >
        <DashboardPage />
      </Suspense>
    </div>
  );
}
