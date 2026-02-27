import { getUserAccounts } from "@/actions/dashboard";
import { defaultCategories } from "@/data/categories";
import { AddTransactionForm } from "../_components/add-transaction-form";

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
    <div className="max-w-3xl mx-auto px-5">
      <div className="flex justify-center md:justify-normal mb-8">
        <h1 className="mx-auto text-4xl md:text-4xl lg:text-[90px] pb-6 font-extrabold tracking-tighter bg-gradient-to-br from-blue-600 to-purple-600 text-transparent bg-clip-text">
          Add Transaction
        </h1>
      </div>
      <AddTransactionForm accounts={accounts} categories={defaultCategories} />
    </div>
  );
}
