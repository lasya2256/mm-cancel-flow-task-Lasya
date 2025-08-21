// src/lib/db.ts
import { supabaseAdmin } from "./supabase";

export type Variant = "A" | "B";

// ---------- Common helpers ----------

export async function getMockUserId(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("email", "user@example.com")
    .single();

  if (error || !data) throw new Error("Mock user not found in DB");
  return data.id as string;
}

export async function getSubscription(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("id, monthly_price, pending_cancellation")
    .eq("user_id", userId)
    .single();

  if (error || !data) throw new Error("Subscription not found");
  return data;
}

// ---------- Flow actions ----------

/**
 * Start cancellation:
 *  - mark subscription as pending_cancellation
 *  - insert cancellations row with {user_id, downsell_variant, reason, accepted_downsell:false}
 */
export async function startCancellation(variant: Variant, reason?: string | null) {
  const userId = await getMockUserId();

  // mark subscription pending
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .update({ pending_cancellation: true })
    .eq("user_id", userId)
    .select("id")
    .single();

  if (subErr || !sub) throw new Error(subErr?.message ?? "Unable to mark pending");

  // insert cancellation row
  const { error: insErr } = await supabaseAdmin.from("cancellations").insert({
    user_id: userId,
    downsell_variant: variant,       // "A" or "B"
    reason: reason ?? null,
    accepted_downsell: false,
  });

  if (insErr) throw new Error(insErr.message);

  return true;
}

/**
 * Status: return the current monthly_price and pending_cancellation.
 * (Adjust shape as your UI needs.)
 */
export async function getCancellationStatus() {
  const userId = await getMockUserId();
  const { data, error } = await supabaseAdmin
    .from("subscriptions")
    .select("monthly_price, pending_cancellation")
    .eq("user_id", userId)
    .single();

  if (error || !data) throw new Error(error.message);
  return data; // { monthly_price, pending_cancellation }
}

/**
 * Accept downsell:
 *  - mark latest cancellation accepted_downsell=true
 *  - if variant === "B", drop price by $10 (never below 0)
 */
export async function acceptDownsell(): Promise<{ newPrice: number }> {
  const userId = await getMockUserId();

  // latest cancellation for this user
  const { data: latest, error: latestErr } = await supabaseAdmin
    .from("cancellations")
    .select("id, downsell_variant")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (latestErr || !latest) {
    throw new Error("No cancellation found for user");
  }

  // mark accepted
  const { error: updErr } = await supabaseAdmin
    .from("cancellations")
    .update({ accepted_downsell: true })
    .eq("id", latest.id);
  if (updErr) throw new Error(updErr.message);

  // current subscription
  const { data: sub, error: subErr } = await supabaseAdmin
    .from("subscriptions")
    .select("id, monthly_price")
    .eq("user_id", userId)
    .single();
  if (subErr || !sub) throw new Error(subErr?.message ?? "Subscription not found");

  let newPrice = sub.monthly_price;
  if (latest.downsell_variant === "B") {
    newPrice = Math.max(0, sub.monthly_price - 10); // $25→$15 or $29→$19
  }

  const { error: priceErr } = await supabaseAdmin
    .from("subscriptions")
    .update({ monthly_price: newPrice, pending_cancellation: false })
    .eq("id", sub.id);
  if (priceErr) throw new Error(priceErr.message);

  return { newPrice };
}
