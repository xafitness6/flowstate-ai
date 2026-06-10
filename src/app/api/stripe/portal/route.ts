import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { sameOriginUrl, appendQuery } from "@/lib/server/security";

export async function POST(req: NextRequest) {
  try {
    const { returnUrl } = await req.json() as {
      returnUrl: string;
    };
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();
    const customerId = (profile as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;
    if (!customerId) {
      return NextResponse.json({ error: "No billing customer found." }, { status: 404 });
    }

    const safeReturnUrl = sameOriginUrl(req, returnUrl, "/settings/billing");

    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === "sk_test_placeholder") {
      return NextResponse.json({ url: appendQuery(safeReturnUrl, { portal: "demo" }) });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: safeReturnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Stripe portal error:", err);
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
