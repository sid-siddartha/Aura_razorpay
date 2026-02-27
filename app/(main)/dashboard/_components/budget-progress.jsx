"use client";

import { useState, useEffect } from "react";
import { Pencil, Check, X, TrendingUp } from "lucide-react";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBudget } from "@/actions/budget";

export function BudgetProgress({ initialBudget, currentExpenses }) {
  const [isEditing, setIsEditing] = useState(false);
  const [newBudget, setNewBudget] = useState(
    initialBudget?.amount?.toString() || ""
  );

  const {
    loading: isLoading,
    fn: updateBudgetFn,
    data: updatedBudget,
    error,
  } = useFetch(updateBudget);

  const percentUsed = initialBudget
    ? Math.min((currentExpenses / initialBudget.amount) * 100, 100)
    : 0;

  // Color scheme based on usage
  const scheme =
    percentUsed >= 90
      ? { bar: "from-red-400 to-rose-500", chip: "bg-red-50 text-red-600 border-red-100", icon: "bg-red-50 text-red-500" }
      : percentUsed >= 75
        ? { bar: "from-amber-400 to-orange-400", chip: "bg-amber-50 text-amber-700 border-amber-100", icon: "bg-amber-50 text-amber-500" }
        : { bar: "from-indigo-400 to-violet-500", chip: "bg-indigo-50 text-indigo-700 border-indigo-100", icon: "bg-indigo-50 text-indigo-500" };

  const handleUpdateBudget = async () => {
    const amount = parseFloat(newBudget);
    if (isNaN(amount) || amount <= 0) { toast.error("Please enter a valid amount"); return; }
    await updateBudgetFn(amount);
  };

  const handleCancel = () => {
    setNewBudget(initialBudget?.amount?.toString() || "");
    setIsEditing(false);
  };

  useEffect(() => { if (updatedBudget?.success) { setIsEditing(false); toast.success("Budget updated successfully"); } }, [updatedBudget]);
  useEffect(() => { if (error) toast.error(error.message || "Failed to update budget"); }, [error]);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${scheme.icon}`}>
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 leading-none">Monthly Budget</p>
            <p className="text-xs text-gray-400 mt-0.5">Default account spending</p>
          </div>
        </div>

        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={newBudget}
              onChange={(e) => setNewBudget(e.target.value)}
              className="w-28 h-8 text-sm border-gray-200"
              placeholder="Amount"
              autoFocus
              disabled={isLoading}
            />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" onClick={handleUpdateBudget} disabled={isLoading}>
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleCancel} disabled={isLoading}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
            onClick={() => setIsEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {initialBudget ? (
        <>
          {/* Amount row */}
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-2xl font-extrabold text-gray-900 tracking-tight">
                ₹{currentExpenses.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                of ₹{initialBudget.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })} budget
              </p>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${scheme.chip}`}>
              {percentUsed.toFixed(1)}% used
            </span>
          </div>

          {/* Progress track */}
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${scheme.bar} transition-all duration-700`}
              style={{ width: `${percentUsed}%` }}
            />
          </div>

          {/* Remaining */}
          {percentUsed < 100 && (
            <p className="text-xs text-gray-400 text-right mt-1.5">
              ₹{(initialBudget.amount - currentExpenses).toLocaleString("en-IN", { minimumFractionDigits: 2 })} remaining
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-gray-400 mb-3">No budget set yet</p>
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="text-xs border-indigo-200 text-indigo-600 hover:bg-indigo-50">
            Set a Budget
          </Button>
        </div>
      )}
    </div>
  );
}