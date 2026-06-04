import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createRequire } from 'module';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const multer = require('multer');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/parse', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const fileBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;
    let parsedText = "";

    if (mimeType === 'application/pdf') {
      const parser = new pdf.PDFParse({ data: fileBuffer });
      const result = await parser.getText();
      parsedText = result.text;
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      parsedText = result.value;
    } else if (mimeType.startsWith('text/') || mimeType === 'application/octet-stream') {
      parsedText = fileBuffer.toString('utf-8');
    } else {
      return res.status(400).json({ error: "Unsupported file type. Please upload a PDF, DOCX, or TXT file." });
    }

    if (!parsedText.trim()) {
      return res.status(422).json({ error: "Successfully parsed document, but no text could be extracted." });
    }

    return res.json({ text: parsedText, filename: req.file.originalname });
  } catch (error) {
    console.error("Error parsing file:", error);
    return res.status(500).json({ error: "Failed to extract text from file.", details: error.message });
  }
});

// OpenAPI Schema for Gemini API responseSchema
const responseSchema = {
  type: "OBJECT",
  properties: {
    analysis: {
      type: "OBJECT",
      properties: {
        overall_compatibility_score: { type: "INTEGER" },
        score_breakdown: {
          type: "OBJECT",
          properties: {
            keyword_match_score: { type: "INTEGER" },
            impact_and_verbs_score: { type: "INTEGER" },
            formatting_score: { type: "INTEGER" }
          },
          required: ["keyword_match_score", "impact_and_verbs_score", "formatting_score"]
        },
        formatting_feedback: {
          type: "ARRAY",
          items: { type: "STRING" }
        },
        keywords: {
          type: "OBJECT",
          properties: {
            matched_keywords: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            missing_high_priority_keywords: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            missing_low_priority_keywords: {
              type: "ARRAY",
              items: { type: "STRING" }
            }
          },
          required: ["matched_keywords", "missing_high_priority_keywords", "missing_low_priority_keywords"]
        },
        critical_gaps: {
          type: "ARRAY",
          items: { type: "STRING" }
        }
      },
      required: ["overall_compatibility_score", "score_breakdown", "formatting_feedback", "keywords", "critical_gaps"]
    },
    tailored_resume: {
      type: "OBJECT",
      properties: {
        personal_info: {
          type: "OBJECT",
          properties: {
            name: { type: "STRING" },
            email: { type: "STRING" },
            phone: { type: "STRING" },
            linkedin: { type: "STRING" },
            location: { type: "STRING" }
          },
          required: ["name", "email", "phone", "linkedin", "location"]
        },
        professional_summary: { type: "STRING" },
        skills: {
          type: "ARRAY",
          items: { type: "STRING" }
        },
        work_experience: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              company: { type: "STRING" },
              role: { type: "STRING" },
              location: { type: "STRING" },
              duration: { type: "STRING" },
              bullet_points: {
                type: "ARRAY",
                items: { type: "STRING" }
              }
            },
            required: ["company", "role", "location", "duration", "bullet_points"]
          }
        },
        education: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              institution: { type: "STRING" },
              degree: { type: "STRING" },
              graduation_year: { type: "STRING" }
            },
            required: ["institution", "degree", "graduation_year"]
          }
        },
        certifications: {
          type: "ARRAY",
          items: { type: "STRING" }
        }
      },
      required: ["personal_info", "professional_summary", "skills", "work_experience", "education", "certifications"]
    }
  },
  required: ["analysis", "tailored_resume"]
};

// System Instruction to enforce constraints
const systemInstruction = `You are an advanced Applicant Tracking System (ATS) optimization engine and an elite professional resume writer.
Your function is to analyze a candidate's raw resume against a target job description (JD), generate structured analytical metrics, identify content and formatting gaps, and output an optimized, tailored version of the resume that maximizes both ATS compatibility and appeal to human hiring managers.

### 1. OPERATIONAL RULES & CONSTRAINTS:
- **STRICTLY NO HALLUCINATIONS:** Under no circumstances should you invent fake employers, job titles, employment dates, academic degrees, or certifications. You may only optimize, rephrase, and reformat the candidate's actual history provided in the RAW_RESUME.
- **THE X-Y-Z & STAR FORMULAS:** Every bullet point in the tailored work experience must start with a strong action verb and follow either the Google X-Y-Z formula ("Accomplished [X], as measured by [Y], by doing [Z]") or the STAR method (Situation, Task, Action, Result). Prioritize quantifying impact using percentages, revenue, time saved, or team sizes based on the context of the raw text.
- **NATURAL KEYWORD INTEGRATION:** Intelligently weave missing high-priority hard and soft skills extracted from the JOB_DESCRIPTION into the professional summary, skills list, and experience bullet points. Avoid keyword-stuffing. The text must remain engaging and natural for a human recruiter to read.
- **ATS-FRIENDLY STRUCTURE:** Ensure the output data structure is optimized for single-column rendering. Avoid advising or structured text that implies multi-columns, complex tables, progress bars, charts, or graphical elements, as these cause parsing failures in modern ATS pipelines.
- **OUTPUT FORMAT:** Your entire response must be a single, valid JSON object matching the JSON schema precisely. Do not wrap the JSON in markdown code blocks.`;

app.post('/api/analyze', async (req, res) => {
  try {
    const { rawResume, jobDescription, userInstructions } = req.body;
    
    // Get Gemini API Key (check header first, then backend environment)
    const clientApiKey = req.headers['x-gemini-api-key'];
    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ 
        error: "Gemini API key is required. Please set GEMINI_API_KEY in the environment or provide it in the API Key input." 
      });
    }

    if (!rawResume || !jobDescription) {
      return res.status(400).json({ error: "Missing required fields: rawResume and jobDescription are required." });
    }

    const promptText = `
RAW_RESUME:
${rawResume}

JOB_DESCRIPTION:
${jobDescription}

USER_INSTRUCTIONS:
${userInstructions || "Optimize for compatibility, integration of skills, and strong action verbs using Google XYZ/STAR formats."}
`;

    // Fetch response from Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }]
        }
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2
      }
    };

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch (e) {
        errorData = { error: { message: errorText } };
      }
      return res.status(response.status).json({
        error: errorData.error?.message || `Gemini API responded with status ${response.status}`,
        details: errorData
      });
    }

    const data = await response.json();
    
    // Extract the text content containing our JSON
    const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textContent) {
      throw new Error("Empty response received from Gemini API.");
    }

    // Parse the output string as JSON to verify and return
    const parsedResult = JSON.parse(textContent.trim());
    return res.json(parsedResult);

  } catch (error) {
    console.error("Error analyzing resume:", error);
    return res.status(500).json({ 
      error: "Failed to parse or fetch resume analysis.",
      details: error.message 
    });
  }
});

// Serve static assets
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
