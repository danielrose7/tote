export type CurationMode = "normal";
export type InterviewRound = 1 | 2;
export type CuratorPhase =
	| "started"
	| "interview-round-1"
	| "researching"
	| "interview-round-2"
	| "framing"
	| "planning"
	| "extracting"
	| "curating"
	| "hospitality"
	| "refining"
	| "complete"
	| "error";

export interface InterviewQuestion {
	id: string;
	text: string;
	options: { value: string; description: string }[];
	multi: boolean;
}

export interface CurationStartEvent {
	name: "curation/start";
	data: {
		sessionId: string;
		topic: string;
		requestedBy: string;
	};
}

export interface CurationAnswersEvent {
	name: "curation/answers";
	data: {
		sessionId: string;
		round: InterviewRound;
		/** Echoed back so the planner knows the question text alongside each answer */
		questions: InterviewQuestion[];
		/** Keyed by question id, value is the selected option(s) + any notes */
		answers: Record<string, string>;
		mode: CurationMode;
	};
}

export interface CategoryResearchBrief {
	categorySummary: string;
	tradeoffs: string[];
	pitfalls: string[];
	giftingConsiderations: string[];
	styleConsiderations: string[];
	suggestedLenses: string[];
	sectionHypotheses: Array<{
		title: string;
		rationale: string;
	}>;
	followUpNeeded: boolean;
	followUpQuestionGoals: string[];
}

export interface FramingBrief {
	recipientContext: string;
	goal: string;
	constraints: string[];
	tasteDirection: string;
	tradeoffs: string[];
	successDefinition: string;
	avoid: string[];
	planningNotes: string[];
}

export interface CollectionItem {
	title: string;
	sourceUrl: string;
	merchant: string;
	price: string;
	note: string;
}

export interface CollectionSection {
	title: string;
	items: CollectionItem[];
}

export interface SectionPlan {
	title: string;
	slug: string;
	targetCount: number;
	rationale: string;
}

export interface ExtractedItem {
	sourceUrl: string;
	title?: string;
	description?: string;
	price?: string;
	currency?: string;
	brand?: string;
	availability?: string;
	imageUrl?: string;
}

export interface ExtractedSection {
	slug: string;
	title: string;
	items: ExtractedItem[];
}

export interface UrlSection {
	title: string;
	slug: string;
	urls: string[];
}

export interface CurationExtractionsEvent {
	name: "curation/extractions";
	data: {
		sessionId: string;
		sections: ExtractedSection[];
	};
}

export interface CurationSectionExtractedEvent {
	name: "curation/section-extracted";
	data: {
		sessionId: string;
		slug: string;
		title: string;
		items: ExtractedItem[];
	};
}

export type CurationGapKind =
	| "missing-section"
	| "constraint-violation"
	| "coverage-gap"
	| "quality-concern";

export interface CurationGap {
	kind: CurationGapKind;
	sectionTitle: string;
	description: string;
	/** Concrete web search query to find products for this gap */
	searchHint: string;
	/** false = informational only, skip URL discovery */
	actionable: boolean;
}

export interface CollectionOutput {
	title: string;
	intro: string;
	sections: CollectionSection[];
	warnings: string[];
	gaps?: CurationGap[];
}
