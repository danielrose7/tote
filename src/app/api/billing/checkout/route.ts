import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { stripe } from "@/lib/stripe";

// Price IDs created in Stripe (test mode)
const VALID_PRICE_IDS = new Set([
	"price_1TKn8dIRyPXUFa52ClYqRPKI", // Starter — $5
	"price_1TKn8fIRyPXUFa52XCsjtETI", // Standard — $10
	"price_1TKn8gIRyPXUFa52q6XX47mt", // Pro — $25
]);

function safeReturnPath(value: unknown): string {
	if (typeof value !== "string") return "/settings";
	if (!value.startsWith("/") || value.startsWith("//")) return "/settings";
	return value;
}

export async function POST(request: Request) {
	const { userId } = await auth();
	if (!userId) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const { priceId, returnPath } = await request.json();
	if (!VALID_PRICE_IDS.has(priceId)) {
		return NextResponse.json({ error: "Invalid price" }, { status: 400 });
	}

	const user = await currentUser();
	const destination = safeReturnPath(returnPath);
	const successPath = `${destination}${destination.includes("?") ? "&" : "?"}credits=added&session_id={CHECKOUT_SESSION_ID}`;

	// Get or create a Stripe customer, stored in user_credits table
	const rows = await sql`
    SELECT stripe_customer_id FROM user_credits WHERE clerk_user_id = ${userId}
  `;
	let stripeCustomerId = rows[0]?.stripe_customer_id as string | undefined;

	if (!stripeCustomerId) {
		const customer = await stripe.customers.create({
			email: user?.emailAddresses[0]?.emailAddress,
			metadata: { clerkUserId: userId },
		});
		stripeCustomerId = customer.id;
		await sql`
      INSERT INTO user_credits (clerk_user_id, balance_cents, stripe_customer_id)
      VALUES (${userId}, 0, ${stripeCustomerId})
      ON CONFLICT (clerk_user_id) DO UPDATE
        SET stripe_customer_id = ${stripeCustomerId}
    `;
	}

	const origin =
		request.headers.get("origin") ??
		process.env.NEXT_PUBLIC_APP_URL ??
		"http://localhost:3000";

	const session = await stripe.checkout.sessions.create({
		customer: stripeCustomerId,
		client_reference_id: userId,
		mode: "payment",
		line_items: [{ price: priceId, quantity: 1 }],
		success_url: `${origin}${successPath}`,
		cancel_url: `${origin}${destination}`,
		metadata: { clerkUserId: userId, creditPriceId: priceId },
	});

	return NextResponse.json({ url: session.url });
}
