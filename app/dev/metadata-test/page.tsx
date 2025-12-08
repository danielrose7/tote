"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchMetadata } from "../../../src/utils/metadata";
import styles from "./MetadataTestPage.module.css";

interface TestCase {
  id: string;
  url: string;
  siteName: string;
  category: string;
  platformDetail?: string;
  status: "pending" | "tested" | "passed" | "failed";
  microlinkResult?: {
    title?: string;
    description?: string;
    imageUrl?: string;
    price?: string;
    error?: string;
  };
  expectedResult?: {
    title: string;
    description: string;
    imageUrl: string;
    price?: string;
    currency?: string;
    brand?: string;
  };
  issues?: string[];
  severity?: "critical" | "major" | "minor" | "unknown";
  notes?: string;
  testedAt?: string;
}

const STORAGE_KEY = "tote-metadata-test-cases";

export default function MetadataTestPage() {
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [currentUrl, setCurrentUrl] = useState("");
  const [siteName, setSiteName] = useState("");
  const [category, setCategory] = useState("shopify-indie");
  const [platformDetail, setPlatformDetail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestCase | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Load test cases from file on mount
  useEffect(() => {
    loadFromFile();
  }, []);

  // Auto-save to localStorage for backup
  useEffect(() => {
    if (testCases.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(testCases));
    }
  }, [testCases]);

  const loadFromFile = async () => {
    try {
      const response = await fetch("/api/dev/test-cases");
      const data = await response.json();
      if (data.testCases && Array.isArray(data.testCases)) {
        setTestCases(data.testCases);
      }
    } catch (error) {
      console.error("Failed to load from file, trying localStorage:", error);
      // Fallback to localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          setTestCases(JSON.parse(stored));
        } catch (e) {
          console.error("Failed to load test cases:", e);
        }
      }
    }
  };

  const saveToFile = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/dev/test-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testCases }),
      });

      if (!response.ok) {
        throw new Error("Failed to save");
      }

      setLastSaved(new Date());
      alert("✅ Test cases saved to tests/metadata-test-cases.json");
    } catch (error) {
      console.error("Error saving to file:", error);
      alert("❌ Failed to save test cases to file");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestUrl = async () => {
    if (!currentUrl || !siteName) {
      alert("Please enter both URL and site name");
      return;
    }

    setIsLoading(true);

    try {
      const metadata = await fetchMetadata(currentUrl);

      const newTestCase: TestCase = {
        id: `test-${Date.now()}`,
        url: currentUrl,
        siteName,
        category,
        platformDetail: platformDetail || undefined,
        status: "tested",
        microlinkResult: {
          title: metadata.title,
          description: metadata.description,
          imageUrl: metadata.imageUrl,
          price: metadata.price,
        },
        expectedResult: {
          title: metadata.title || "",
          description: metadata.description || "",
          imageUrl: metadata.imageUrl || "",
        },
        testedAt: new Date().toISOString(),
      };

      setTestCases((prev) => [newTestCase, ...prev]);
      setSelectedTest(newTestCase);

      // Clear form
      setCurrentUrl("");
      setSiteName("");
      setPlatformDetail("");
    } catch (error) {
      const errorTestCase: TestCase = {
        id: `test-${Date.now()}`,
        url: currentUrl,
        siteName,
        category,
        platformDetail: platformDetail || undefined,
        status: "failed",
        microlinkResult: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        testedAt: new Date().toISOString(),
      };

      setTestCases((prev) => [errorTestCase, ...prev]);
      setSelectedTest(errorTestCase);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetest = async (testCase: TestCase) => {
    setIsLoading(true);

    try {
      const metadata = await fetchMetadata(testCase.url);

      const updated: TestCase = {
        ...testCase,
        status: "tested",
        microlinkResult: {
          title: metadata.title,
          description: metadata.description,
          imageUrl: metadata.imageUrl,
          price: metadata.price,
        },
        testedAt: new Date().toISOString(),
      };

      setTestCases((prev) =>
        prev.map((tc) => (tc.id === testCase.id ? updated : tc))
      );
      setSelectedTest(updated);
    } catch (error) {
      const updated: TestCase = {
        ...testCase,
        status: "failed",
        microlinkResult: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
        testedAt: new Date().toISOString(),
      };

      setTestCases((prev) =>
        prev.map((tc) => (tc.id === testCase.id ? updated : tc))
      );
      setSelectedTest(updated);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateExpected = (testCase: TestCase, field: string, value: string) => {
    const updated: TestCase = {
      ...testCase,
      expectedResult: {
        ...testCase.expectedResult!,
        [field]: value,
      },
    };

    setTestCases((prev) =>
      prev.map((tc) => (tc.id === testCase.id ? updated : tc))
    );
    setSelectedTest(updated);
  };

  const handleUpdateMetadata = (testCase: TestCase, updates: Partial<TestCase>) => {
    const updated: TestCase = {
      ...testCase,
      ...updates,
    };

    setTestCases((prev) =>
      prev.map((tc) => (tc.id === testCase.id ? updated : tc))
    );
    setSelectedTest(updated);
  };

  const handleExport = () => {
    const data = {
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      testCases,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metadata-test-cases-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.testCases && Array.isArray(data.testCases)) {
          setTestCases(data.testCases);
          alert(`Imported ${data.testCases.length} test cases`);
        }
      } catch (error) {
        alert("Failed to import: Invalid JSON");
      }
    };
    reader.readAsText(file);
  };

  const handleClear = () => {
    if (confirm("Clear all test cases? This cannot be undone.")) {
      setTestCases([]);
      setSelectedTest(null);
      localStorage.removeItem(STORAGE_KEY);
      setLastSaved(null);
    }
  };

  const handleLoadFromFile = async () => {
    if (
      testCases.length > 0 &&
      !confirm("This will replace your current test cases. Continue?")
    ) {
      return;
    }
    await loadFromFile();
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link href="/collections" className={styles.backLink}>
            ← Back to Collections
          </Link>
          <div>
            <h1>🧪 Metadata Test Lab</h1>
            {lastSaved && (
              <div className={styles.lastSaved}>
                Last saved: {lastSaved.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        <div className={styles.actions}>
          <button
            onClick={saveToFile}
            disabled={isSaving || testCases.length === 0}
            className={styles.buttonPrimary}
          >
            {isSaving ? "Saving..." : "💾 Save to File"}
          </button>
          <button onClick={handleLoadFromFile} className={styles.button}>
            📂 Load from File
          </button>
          <button onClick={handleExport} className={styles.button}>
            📥 Export JSON
          </button>
          <label className={styles.button}>
            📤 Import JSON
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: "none" }}
            />
          </label>
          <button onClick={handleClear} className={styles.buttonDanger}>
            🗑️ Clear All
          </button>
        </div>
      </header>

      <div className={styles.layout}>
        {/* Left Sidebar - Add New Test */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <h2>Add Test Case</h2>
            <div className={styles.form}>
              <div className={styles.formGroup}>
                <label>Product URL</label>
                <input
                  type="url"
                  value={currentUrl}
                  onChange={(e) => setCurrentUrl(e.target.value)}
                  placeholder="https://example.com/products/..."
                  disabled={isLoading}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Site Name</label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="e.g., Cool Shop"
                  disabled={isLoading}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isLoading}
                >
                  <optgroup label="🎯 Indie Sites">
                    <option value="shopify-indie">Shopify Indie</option>
                    <option value="squarespace-indie">Squarespace Indie</option>
                    <option value="indie-platforms">Other Indie</option>
                  </optgroup>
                  <optgroup label="Major Platforms">
                    <option value="e-commerce-major">Major E-Commerce</option>
                    <option value="fashion">Fashion/Apparel</option>
                    <option value="marketplace">Marketplace</option>
                  </optgroup>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Theme/Template (optional)</label>
                <input
                  type="text"
                  value={platformDetail}
                  onChange={(e) => setPlatformDetail(e.target.value)}
                  placeholder="e.g., Dawn, Bedford"
                  disabled={isLoading}
                />
              </div>

              <button
                onClick={handleTestUrl}
                disabled={isLoading || !currentUrl || !siteName}
                className={styles.buttonPrimary}
              >
                {isLoading ? "Testing..." : "Test URL"}
              </button>
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <h3>Test Cases ({testCases.length})</h3>
            <div className={styles.testList}>
              {testCases.map((tc) => (
                <div
                  key={tc.id}
                  className={`${styles.testItem} ${
                    selectedTest?.id === tc.id ? styles.testItemActive : ""
                  }`}
                  onClick={() => setSelectedTest(tc)}
                >
                  <div className={styles.testItemHeader}>
                    <span className={styles.testItemSite}>{tc.siteName}</span>
                    <span
                      className={`${styles.testItemStatus} ${
                        styles[`status-${tc.status}`]
                      }`}
                    >
                      {tc.status}
                    </span>
                  </div>
                  <div className={styles.testItemUrl}>{tc.url}</div>
                  {tc.testedAt && (
                    <div className={styles.testItemDate}>
                      {new Date(tc.testedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content - Test Details */}
        <main className={styles.main}>
          {selectedTest ? (
            <TestDetail
              testCase={selectedTest}
              onRetest={handleRetest}
              onUpdateExpected={handleUpdateExpected}
              onUpdateMetadata={handleUpdateMetadata}
              isLoading={isLoading}
            />
          ) : (
            <div className={styles.emptyState}>
              <p>Select a test case or add a new one to get started</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

interface TestDetailProps {
  testCase: TestCase;
  onRetest: (testCase: TestCase) => void;
  onUpdateExpected: (testCase: TestCase, field: string, value: string) => void;
  onUpdateMetadata: (testCase: TestCase, updates: Partial<TestCase>) => void;
  isLoading: boolean;
}

function TestDetail({
  testCase,
  onRetest,
  onUpdateExpected,
  onUpdateMetadata,
  isLoading,
}: TestDetailProps) {
  const [selectedIssues, setSelectedIssues] = useState<string[]>(
    testCase.issues || []
  );

  const commonIssues = [
    "No price",
    "No image",
    "Wrong image (logo instead of product)",
    "No description",
    "Wrong title (site name instead of product)",
    "Low-res image",
    "Truncated description",
    "CORS error",
    "Missing availability",
    "JS required",
  ];

  const toggleIssue = (issue: string) => {
    const updated = selectedIssues.includes(issue)
      ? selectedIssues.filter((i) => i !== issue)
      : [...selectedIssues, issue];

    setSelectedIssues(updated);
    onUpdateMetadata(testCase, { issues: updated });
  };

  return (
    <div className={styles.testDetail}>
      <div className={styles.testDetailHeader}>
        <div>
          <h2>{testCase.siteName}</h2>
          <a
            href={testCase.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.testUrl}
          >
            {testCase.url}
          </a>
        </div>
        <button
          onClick={() => onRetest(testCase)}
          disabled={isLoading}
          className={styles.button}
        >
          🔄 Re-test
        </button>
      </div>

      <div className={styles.comparisonGrid}>
        {/* Microlink Results */}
        <div className={styles.comparisonCard}>
          <h3>Microlink Results</h3>
          {testCase.microlinkResult?.error ? (
            <div className={styles.error}>
              Error: {testCase.microlinkResult.error}
            </div>
          ) : (
            <div className={styles.metadataFields}>
              <MetadataField
                label="Title"
                value={testCase.microlinkResult?.title}
              />
              <MetadataField
                label="Description"
                value={testCase.microlinkResult?.description}
              />
              <MetadataField
                label="Image"
                value={testCase.microlinkResult?.imageUrl}
                isImage
              />
              <MetadataField
                label="Price"
                value={testCase.microlinkResult?.price || "Not extracted"}
                isEmpty={!testCase.microlinkResult?.price}
              />
            </div>
          )}
        </div>

        {/* Expected Results */}
        <div className={styles.comparisonCard}>
          <h3>Expected Results</h3>
          <div className={styles.metadataFields}>
            <EditableField
              label="Title"
              value={testCase.expectedResult?.title || ""}
              onChange={(val) => onUpdateExpected(testCase, "title", val)}
            />
            <EditableField
              label="Description"
              value={testCase.expectedResult?.description || ""}
              onChange={(val) => onUpdateExpected(testCase, "description", val)}
              multiline
            />
            <EditableField
              label="Image URL"
              value={testCase.expectedResult?.imageUrl || ""}
              onChange={(val) => onUpdateExpected(testCase, "imageUrl", val)}
            />
            {testCase.expectedResult?.imageUrl && (
              <div className={styles.imagePreview}>
                <img
                  src={testCase.expectedResult.imageUrl}
                  alt="Expected"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            )}
            <EditableField
              label="Price"
              value={testCase.expectedResult?.price || ""}
              onChange={(val) => onUpdateExpected(testCase, "price", val)}
              placeholder="$29.99"
            />
            <EditableField
              label="Currency"
              value={testCase.expectedResult?.currency || "USD"}
              onChange={(val) => onUpdateExpected(testCase, "currency", val)}
            />
            <EditableField
              label="Brand"
              value={testCase.expectedResult?.brand || ""}
              onChange={(val) => onUpdateExpected(testCase, "brand", val)}
            />
          </div>
        </div>
      </div>

      {/* Issues */}
      <div className={styles.section}>
        <h3>Issues Found</h3>
        <div className={styles.issuesTags}>
          {commonIssues.map((issue) => (
            <button
              key={issue}
              onClick={() => toggleIssue(issue)}
              className={`${styles.issueTag} ${
                selectedIssues.includes(issue) ? styles.issueTagSelected : ""
              }`}
            >
              {issue}
            </button>
          ))}
        </div>
      </div>

      {/* Severity & Notes */}
      <div className={styles.metadataGrid}>
        <div className={styles.formGroup}>
          <label>Severity</label>
          <select
            value={testCase.severity || "unknown"}
            onChange={(e) =>
              onUpdateMetadata(testCase, {
                severity: e.target.value as TestCase["severity"],
              })
            }
          >
            <option value="unknown">Unknown</option>
            <option value="minor">Minor</option>
            <option value="major">Major</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label>Notes</label>
        <textarea
          value={testCase.notes || ""}
          onChange={(e) =>
            onUpdateMetadata(testCase, { notes: e.target.value })
          }
          placeholder="Additional observations..."
          rows={3}
        />
      </div>
    </div>
  );
}

function MetadataField({
  label,
  value,
  isImage = false,
  isEmpty = false,
}: {
  label: string;
  value?: string;
  isImage?: boolean;
  isEmpty?: boolean;
}) {
  return (
    <div className={styles.metadataField}>
      <label>{label}</label>
      {isImage && value ? (
        <div className={styles.imagePreview}>
          <img
            src={value}
            alt={label}
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      ) : (
        <div className={`${styles.value} ${isEmpty ? styles.valueEmpty : ""}`}>
          {value || "Not found"}
        </div>
      )}
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div className={styles.formGroup}>
      <label>{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
