import { Suspense } from "react";
import { getAccountWithTransactions } from "@/actions/accounts";
import { BarLoader } from "react-spinners";
import { TransactionTable } from "./_components/transaction-table";
import { notFound } from "next/navigation";
import AccountChart from "./_components/account-chart";
import { ArrowUpRight, ArrowDownRight, Wallet, BarChart2 } from "lucide-react";

export default async function AccountPage({ params }) {
  const { id } = await params;
  const accountData = await getAccountWithTransactions(id);

  if (!accountData) notFound();

  const { transactions, ...account } = accountData;

  // Quick stats
  const totalIncome = transactions.filter(t => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-16">
      <div className="px-5 pt-6 max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left — account identity */}
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: "linear-gradient(135deg, #eef2ff, #e0e7ff)" }}
              >
                <Wallet className="w-7 h-7 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">
                  {account.type.charAt(0) + account.type.slice(1).toLowerCase()} Account
                </p>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-transparent bg-clip-text">
                  {account.name}
                </h1>
              </div>
            </div>

            {/* Right — balance */}
            <div className="text-right">
              <p className="text-xs text-gray-400 font-medium mb-1">Current Balance</p>
              <p className="text-4xl font-extrabold text-gray-900 tracking-tight">
                ₹{parseFloat(account.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-1">{account._count.transactions} transactions</p>
            </div>
          </div>

          {/* Stat pills */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-gray-100">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-emerald-600 mb-1">
                <ArrowUpRight className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Income</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                ₹{totalIncome.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center border-x border-gray-100">
              <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
                <ArrowDownRight className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Expense</span>
              </div>
              <p className="text-lg font-bold text-gray-900">
                ₹{totalExpense.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1"
                style={{ color: totalIncome - totalExpense >= 0 ? "#059669" : "#ef4444" }}
              >
                <BarChart2 className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-wide">Net</span>
              </div>
              <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {totalIncome - totalExpense >= 0 ? "+" : ""}₹{Math.abs(totalIncome - totalExpense).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        {/* Chart */}
        <Suspense fallback={<BarLoader className="mt-4" width="100%" color="#6366f1" />}>
          <AccountChart transactions={transactions} />
        </Suspense>

        {/* Transactions Table */}
        <Suspense fallback={<BarLoader className="mt-4" width="100%" color="#6366f1" />}>
          <TransactionTable transactions={transactions} />
        </Suspense>

      </div>
    </div>
  );
}