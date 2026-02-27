"use client";
import { ArrowUpRight, ArrowDownRight, Wallet } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useEffect } from "react";
import useFetch from "@/hooks/use-fetch";
import Link from "next/link";
import { updateDefaultAccount } from "@/actions/accounts";
import { toast } from "sonner";

export function AccountCard({ account }) {
  const { name, type, balance, id, isDefault } = account;

  const {
    loading: updateDefaultLoading,
    fn: updateDefaultFn,
    data: updatedAccount,
    error,
  } = useFetch(updateDefaultAccount);

  const handleDefaultChange = async (event) => {
    event.preventDefault();
    if (isDefault) {
      toast.warning("You need at least 1 default account");
      return;
    }
    await updateDefaultFn(id);
  };

  useEffect(() => {
    if (updatedAccount?.success) toast.success("Default account updated successfully");
  }, [updatedAccount, updateDefaultLoading]);

  useEffect(() => {
    if (error) toast.warning(error.message || "Default account failed to update");
  }, [error]);

  return (
    <Link href={`/account/${id}`}>
      <div className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden cursor-pointer">
        {/* Top accent bar */}
        <div
          className="h-1 w-full"
          style={{
            background: isDefault
              ? "linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)"
              : "linear-gradient(90deg, #94a3b8, #cbd5e1)",
          }}
        />

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: isDefault
                    ? "linear-gradient(135deg, #eef2ff, #e0e7ff)"
                    : "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                }}
              >
                <Wallet
                  className="w-5 h-5"
                  style={{ color: isDefault ? "#6366f1" : "#94a3b8" }}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 leading-none mb-1">
                  {type.charAt(0) + type.slice(1).toLowerCase()}
                </p>
                <h3 className="text-sm font-bold text-gray-800 leading-none">{name}</h3>
              </div>
            </div>
            <Switch
              checked={isDefault}
              onClick={handleDefaultChange}
              disabled={updateDefaultLoading}
            />
          </div>

          {/* Balance */}
          <div className="mb-4">
            <p className="text-xs text-gray-400 font-medium mb-1">Current Balance</p>
            <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
              ₹{parseFloat(balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            {isDefault && (
              <span className="inline-block mt-2 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                ✦ Default Account
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-3 border-t border-gray-100 text-xs font-medium">
            <div className="flex items-center gap-1.5 text-emerald-600">
              <div className="w-5 h-5 bg-emerald-50 rounded-full flex items-center justify-center">
                <ArrowUpRight className="h-3 w-3" />
              </div>
              Income
            </div>
            <div className="flex items-center gap-1.5 text-red-500">
              <div className="w-5 h-5 bg-red-50 rounded-full flex items-center justify-center">
                <ArrowDownRight className="h-3 w-3" />
              </div>
              Expense
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
