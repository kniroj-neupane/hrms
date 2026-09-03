import { env } from "@/env";
import { ChatGroq } from "@langchain/groq";
import { OpenAIEmbeddings } from "@langchain/openai";

// Constructed lazily: the client reads GROQ_API_KEY on construction, and
// `next build` imports this module while collecting page data, before any
// runtime secrets exist.
export const getGroqModel = () =>
  new ChatGroq({
    model: "llama-3.3-70b-versatile",
    temperature: 0,
  });

export const getOpenAIEmbeddings = () =>
  new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    openAIApiKey: env.OPENAI_API_KEY,
  });
