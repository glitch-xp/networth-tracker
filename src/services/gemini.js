import { GoogleGenAI } from '@google/genai';

// You will need to securely provide the API key, typically via environment variables or settings
// For the sake of this offline-first local app, it should be configurable in the UI
// Here we assume it's passed directly to the function

export const generateInsights = async (apiKey, model, portfolioSummary) => {
  if (!apiKey) return "API key is required for AI Insights.";

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      Act as an objective financial AI assistant.
      Here is the user's portfolio summary:
      \${JSON.stringify(portfolioSummary, null, 2)}

      Rules:
      1. No buy/sell recommendations; do not act as an advisor.
      2. Identify well-performing assets and allocation dominances.
      3. Provide a simple mathematical prediction of future value (1, 3, 5 years) at a conservative 6-8% growth rate.
      4. Keep it to 2-3 short paragraphs.
    `;

    const response = await ai.models.generateContent({
      model: model || 'gemini-3.7-flash',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error('Error generating insights:', error);
    return 'Unable to generate insights at this time.';
  }
};

export const generateExecutiveSummaryWithNews = async (apiKey, model, portfolioData) => {
  if (!apiKey) return "API key is required for AI Insights.";

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      You are an expert financial AI assistant analyzing a user's net worth dashboard.
      Here is the user's complete portfolio data. It includes their total invested amounts, current values, individual assets, and active SIPs.
      It also includes the exactly calculated mathematical portfolio CAGR based on Yahoo Finance historical data for reference.
      \${JSON.stringify(portfolioData, null, 2)}

      Task: Executive Summary with Grounded Market Insights
      1. Provide a brief executive summary (max 4-5 short sentences).
      2. Use your Google Search tool to find current real-world news and market trends specifically affecting the user's asset holdings.
      3. Synthesize this news to provide actionable insights for both the short term and long term.
      4. Note: Do NOT generate a JSON object, do NOT guess the CAGR (the exact math CAGR is already provided). Just return a well-formatted professional markdown string for the user to read. No financial advice.
    `;

    const response = await ai.models.generateContent({
      model: model || 'gemini-1.5-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    return response.text || 'Unable to generate summary.';
  } catch (error) {
    console.error('Error generating executive summary:', error);
    return 'Unable to generate executive summary at this time. Please check your API key and internet connection.';
  }
};
