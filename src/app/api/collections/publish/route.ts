import { NextResponse } from "next/server";

function legacyPublicationResponse() {
	return NextResponse.json(
		{
			error:
				"Legacy Jazz publication is no longer supported. Publish from the Neon collection page.",
		},
		{ status: 410 },
	);
}

export async function POST() {
	return legacyPublicationResponse();
}

export async function DELETE() {
	return legacyPublicationResponse();
}
