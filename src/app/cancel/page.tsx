"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// secure 50/50 assignment and persist locally so it doesn't change on refresh
function assignVariant(): "A" | "B" {
  const b = new Uint8Array(1);
  crypto.getRandomValues(b);
  return (b[0] & 1) === 0 ? "A" : "B";
}

type Step = "reason" | "offer" | "confirm" | "done" | "kept";

export default function CancelPage() {
  const router = useRouter();

  // UI state
  const [variant, setVariant] = useState<"A" | "B" | null>(null);
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // for showing price on offer screen
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);

  // choose and persist deterministic A/B on first visit
  useEffect(() => {
    let saved = localStorage.getItem("cancel-variant") as "A" | "B" | null;
    if (!saved) {
      saved = assignVariant();
      localStorage.setItem("cancel-variant", saved);
    }
    setVariant(saved);
  }, []);

  // after we start the flow, we can fetch status (to get price)
  async function fetchStatus() {
    try {
      const res = await fetch("/api/cancel/status");
      const data = await res.json();
      // you can adapt this if your status payload is different
      if (data?.monthly_price != null) {
        setCurrentPrice(data.monthly_price);
      }
    } catch {}
  }

  // STEP 1: user chooses reason → call /api/cancel/start
  async function onContinueFromReason() {
    if (!variant) return;
    setLoading(true);
    try {
      const res = await fetch("/api/cancel/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variant, reason }),
      });
      const data = await res.json();
      if (!data?.ok) {
        console.error("start error", data?.error);
        return;
      }

      // pull current price so we can show "$10 off" math on offer screen
      await fetchStatus();

      // if Variant B, show the Offer screen; A goes straight to Confirm
      setStep(variant === "B" ? "offer" : "confirm");
    } catch (err) {
      console.error("start exception", err);
    } finally {
      setLoading(false);
    }
  }

  // STEP 2a: user accepts offer → call /api/cancel/accept
  async function onAcceptOffer() {
    setLoading(true);
    try {
      const res = await fetch("/api/cancel/accept", { method: "POST" });
      const data = await res.json();
      if (!data?.ok) {
        console.error("accept error", data?.error);
        return;
      }
      // show "Thanks for staying!" screen
      setCurrentPrice(data.newPrice ?? currentPrice);
      setStep("kept");
    } catch (err) {
      console.error("accept exception", err);
    } finally {
      setLoading(false);
    }
  }

  // STEP 2b: user declines offer → go to Confirm
  function onDeclineOffer() {
    setStep("confirm");
  }

  // STEP 3: confirm cancel (we already created the cancellation on start)
  function onConfirmCancel() {
    setStep("done");
  }

  // ----- UI -----

  const disabledContinue = !reason || loading;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-xl w-full">
        {/* Reason */}
        {step === "reason" && (
          <>
            <div className="flex items-center gap-6 text-sm text-gray-600 mb-6">
              <span className="font-semibold text-black">1. Reason</span>
              <span>2. Offer</span>
              <span>3. Confirm</span>
              <span>4. Done</span>
            </div>

            <h1 className="text-2xl font-bold mb-6">Why are you cancelling?</h1>

            <div className="space-y-3">
              {[
                "It’s too expensive",
                "I don’t use it enough",
                "Missing features I need",
                "I’m hitting bugs or issues",
                "Other",
              ].map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`w-full text-left px-4 py-3 rounded-lg border ${
                    reason === r ? "border-black" : "border-gray-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <button
              onClick={onContinueFromReason}
              disabled={disabledContinue}
              className={`mt-6 w-full h-12 rounded-lg ${
                disabledContinue
                  ? "bg-gray-200 text-gray-500"
                  : "bg-black text-white"
              }`}
            >
              {loading ? "Please wait..." : "Continue"}
            </button>
          </>
        )}

        {/* Offer (Variant B only) */}
        {step === "offer" && (
          <>
            <div className="flex items-center gap-6 text-sm text-gray-600 mb-6">
              <span>1. Reason</span>
              <span className="font-semibold text-black">2. Offer</span>
              <span>3. Confirm</span>
              <span>4. Done</span>
            </div>

            <h2 className="text-2xl font-bold mb-3">Wait! Keep Migrate Mate for $10 off</h2>
            <p className="text-gray-600 mb-6">
              We’d love you to stay. Take $10 off your current monthly price.
            </p>

            {currentPrice != null && (
              <div className="mb-6">
                <span className="text-gray-500 line-through mr-3">
                  ${currentPrice}
                </span>
                <span className="text-xl font-semibold">
                  ${Math.max(0, currentPrice - 10)}
                </span>
                <span className="ml-2 text-gray-500">/ month</span>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onDeclineOffer}
                className="flex-1 h-12 rounded-lg border border-gray-300"
                disabled={loading}
              >
                No thanks
              </button>
              <button
                onClick={onAcceptOffer}
                className="flex-1 h-12 rounded-lg bg-blue-600 text-white"
                disabled={loading}
              >
                {loading ? "Applying..." : "Accept offer"}
              </button>
            </div>
          </>
        )}

        {/* Confirm */}
        {step === "confirm" && (
          <>
            <div className="flex items-center gap-6 text-sm text-gray-600 mb-6">
              <span>1. Reason</span>
              <span>2. Offer</span>
              <span className="font-semibold text-black">3. Confirm</span>
              <span>4. Done</span>
            </div>

            <h2 className="text-2xl font-bold mb-3">Confirm cancellation</h2>
            <p className="text-gray-600 mb-6">
              Your access stays until the end of the billing period.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("reason")}
                className="flex-1 h-12 rounded-lg border border-gray-300"
              >
                Go back
              </button>
              <button
                onClick={onConfirmCancel}
                className="flex-1 h-12 rounded-lg bg-red-600 text-white"
              >
                Confirm cancel
              </button>
            </div>
          </>
        )}

        {/* Done */}
        {step === "done" && (
          <>
            <div className="flex items-center gap-6 text-sm text-gray-600 mb-6">
              <span>1. Reason</span>
              <span>2. Offer</span>
              <span>3. Confirm</span>
              <span className="font-semibold text-black">4. Done</span>
            </div>

            <h2 className="text-2xl font-bold mb-3">Cancellation scheduled</h2>
            <p className="text-gray-600 mb-6">
              You’ll keep access until the end of your billing period.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full h-12 rounded-lg border"
            >
              Back to profile
            </button>
          </>
        )}

        {/* Kept (accepted offer) */}
        {step === "kept" && (
          <>
            <h2 className="text-2xl font-bold mb-3">Thanks for staying!</h2>
            <p className="text-gray-600 mb-6">
              We’ve applied the discounted price{currentPrice != null ? ` of $${Math.max(0, currentPrice - 10)}/mo` : ""}. 🎉
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full h-12 rounded-lg border"
            >
              Back to profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}
