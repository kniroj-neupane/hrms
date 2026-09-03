import { env } from "@/env";
import { ChatGroq } from "@langchain/groq";
import { OpenAIEmbeddings } from "@langchain/openai";

// Constructed lazily: clients read API keys on construction, and
// `next build` imports this module while collecting page data, before any
// runtime secrets exist.
export const getGroqModel = () => {
  if (!env.GROQ_API_KEY) {
    throw new Error("AI is not configured. Set GROQ_API_KEY.");
  }
  return new ChatGroq({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
    apiKey: env.GROQ_API_KEY,
  });
};

export const getOpenAIEmbeddings = () => {
  if (!env.OPENAI_API_KEY) {
    throw new Error("AI embeddings are not configured. Set OPENAI_API_KEY.");
  }
  return new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    openAIApiKey: env.OPENAI_API_KEY,
  });
};
