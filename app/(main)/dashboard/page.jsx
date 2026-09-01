import { Suspense } from "react";
import { getDashboardData, getUserAccounts } from "@/actions/dashboard";
import { getCurrentBudget } from "@/actions/budget";
import { getAAConnection } from "@/actions/account-aggregator";
import { AccountCard } from "./_components/account-card";
import { BudgetProgress } from "./_components/budget-progress";
import { BankConnectionBanner } from "./_components/bank-connection-banner";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { DashboardOverview } from "./_components/dashboard-overview";

export default async function DashboardPage() {
  const [accounts, transactions, aaConnection] = await Promise.all([
    getUserAccounts(),
    getDashboardData(),
    getAAConnection(),
  ]);


  const defaultAccount = accounts?.find((account) => account.isDefault);

  // Get budget for default account
  let budgetData = null;
  if (defaultAccount) {
    budgetData = await getCurrentBudget(defaultAccount.id);
  }

  return (
    <div className="space-y-6">
      {/* Account Aggregator onboarding banner — shown until the user is CONNECTED */}
      <BankConnectionBanner aaConnection={aaConnection} />

      {/* Budget Progress */}
      <BudgetProgress
        initialBudget={budgetData?.budget}
        currentExpenses={budgetData?.currentExpenses || 0}
      />

      {/* Dashboard Overview */}
      <DashboardOverview
        accounts={accounts}
        transactions={transactions || []}
      />

      {/* Accounts Grid */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3 px-0.5">
          Your Accounts
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CreateAccountDrawer>
            <div className="group bg-white rounded-2xl border border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 flex flex-col items-center justify-center h-full min-h-[180px] cursor-pointer transition-all duration-200">
              <div className="w-12 h-12 bg-indigo-50 group-hover:bg-indigo-100 rounded-2xl flex items-center justify-center mb-3 transition-colors duration-200">
                <Plus className="h-6 w-6 text-indigo-400 group-hover:text-indigo-600 transition-colors duration-200" />
              </div>
              <p className="text-sm font-semibold text-gray-400 group-hover:text-indigo-600 transition-colors duration-200">
                Add New Account
              </p>
              <p className="text-xs text-gray-300 group-hover:text-indigo-400 mt-0.5 transition-colors duration-200">
                Click to create
              </p>
            </div>
          </CreateAccountDrawer>
          {accounts.length > 0 &&
            accounts?.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
        </div>
      </div>
    </div>
  );
}

