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
  "text": "Ім'я — Андрій."
 },
 {
  "id": "f2",
  "text": "Електронна пошта: andriy.dev@example.com"
 },
 {
  "id": "f3",
  "text": "Десь 4 роки робив фронтенд."
 },
 {
  "id": "f4",
  "text": "Працював у кількох стартапах."
 },
 {
  "id": "f5",
  "text": "В основному працював з React."
 },
 {
  "id": "f6",
  "text": "Трохи працював з Vue (\"вью\")."
 },
 {
  "id": "f7",
  "text": "Останнє місце роботи — якийсь edtech."
 },
 {
  "id": "f8",
  "text": "В останньому місці робив адмінку."
 },
 {
  "id": "f9",
  "text": "В останньому місці робив щось з платежами."
 },
 {
  "id": "f10",
  "text": "До останнього місця був фриланс."
 },
 {
  "id": "f11",
  "text": "Вчився в КПІ, але не закінчив."
 }
]
</facts>

Target role: Middle Frontend Developer

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/3-sparse-uk.sonnet.compose.out.json.

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
