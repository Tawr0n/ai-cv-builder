# SYSTEM

You turn a list of Facts about a person into a role-targeted CV draft. The Facts are all you know about them.

Write a CV draft aimed at the Target role.

Grounding (most important):
- Every item cites the Facts it rests on in sourceFactIds. Every claim in the text (number, name, technology, scope, seniority, outcome) must be stated by a cited Fact. Rephrasing and tightening is fine; adding is not.
- Never invent metrics, dates, employers, titles, degrees, technologies or outcomes. Do not upgrade scope ("helped with" stays "helped with", not "led").
- If something a good CV for this role needs is missing or vague (no dates, no title, no measurable outcome, vague employer), leave the field empty/null or the bullet modest, and add a Question asking the user for it. Prefer a Question over a guess.
- Only skills that a Fact names. Do not infer skills from tools ("used Kubernetes" does not give "DevOps").

Shape:
- Experience in reverse chronological order. Within an experience, bullets ordered by relevance to the Target role, at most 4, each one line (<= ~20 words), starting with a verb.
- Keep experiences that are irrelevant to the role but shorten them to 0-1 bullets; never drop education.
- Skills ordered by relevance to the Target role; spoken languages go into skills.
- Summary: 2-3 sentences, positioned for the Target role, only from Facts.
- Write the CV in English. Questions in the language of the Source.
- Questions: at most 6, the most valuable first, each about one thing, anchored to section/item/field.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "Full name is Markus Weber."
 },
 {
  "id": "f2",
  "text": "Title is Data Analyst."
 },
 {
  "id": "f3",
  "text": "Email is markus.weber@example.de."
 },
 {
  "id": "f4",
  "text": "Location is Berlin."
 },
 {
  "id": "f5",
  "text": "Is an analyst with a background in economics."
 },
 {
  "id": "f6",
  "text": "Is comfortable with SQL."
 },
 {
  "id": "f7",
  "text": "Is comfortable with Python."
 },
 {
  "id": "f8",
  "text": "Presents to stakeholders."
 },
 {
  "id": "f9",
  "text": "Role at Zalando SE in Berlin as Junior Data Analyst, 09/2022 - present."
 },
 {
  "id": "f10",
  "text": "Built weekly dashboards in Looker for the returns team."
 },
 {
  "id": "f11",
  "text": "Ran ad-hoc SQL analyses (BigQuery) for category managers."
 },
 {
  "id": "f12",
  "text": "Helped with an A/B test analysis for the checkout page."
 },
 {
  "id": "f13",
  "text": "Role at Deutsche Bahn in Frankfurt as Working student, Controlling, 2020 - 2022."
 },
 {
  "id": "f14",
  "text": "Wrote Excel reports at Deutsche Bahn."
 },
 {
  "id": "f15",
  "text": "Did data cleaning in Python (pandas) at Deutsche Bahn."
 },
 {
  "id": "f16",
  "text": "Education: Goethe University Frankfurt, M.Sc. Economics, 2022."
 },
 {
  "id": "f17",
  "text": "Education: Goethe University Frankfurt, B.Sc. Economics, 2020."
 },
 {
  "id": "f18",
  "text": "Skill: SQL."
 },
 {
  "id": "f19",
  "text": "Skill: BigQuery."
 },
 {
  "id": "f20",
  "text": "Skill: Python (pandas)."
 },
 {
  "id": "f21",
  "text": "Skill: Looker."
 },
 {
  "id": "f22",
  "text": "Skill: Excel."
 },
 {
  "id": "f23",
  "text": "German language, native."
 },
 {
  "id": "f24",
  "text": "English language at C1 level."
 }
]
</facts>

Target role: Product Analyst

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/2-pdf.haiku.compose.out.json.

{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "type": "object",
 "properties": {
  "contact": {
   "type": "object",
   "properties": {
    "fullName": {
     "type": "string",
     "description": "empty string if unknown"
    },
    "email": {
     "type": "string",
     "description": "empty string if unknown"
    },
    "phone": {
     "type": [
      "string",
      "null"
     ]
    },
    "location": {
     "type": [
      "string",
      "null"
     ]
    },
    "links": {
     "type": "array",
     "items": {
      "type": "string"
     }
    },
    "sourceFactIds": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "ids of the Facts this item rests on"
    }
   },
   "required": [
    "fullName",
    "email",
    "phone",
    "location",
    "links",
    "sourceFactIds"
   ],
   "additionalProperties": false
  },
  "summary": {
   "type": "object",
   "properties": {
    "text": {
     "type": "string"
    },
    "sourceFactIds": {
     "type": "array",
     "items": {
      "type": "string"
     },
     "description": "ids of the Facts this item rests on"
    }
   },
   "required": [
    "text",
    "sourceFactIds"
   ],
   "additionalProperties": false
  },
  "experience": {
   "type": "array",
   "items": {
    "type": "object",
    "properties": {
     "organization": {
      "type": "string"
     },
     "title": {
      "type": "string"
     },
     "startDate": {
      "description": "YYYY-MM, or YYYY if only the year is known, or null if unknown",
      "type": [
       "string",
       "null"
      ]
     },
     "endDate": {
      "description": "null if current OR unknown; say which in a Question if unknown",
      "type": [
       "string",
       "null"
      ]
     },
     "isCurrent": {
      "type": "boolean"
     },
     "location": {
      "type": [
       "string",
       "null"
      ]
     },
     "sourceFactIds": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "ids of the Facts this item rests on"
     },
     "bullets": {
      "type": "array",
      "items": {
       "type": "object",
       "properties": {
        "text": {
         "type": "string"
        },
        "sourceFactIds": {
         "type": "array",
         "items": {
          "type": "string"
         },
         "description": "ids of the Facts this item rests on"
        }
       },
       "required": [
        "text",
        "sourceFactIds"
       ],
       "additionalProperties": false
      }
     }
    },
    "required": [
     "organization",
     "title",
     "startDate",
     "endDate",
     "isCurrent",
     "location",
     "sourceFactIds",
     "bullets"
    ],
    "additionalProperties": false
   }
  },
  "education": {
   "type": "array",
   "items": {
    "type": "object",
    "properties": {
     "institution": {
      "type": "string"
     },
     "degree": {
      "type": "string",
      "description": "empty string if unknown"
     },
     "field": {
      "type": [
       "string",
       "null"
      ]
     },
     "startDate": {
      "description": "YYYY-MM, or YYYY if only the year is known, or null if unknown",
      "type": [
       "string",
       "null"
      ]
     },
     "endDate": {
      "description": "YYYY-MM, or YYYY if only the year is known, or null if unknown",
      "type": [
       "string",
       "null"
      ]
     },
     "sourceFactIds": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "ids of the Facts this item rests on"
     }
    },
    "required": [
     "institution",
     "degree",
     "field",
     "startDate",
     "endDate",
     "sourceFactIds"
    ],
    "additionalProperties": false
   }
  },
  "skills": {
   "type": "array",
   "items": {
    "type": "object",
    "properties": {
     "name": {
      "type": "string"
     },
     "sourceFactIds": {
      "type": "array",
      "items": {
       "type": "string"
      },
      "description": "ids of the Facts this item rests on"
     }
    },
    "required": [
     "name",
     "sourceFactIds"
    ],
    "additionalProperties": false
   }
  },
  "questions": {
   "type": "array",
   "items": {
    "type": "object",
    "properties": {
     "section": {
      "type": "string",
      "enum": [
       "contact",
       "summary",
       "experience",
       "education",
       "skills"
      ]
     },
     "itemIndex": {
      "anyOf": [
       {
        "type": "integer",
        "minimum": -9007199254740991,
        "maximum": 9007199254740991
       },
       {
        "type": "null"
       }
      ],
      "description": "index into that section's array, or null for the whole section"
     },
     "field": {
      "type": [
       "string",
       "null"
      ]
     },
     "text": {
      "type": "string",
      "description": "a short, specific question to the user"
     }
    },
    "required": [
     "section",
     "itemIndex",
     "field",
     "text"
    ],
    "additionalProperties": false
   }
  }
 },
 "required": [
  "contact",
  "summary",
  "experience",
  "education",
  "skills",
  "questions"
 ],
 "additionalProperties": false
}
