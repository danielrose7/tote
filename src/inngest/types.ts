export type CurationMode = 'normal' | 'debug';

export interface InterviewQuestion {
  id: string;
  text: string;
  options: { value: string; description: string }[];
  multi: boolean;
}

export interface CurationStartEvent {
  name: 'curation/start';
  data: {
    sessionId: string;
    topic: string;
    requestedBy: string;
  };
}

export interface CurationAnswersEvent {
  name: 'curation/answers';
  data: {
    sessionId: string;
    /** Echoed back so the planner knows the question text alongside each answer */
    questions: InterviewQuestion[];
    /** Keyed by question id, value is the selected option(s) + any notes */
    answers: Record<string, string>;
    mode: CurationMode;
  };
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

export interface CollectionOutput {
  title: string;
  intro: string;
  sections: CollectionSection[];
  warnings: string[];
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
  name: 'curation/extractions';
  data: {
    sessionId: string;
    sections: ExtractedSection[];
  };
}
