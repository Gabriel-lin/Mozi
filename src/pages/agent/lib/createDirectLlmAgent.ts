import { createOpenAI } from "@ai-sdk/openai";
import { tool, ToolLoopAgent, stepCountIs } from "ai";
import { z } from "zod";
import {
  fetchWeatherWidgetFromOpenMeteo,
  geocodeLocationWithOpenMeteo,
} from "@/lib/open-meteo-weather-adapter";

export function createDirectLlmAgent(opts: {
  baseURL: string;
  apiKey: string;
  model: string;
}) {
  const openai = createOpenAI({
    baseURL: opts.baseURL,
    apiKey: opts.apiKey,
  });

  const tools = {
    geocode_location: tool({
      description: "Geocode a location using Open-Meteo's geocoding API",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => geocodeLocationWithOpenMeteo(query),
    }),
    weather_search: tool({
      description:
        "Find the weather in a location given a longitude and latitude",
      inputSchema: z.object({
        query: z.string(),
        longitude: z.number(),
        latitude: z.number(),
      }),
      execute: async (args) => fetchWeatherWidgetFromOpenMeteo(args),
    }),
  };

  // `openai(model)` 走 OpenAI Responses API（/v1/responses）；DeepSeek 等兼容端只支持 Chat Completions，必须用 `.chat()`。
  return new ToolLoopAgent({
    model: openai.chat(opts.model),
    instructions:
      "You are a helpful assistant. For weather questions, call geocode_location first, then weather_search with the returned coordinates.",
    tools,
    stopWhen: stepCountIs(25),
  });
}
