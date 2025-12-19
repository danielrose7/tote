import { NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const TEST_CASES_FILE = path.join(
  process.cwd(),
  "tests",
  "metadata-test-cases.json"
);

// GET - Load test cases from file
export async function GET() {
  try {
    if (!existsSync(TEST_CASES_FILE)) {
      // Return empty structure if file doesn't exist
      return NextResponse.json({
        version: "1.0.0",
        lastUpdated: new Date().toISOString(),
        testCases: [],
        categories: {},
        failureModes: {},
      });
    }

    const data = await readFile(TEST_CASES_FILE, "utf-8");
    const json = JSON.parse(data);

    return NextResponse.json(json);
  } catch (error) {
    console.error("Error reading test cases:", error);
    return NextResponse.json(
      { error: "Failed to read test cases" },
      { status: 500 }
    );
  }
}

// POST - Save test cases to file
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Read existing file to preserve categories/failureModes structure
    let existing = {
      version: "1.0.0",
      testCases: [],
      categories: {},
      failureModes: {},
    };

    if (existsSync(TEST_CASES_FILE)) {
      const data = await readFile(TEST_CASES_FILE, "utf-8");
      existing = JSON.parse(data);
    }

    // Update with new test cases
    const updated = {
      ...existing,
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      testCases: body.testCases || [],
    };

    await writeFile(TEST_CASES_FILE, JSON.stringify(updated, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving test cases:", error);
    return NextResponse.json(
      { error: "Failed to save test cases" },
      { status: 500 }
    );
  }
}
