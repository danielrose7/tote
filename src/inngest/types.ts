export type CurationMode = 'normal' | 'debug';

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
    answers: {
      audience: string;
      lens: string;
      constraints: string;
      mode: CurationMode;
    };
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
