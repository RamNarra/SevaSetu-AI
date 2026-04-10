import { NextRequest, NextResponse } from 'next/server';
import { genai, MODEL, parseJsonResponse } from '@/lib/ai/client';

const EXTRACTION_PROMPT = `You are an AI assistant for SevaSetu AI, an NGO resource allocation platform for community health camps in India.

Given the following field report text, extract structured information.

Return ONLY a valid JSON object with these exact fields:
{
  "locality": "string - identified village/area/block name",
  "issueTypes": ["array of health issues identified, e.g. 'waterborne disease', 'malnutrition', 'TB', 'anemia'"],
  "urgencySignals": ["array of urgency indicators, e.g. 'children hospitalized', 'death reported', 'outbreak spreading'"],
  "estimatedAffected": number (estimated people affected, integer),
  "supportNeeded": ["array of support types needed, e.g. 'dermatologist', 'pediatrician', 'water testing', 'TB screening'"],
  "confidence": number (0.0 to 1.0, your confidence in the extraction),
  "entities": {
    "people": ["names or roles mentioned"],
    "locations": ["specific locations mentioned"],
    "organizations": ["organizations mentioned"],
    "timeframes": ["dates or time periods mentioned"]
  }
}

Field Report Text:
`;

export async function POST(request: NextRequest) {
  try {
    const { reportId, text } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, error: 'No text provided' }, { status: 400 });
    }

    const response = await genai.models.generateContent({
      model: MODEL,
      contents: EXTRACTION_PROMPT + text,
      config: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    const responseText = response.text || '';

    // Parse JSON from response
    let result;
    try {
      result = parseJsonResponse(responseText);
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Failed to parse AI response as JSON',
        raw: responseText,
      });
    }

    return NextResponse.json({ success: true, result, reportId });
  } catch (error) {
    console.error('AI extraction error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
