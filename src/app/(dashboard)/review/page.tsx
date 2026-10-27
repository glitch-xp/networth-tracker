import { createClient } from "@/lib/supabase/server";
import { ReviewQueue } from "@/features/review/review-queue";
import type { ReviewQueueItem, Transaction } from "@/lib/supabase/types";

export const metadata = {
  title: "Review — FinanceOS",
  description: "Review uncertain transactions flagged by AI",
};

interface ReviewItemWithTransaction extends ReviewQueueItem {
  transaction?: Transaction;
}

export default async function ReviewPage() {
  const supabase = await createClient();

  // Fetch review items with their associated transactions
  const { data: reviewItems } = await supabase
    .from("review_queue")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  const items: ReviewItemWithTransaction[] = [];

  if (reviewItems) {
    for (const item of reviewItems as unknown as ReviewQueueItem[]) {
      let transaction: Transaction | undefined;

      if (item.entity_type === "transaction") {
        const { data: tx } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", item.entity_id)
          .single();

        if (tx) {
          transaction = tx as unknown as Transaction;
        }
      }

      items.push({ ...item, transaction });
    }
  }

  return <ReviewQueue initialItems={items} />;
}
