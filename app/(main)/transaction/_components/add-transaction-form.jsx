"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2 } from "lucide-react";
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
    watch,
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 hover:cursor-pointer">
      {/* Receipt Scanner - Only show in create mode */}
      {!editMode && <ReceiptScanner onScanComplete={handleScanComplete} />}

      {/* Voice based transaction  */}
      {!editMode && <VoiceTransactionRecorder onScanComplete={handleScanComplete} />}


      {/* Type */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Type</label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select onValueChange={field.onChange} value={field.value || ""}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EXPENSE">Expense</SelectItem>
                <SelectItem value="INCOME">Income</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.type && (
          <p className="text-sm text-red-500">{errors.type.message}</p>
        )}
      </div>

      {/* Amount and Account */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Amount</label>
          <Input
            type="number"
            step="0.01"
            placeholder="0.00"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-sm text-red-500">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Account</label>
          <Controller
            name="accountId"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} (&#8377;{parseFloat(account.balance).toFixed(2)})
                    </SelectItem>
                  ))}
                  <CreateAccountDrawer>
                    <Button
                      variant="ghost"
                      className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    >
                      Create Account
                    </Button>
                  </CreateAccountDrawer>
                </SelectContent>
              </Select>
            )}
          />
          {errors.accountId && (
            <p className="text-sm text-red-500">{errors.accountId.message}</p>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Category</label>
        <Controller
          name="category"
          control={control}
          render={({ field }) => {
            const currentType = getValues("type");
            const filteredCategories = categories.filter(
              (category) => category.type === currentType
            );
            return (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
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
            );
          }}
        />
        {errors.category && (
          <p className="text-sm text-red-500">{errors.category.message}</p>
        )}
      </div>

      {/* Date */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full pl-3 text-left font-normal",
                !getValues("date") && "text-muted-foreground"
              )}
            >
              {getValues("date") ? format(getValues("date"), "PPP") : <span>Pick a date</span>}
              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
        {errors.date && (
          <p className="text-sm text-red-500">{errors.date.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Input placeholder="Enter description" {...register("description")} />
        {errors.description && (
          <p className="text-sm text-red-500">{errors.description.message}</p>
        )}
      </div>

      {/* Recurring Toggle */}
      <div className="flex flex-row items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <label className="text-base font-medium">Recurring Transaction</label>
          <div className="text-sm text-muted-foreground">
            Set up a recurring schedule for this transaction
          </div>
        </div>
        <Switch
          checked={getValues("isRecurring")}
          onCheckedChange={(checked) => setValue("isRecurring", checked)}
        />
      </div>

      {/* Recurring Interval */}
      {getValues("isRecurring") && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Recurring Interval</label>
          <Controller
            name="recurringInterval"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
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
            <p className="text-sm text-red-500">
              {errors.recurringInterval.message}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 flex-col">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" className="w-full" disabled={transactionLoading}>
          {transactionLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {editMode ? "Updating..." : "Creating..."}
            </>
          ) : editMode ? (
            "Update Transaction"
          ) : (
            "Create Transaction"
          )}
        </Button>
      </div>
    </form>
  );
}