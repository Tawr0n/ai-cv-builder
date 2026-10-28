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
  "text": "The person's name is Markus Weber."
 },
 {
  "id": "f2",
  "text": "Title: Data Analyst."
 },
 {
  "id": "f3",
  "text": "Email: markus.weber@example.de"
 },
 {
  "id": "f4",
  "text": "Location: Berlin"
 },
 {
  "id": "f5",
  "text": "Is an analyst with a background in economics."
 },
 {
  "id": "f6",
  "text": "Is comfortable with SQL and Python."
 },
 {
  "id": "f7",
  "text": "Is comfortable presenting to stakeholders."
 },
 {
  "id": "f8",
  "text": "Works at Zalando SE, Berlin as a Junior Data Analyst from 09/2022 to present."
 },
 {
  "id": "f9",
  "text": "At Zalando SE, builds weekly dashboards in Looker for the returns team."
 },
 {
  "id": "f10",
  "text": "At Zalando SE, does ad-hoc SQL analyses (BigQuery) for category managers."
 },
 {
  "id": "f11",
  "text": "At Zalando SE, helped with an A/B test analysis for the checkout page."
 },
 {
  "id": "f12",
  "text": "Worked at Deutsche Bahn, Frankfurt as a Working student, Controlling from 2020 to 2022."
 },
 {
  "id": "f13",
  "text": "At Deutsche Bahn, produced Excel reports."
 },
 {
  "id": "f14",
  "text": "At Deutsche Bahn, did data cleaning in Python (pandas)."
 },
 {
  "id": "f15",
  "text": "Holds an M.Sc. Economics from Goethe University Frankfurt, 2022."
 },
 {
  "id": "f16",
  "text": "Holds a B.Sc. Economics from Goethe University Frankfurt, 2020."
 },
 {
  "id": "f17",
  "text": "Skill: SQL"
 },
 {
  "id": "f18",
  "text": "Skill: BigQuery"
 },
 {
  "id": "f19",
  "text": "Skill: Python (pandas)"
 },
 {
  "id": "f20",
  "text": "Skill: Looker"
 },
 {
  "id": "f21",
  "text": "Skill: Excel"
 },
 {
  "id": "f22",
  "text": "German is native."
 },
 {
  "id": "f23",
  "text": "English level C1."
 }
]
</facts>

Target role: Product Analyst

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/2-pdf.sonnet.compose.out.json.

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
