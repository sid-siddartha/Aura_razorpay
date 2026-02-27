"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarIcon,
  Loader2,
  DollarSign,
  Wallet,
  Tag,
  CalendarDays,
  FileText,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { cn } from "@/lib/utils";
import { createTransaction, updateTransaction } from "@/actions/transaction";
import { transactionSchema } from "@/lib/schema";
import { ReceiptScanner } from "./recipt-scanner";
import { VoiceTransactionRecorder } from "./VoiceTransactionRecorder";

export function AddTransactionForm({
  accounts,
  categories,
  editMode = false,
  initialData = null,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
    reset,
    control,
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues:
      editMode && initialData
        ? {
          type: initialData.type,
          amount: initialData.amount.toString(),
          description: initialData.description,
          accountId: initialData.accountId,
          category: initialData.category,
          date: new Date(initialData.date),
          isRecurring: initialData.isRecurring,
          ...(initialData.recurringInterval && {
            recurringInterval: initialData.recurringInterval,
          }),
        }
        : {
          type: "EXPENSE",
          amount: "",
          description: "",
          accountId: accounts.find((ac) => ac.isDefault)?.id,
          date: new Date(),
          isRecurring: false,
        },
  });

  const {
    loading: transactionLoading,
    fn: transactionFn,
    data: transactionResult,
  } = useFetch(editMode ? updateTransaction : createTransaction);

  // Use useWatch instead of watch() to avoid extra re-renders
  const currentType = useWatch({ control, name: "type" });
  const isRecurring = useWatch({ control, name: "isRecurring" });

  // Memoize filtered categories so it's stable across renders
  const filteredCategories = useMemo(
    () => categories.filter((category) => category.type === currentType),
    [categories, currentType]
  );

  const onSubmit = (data) => {
    console.log("Form submit triggered with data:", data);
    const formData = {
      ...data,
      amount: parseFloat(data.amount),
    };
    console.log("Parsed form data before server call:", formData);

    if (editMode) {
      console.log("Calling updateTransaction with:", editId, formData);
      transactionFn(editId, formData);
    } else {
      console.log("Calling createTransaction with:", formData);
      transactionFn(formData);
    }
  };

  const handleScanComplete = (scannedData) => {
    console.log("handleScanComplete called with:", scannedData);
    console.log("Available categories:", categories);

    // Handle scanned data - populate form even with partial data
    if (scannedData && Object.keys(scannedData).length > 0) {
      // Set date (always available, even in fallback)
      if (scannedData.date) {
        const dateValue = scannedData.date instanceof Date
          ? scannedData.date
          : new Date(scannedData.date);
        setValue("date", dateValue);
      }

      // Set amount (may be 0 in fallback cases)
      if (scannedData.amount !== undefined) {
        setValue("amount", scannedData.amount.toString());
      }

      // Set description (always set, even if it's a fallback message)
      if (scannedData.description) {
        setValue("description", scannedData.description);
      }

      // Set merchant name if available
      if (scannedData.merchantName) {
        // Add merchant name to description if not already present
        const currentDesc = getValues("description") || "";
        if (currentDesc && !currentDesc.includes(scannedData.merchantName)) {
          setValue("description", `${scannedData.merchantName} - ${currentDesc}`);
        } else if (!currentDesc) {
          setValue("description", scannedData.merchantName);
        }
      }

      // Validate and set category
      if (scannedData.category) {
        console.log("Scanned category:", scannedData.category);
        const categoryExists = categories.find(cat => cat.id === scannedData.category);
        console.log("Category exists in list:", categoryExists);

        if (categoryExists) {
          setValue("type", categoryExists.type);
          setValue("category", scannedData.category);
        } else {
          console.warn(`Category "${scannedData.category}" not found, using other-expense`);
          setValue("type", "EXPENSE");
          setValue("category", "other-expense");
        }
      } else {
        // No category returned, default to EXPENSE
        console.log("No category in scanned data, defaulting to EXPENSE");
        setValue("type", "EXPENSE");
      }

      // Show appropriate toast message
      if (scannedData._fallback || scannedData._manualEntry) {
        toast.info("Voice recorded - please enter transaction details");
      } else if (scannedData.amount && scannedData.amount > 0) {
        toast.success("Voice transaction processed successfully");
      } else if (scannedData._source === "voice") {
        toast.info("Voice processed - please verify and enter amount");
      } else {
        toast.info("Data extracted - please verify details");
      }
    } else {
      // Empty object returned
      console.info("Scan complete but no data extracted");
      toast.warning("Could not extract receipt data - please enter manually");
    }
  };

  useEffect(() => {
    if (transactionResult?.success && !transactionLoading) {
      toast.success(
        editMode
          ? "Transaction updated successfully"
          : "Transaction created successfully"
      );
      reset();
      router.push(`/account/${transactionResult.data.accountId}`);
    } else if (transactionResult?.success === false && !transactionLoading) {
      // Handle error response from server action
      toast.error(transactionResult.error || "Failed to save transaction");
    }
  }, [transactionResult, transactionLoading, editMode]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* AI Helpers */}
      {!editMode && (
        <div className="grid grid-cols-2 gap-3">
          <ReceiptScanner onScanComplete={handleScanComplete} />
          <VoiceTransactionRecorder onScanComplete={handleScanComplete} />
        </div>
      )}

      {/* Divider */}
      {!editMode && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-100" />
          <p className="text-xs text-gray-400 font-medium">or fill manually</p>
          <div className="flex-1 h-px bg-gray-100" />
        </div>
      )}

      {/* Type — pill toggle */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
          <Tag className="w-3.5 h-3.5 text-indigo-400" />
          Transaction Type
        </label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <div className="flex rounded-xl border border-gray-200 overflow-hidden">
              {["EXPENSE", "INCOME"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => field.onChange(t)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold transition-all duration-200 ${field.value === t
                    ? t === "EXPENSE"
                      ? "bg-red-50 text-red-600 border-r border-gray-200"
                      : "bg-emerald-50 text-emerald-600"
                    : "bg-white text-gray-400 hover:bg-gray-50"
                    }`}
                >
                  {t === "EXPENSE" ? (
                    <ArrowDownRight className="w-4 h-4" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4" />
                  )}
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          )}
        />
        {errors.type && <p className="text-xs text-red-500">{errors.type.message}</p>}
      </div>

      {/* Amount and Account */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
            <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
            Amount
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">₹</span>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              className="pl-7 border-gray-200 focus:border-indigo-300 focus:ring-indigo-200"
              {...register("amount")}
            />
          </div>
          {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
            <Wallet className="w-3.5 h-3.5 text-indigo-400" />
            Account
          </label>
          <Controller
            name="accountId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} (₹{parseFloat(account.balance).toFixed(2)})
                    </SelectItem>
                  ))}
                  <CreateAccountDrawer>
                    <Button
                      variant="ghost"
                      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      + Create Account
                    </Button>
                  </CreateAccountDrawer>
                </SelectContent>
              </Select>
            )}
          />
          {errors.accountId && <p className="text-xs text-red-500">{errors.accountId.message}</p>}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
          <Tag className="w-3.5 h-3.5 text-indigo-400" />
          Category
        </label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || undefined}>
              <SelectTrigger className="border-gray-200">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
          <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
          Date
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full pl-3 text-left font-normal border-gray-200 hover:bg-gray-50",
                !getValues("date") && "text-gray-400"
              )}
            >
              {getValues("date") ? format(getValues("date"), "PPP") : <span>Pick a date</span>}
              <CalendarIcon className="ml-auto h-4 w-4 text-gray-400" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={getValues("date")}
              onSelect={(date) => setValue("date", date)}
              disabled={(date) =>
                date > new Date() || date < new Date("1900-01-01")
              }
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {errors.date && <p className="text-xs text-red-500">{errors.date.message}</p>}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          Description
        </label>
        <Input
          placeholder="e.g. Grocery run at BigBazaar"
          className="border-gray-200 focus:border-indigo-300 focus:ring-indigo-200"
          {...register("description")}
        />
        {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
      </div>

      {/* Separator */}
      <div className="h-px bg-gray-100" />

      {/* Recurring Toggle */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">Recurring Transaction</p>
            <p className="text-xs text-gray-400">Automatically repeats on a set schedule</p>
          </div>
        </div>
        <Switch
          checked={isRecurring}
          onCheckedChange={(checked) => setValue("isRecurring", checked)}
        />
      </div>

      {/* Recurring Interval */}
      {isRecurring && (
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-500">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
            Repeat Every
          </label>
          <Controller
            name="recurringInterval"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || undefined}>
                <SelectTrigger className="border-gray-200">
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
          {errors.recurringInterval && (
            <p className="text-xs text-red-500">{errors.recurringInterval.message}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 pt-2">
        <Button
          type="submit"
          className="w-full h-11 text-sm font-semibold rounded-xl text-white shadow-sm"
          style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1, #8b5cf6)" }}
          disabled={transactionLoading}
        >
          {transactionLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {editMode ? "Updating..." : "Saving..."}
            </>
          ) : editMode ? (
            "Update Transaction"
          ) : (
            "Save Transaction"
          )}
        </Button>
        <button
          type="button"
          onClick={() => router.back()}
          className="w-full h-10 text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}