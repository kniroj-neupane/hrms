import { env } from "@/env";
import { Pinecone } from "@pinecone-database/pinecone";

export async function initPinecone() {
  if (!env.PINECONE_API_KEY || !env.PINECONE_INDEX) {
    throw new Error(
      "Pinecone is not configured. Set PINECONE_API_KEY and PINECONE_INDEX.",
    );
  }

  try {
    return new Pinecone({
      apiKey: env.PINECONE_API_KEY,
    });
  } catch (error) {
    console.error("Failed to initialize Pinecone:", error);
    throw new Error("Pinecone initialization failed");
  }
}

export const getPineconeIndexName = () => {
  if (!env.PINECONE_INDEX) {
    throw new Error("Pinecone is not configured. Set PINECONE_INDEX.");
  }
  return env.PINECONE_INDEX;
};
