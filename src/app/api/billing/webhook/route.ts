import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { addCredits } from "../../../../lib/credits";
import { stripe } from "../../../../lib/stripe";

// Credits (in cents) granted per price ID
const PRICE_CREDITS: Record<string, number> = {
	price_1TKn8dIRyPXUFa52ClYqRPKI: 500, // $5
	price_1TKn8fIRyPXUFa52XCsjtETI: 1000, // $10
	price_1TKn8gIRyPXUFa52q6XX47mt: 2500, // $25
};

// Stripe requires the raw body for signature verification — do not parse JSON.
export async function POST(request: Request) {
	const body = await request.text();
	const sig = request.headers.get("stripe-signature");

	if (!sig) {
		return NextResponse.json(
			{ error: "Missing stripe-signature" },
			{ status: 400 },
		);
	}

	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(
			body,
			sig,
			process.env.STRIPE_WEBHOOK_SECRET!,
		);
	} catch {
		return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
	}

	if (event.type === "checkout.session.completed") {
		const session = event.data.object as Stripe.Checkout.Session;
		const clerkUserId = session.metadata?.clerkUserId;

		if (!clerkUserId) {
			console.error(
				"[billing/webhook] checkout.session.completed missing clerkUserId",
				{
					sessionId: session.id,
				},
			);
			return NextResponse.json(
				{ error: "Missing clerkUserId" },
				{ status: 400 },
			);
		}

		const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
		const priceId = lineItems.data[0]?.price?.id;
		const credits = priceId ? (PRICE_CREDITS[priceId] ?? 0) : 0;

		if (credits > 0) {
			const newBalance = await addCredits(clerkUserId, credits, session.id);
			console.log("[billing/webhook] credits-added", {
				clerkUserId,
				priceId,
				credits,
				newBalance,
			});
		}
	}

	return NextResponse.json({ received: true });
}
