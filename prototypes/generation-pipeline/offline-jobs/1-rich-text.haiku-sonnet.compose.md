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
  "text": "Full name is Olena Kovalenko."
 },
 {
  "id": "f2",
  "text": "Email is olena.kovalenko@example.com."
 },
 {
  "id": "f3",
  "text": "Phone is +380 67 123 4567."
 },
 {
  "id": "f4",
  "text": "Location is Lviv, Ukraine."
 },
 {
  "id": "f5",
  "text": "GitHub is github.com/okoval."
 },
 {
  "id": "f6",
  "text": "Is a backend developer."
 },
 {
  "id": "f7",
  "text": "Has 6 years in the industry."
 },
 {
  "id": "f8",
  "text": "Likes boring reliable systems."
 },
 {
  "id": "f9",
  "text": "Role at SoftServe in Lviv, 2021 - now."
 },
 {
  "id": "f10",
  "text": "Was a backend engineer at SoftServe."
 },
 {
  "id": "f11",
  "text": "Was tech lead of a team of 5 at SoftServe from March 2023."
 },
 {
  "id": "f12",
  "text": "Built a payment reconciliation service in Node.js/TypeScript + PostgreSQL."
 },
 {
  "id": "f13",
  "text": "The payment reconciliation service was built for a US fintech client."
 },
 {
  "id": "f14",
  "text": "The payment reconciliation service processes about 2 million transactions a day."
 },
 {
  "id": "f15",
  "text": "Moved the team from a monolith deploy to Kubernetes (EKS)."
 },
 {
  "id": "f16",
  "text": "Deploy time went from ~40 min to 8 min."
 },
 {
  "id": "f17",
  "text": "Interviewed candidates."
 },
 {
  "id": "f18",
  "text": "Mentored 3 juniors."
 },
 {
  "id": "f19",
  "text": "Wrote internal guidelines for code review."
 },
 {
  "id": "f20",
  "text": "Worked at Lviv IT startup \"Fudzi\" (food delivery), 2018 - 2021."
 },
 {
  "id": "f21",
  "text": "Was a junior PHP developer at Fudzi."
 },
 {
  "id": "f22",
  "text": "Was a middle PHP developer at Fudzi."
 },
 {
  "id": "f23",
  "text": "Built the Laravel backend for the courier app."
 },
 {
  "id": "f24",
  "text": "Integrated Google Maps API for route estimates."
 },
 {
  "id": "f25",
  "text": "Was on call for production incidents once a week."
 },
 {
  "id": "f26",
  "text": "Worked as a barista at Lviv Coffee Manufacture, 2016 - 2018."
 },
 {
  "id": "f27",
  "text": "Worked part-time during university."
 },
 {
  "id": "f28",
  "text": "Trained new baristas."
 },
 {
  "id": "f29",
  "text": "Studied at Ivan Franko National University of Lviv."
 },
 {
  "id": "f30",
  "text": "Education is BSc Applied Mathematics."
 },
 {
  "id": "f31",
  "text": "Education dates are 2014-2018."
 },
 {
  "id": "f32",
  "text": "Skill: TypeScript."
 },
 {
  "id": "f33",
  "text": "Skill: Node.js."
 },
 {
  "id": "f34",
  "text": "Skill: NestJS."
 },
 {
  "id": "f35",
  "text": "Skill: PostgreSQL."
 },
 {
  "id": "f36",
  "text": "Skill: Redis."
 },
 {
  "id": "f37",
  "text": "Skill: Kafka."
 },
 {
  "id": "f38",
  "text": "Skill: Docker."
 },
 {
  "id": "f39",
  "text": "Skill: Kubernetes."
 },
 {
  "id": "f40",
  "text": "Skill: AWS."
 },
 {
  "id": "f41",
  "text": "Skill: PHP."
 },
 {
  "id": "f42",
  "text": "Skill: Laravel."
 },
 {
  "id": "f43",
  "text": "English language at B2 level."
 },
 {
  "id": "f44",
  "text": "Ukrainian language, native."
 },
 {
  "id": "f45",
  "text": "Polish language, basic."
 },
 {
  "id": "f46",
  "text": "Hobby: bouldering."
 },
 {
  "id": "f47",
  "text": "Hobby: board games."
 }
]
</facts>

Target role: Senior Backend Engineer

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/1-rich-text.haiku-sonnet.compose.out.json.

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
