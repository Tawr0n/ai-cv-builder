# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "Ім'я — Андрій"
 },
 {
  "id": "f2",
  "text": "Десь 4 роки займався фронтендом"
 },
 {
  "id": "f3",
  "text": "Робив фронтенд у кількох стартапах"
 },
 {
  "id": "f4",
  "text": "Працював в основному з React"
 },
 {
  "id": "f5",
  "text": "Трохи працював з Vue"
 },
 {
  "id": "f6",
  "text": "Останнє місце роботи — якийсь edtech"
 },
 {
  "id": "f7",
  "text": "В edtech робив адмінку"
 },
 {
  "id": "f8",
  "text": "В edtech робив щось з платежами"
 },
 {
  "id": "f9",
  "text": "До останнього місця працював на фрилансі"
 },
 {
  "id": "f10",
  "text": "Навчався в КПІ"
 },
 {
  "id": "f11",
  "text": "Не закінчив навчання в КПІ"
 },
 {
  "id": "f12",
  "text": "Email: andriy.dev@example.com"
 }
]
</facts>
<cv>
{
 "contact": {
  "fullName": "Андрій",
  "email": "andriy.dev@example.com",
  "phone": null,
  "location": null,
  "links": [],
  "sourceFactIds": [
   "f1",
   "f12"
  ]
 },
 "summary": {
  "text": "Frontend developer with about 4 years of experience building frontends for several startups. Works mainly with React, with some Vue experience. Most recently built an admin panel and payments-related features at an edtech company.",
  "sourceFactIds": [
   "f2",
   "f3",
   "f4",
   "f5",
   "f6",
   "f7",
   "f8"
  ]
 },
 "experience": [
  {
   "organization": "EdTech company",
   "title": "",
   "startDate": null,
   "endDate": null,
   "isCurrent": false,
   "location": null,
   "sourceFactIds": [
    "f6"
   ],
   "bullets": [
    {
     "text": "Built the admin panel for an edtech product.",
     "sourceFactIds": [
      "f6",
      "f7"
     ]
    },
    {
     "text": "Worked on payments-related functionality.",
     "sourceFactIds": [
      "f8"
     ]
    }
   ]
  },
  {
   "organization": "Freelance",
   "title": "",
   "startDate": null,
   "endDate": null,
   "isCurrent": false,
   "location": null,
   "sourceFactIds": [
    "f9"
   ],
   "bullets": []
  }
 ],
 "education": [
  {
   "institution": "KPI",
   "degree": "",
   "field": null,
   "startDate": null,
   "endDate": null,
   "sourceFactIds": [
    "f10",
    "f11"
   ]
  }
 ],
 "skills": [
  {
   "name": "React",
   "sourceFactIds": [
    "f4"
   ]
  },
  {
   "name": "Vue",
   "sourceFactIds": [
    "f5"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/3-sparse-uk.staged.judge.out.json.

{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "type": "object",
 "properties": {
  "findings": {
   "type": "array",
   "items": {
    "type": "object",
    "properties": {
     "path": {
      "type": "string",
      "description": "e.g. experience[0].bullets[2], skills[3], summary"
     },
     "claim": {
      "type": "string",
      "description": "the specific unsupported part"
     },
     "severity": {
      "type": "string",
      "enum": [
       "invented",
       "exaggerated",
       "miscited"
      ],
      "description": "invented: no fact states it; exaggerated: fact states less; miscited: another fact supports it but not the cited ones"
     }
    },
    "required": [
     "path",
     "claim",
     "severity"
    ],
    "additionalProperties": false
   }
  }
 },
 "required": [
  "findings"
 ],
 "additionalProperties": false
}
