export interface LinkMetadata {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  price?: string;
}

export interface MicrolinkResponse {
  status: string;
  data: {
    url: string;
    title?: string;
    description?: string;
    image?: {
      url: string;
    };
    logo?: {
      url: string;
    };
    author?: string;
    publisher?: string;
    lang?: string;
  };
}

export async function fetchMetadata(url: string): Promise<LinkMetadata> {
  try {
    // Use Microlink with additional parameters for better extraction
    const microlinkUrl = new URL("https://api.microlink.io/");
    microlinkUrl.searchParams.set("url", url);
    microlinkUrl.searchParams.set("meta", "true"); // Enable meta extraction
    microlinkUrl.searchParams.set("screenshot", "false"); // Disable screenshot for faster response
    microlinkUrl.searchParams.set("video", "false"); // Disable video for faster response

    const response = await fetch(microlinkUrl.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }

    const data: MicrolinkResponse = await response.json();

    if (data.status !== "success") {
      throw new Error("Failed to extract metadata from URL");
    }

    // Fall back to logo if no image is available
    const imageUrl = data.data.image?.url || data.data.logo?.url;

    // Generate a title from the URL if none is found
    const title = data.data.title || generateTitleFromUrl(url);

    return {
      url: data.data.url,
      title,
      description: data.data.description,
      imageUrl,
    };
  } catch (error) {
    console.error("Error fetching metadata:", error);

    // Return partial data with URL and generated title as fallback
    return {
      url,
      title: generateTitleFromUrl(url),
      description: undefined,
      imageUrl: undefined,
    };
  }
}

function generateTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Extract hostname and clean it up
    const hostname = urlObj.hostname.replace(/^www\./, "");
    // Capitalize first letter
    return hostname.charAt(0).toUpperCase() + hostname.slice(1);
  } catch {
    return "Untitled Link";
  }
}

export function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
