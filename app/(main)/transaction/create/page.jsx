import { getUserAccounts } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import { AddTransactionForm } from "../_components/add-transaction-form";
import { ArrowLeftRight } from "lucide-react";

export default async function AddTransactionPage({ searchParams }) {
  const accounts = await getUserAccounts();
  const params = await searchParams;
  const editId = params?.edit;

  let initialData = null;
  if (editId) {
    const transaction = await getTransaction(editId);
    initialData = transaction;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 pb-16">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        {/* Page Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: "linear-gradient(135deg, #eef2ff, #e0e7ff)" }}>
            <ArrowLeftRight className="w-7 h-7 text-indigo-600" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-transparent bg-clip-text pb-1">
            {editId ? "Edit Transaction" : "Add Transaction"}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {editId ? "Update your transaction details below" : "Record a new income or expense entry"}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm shadow-gray-100 p-6 md:p-8">
          <AddTransactionForm
            accounts={accounts}
            categories={defaultCategories}
            editMode={!!editId}
            initialData={initialData}
          />
        </div>
      </div>
    </div>
  );
}

