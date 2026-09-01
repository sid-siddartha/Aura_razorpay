import DashboardPage from "./page";
import { BarLoader } from "react-spinners";
import { Suspense } from "react";

export default function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="px-5 pt-6 pb-16">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mx-auto text-6xl md:text-7xl lg:text-[80px] pb-3 font-extrabold tracking-tighter bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-transparent bg-clip-text">
            Dashboard
          </h1>
          <p className="text-sm text-gray-500 tracking-wide">
            Your financial overview at a glance
          </p>
        </div>

        <Suspense
          fallback={<BarLoader className="mt-4" width={"100%"} color="#6366f1" />}
        >
          <DashboardPage />
        </Suspense>
      </div>
    </div>
  );
}
