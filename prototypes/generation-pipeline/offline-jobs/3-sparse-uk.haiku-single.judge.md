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
  "text": "Займався фронтенд-розробкою близько 4 років"
 },
 {
  "id": "f3",
  "text": "Працював у кількох стартапах"
 },
 {
  "id": "f4",
  "text": "Переважно використовував React"
 },
 {
  "id": "f5",
  "text": "Трохи використовував Vue"
 },
 {
  "id": "f6",
  "text": "Останнє місце роботи — якийсь edtech (назва не вказана)"
 },
 {
  "id": "f7",
  "text": "В edtech-компанії робив адмінку"
 },
 {
  "id": "f8",
  "text": "В edtech-компанії робив щось, пов'язане з платежами"
 },
 {
  "id": "f9",
  "text": "До цього був фрилансером"
 },
 {
  "id": "f10",
  "text": "Навчався в КПІ"
 },
 {
  "id": "f11",
  "text": "КПІ не закінчив"
 },
 {
  "id": "f12",
  "text": "Електронна пошта: andriy.dev@example.com"
 }
]
</facts>
<cv>
{
 "contact": {
  "fullName": "",
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
  "text": "Has around 4 years of frontend development experience at several startups, mainly with React and some Vue. Most recently worked at an edtech company on an admin panel and on something related to payments.",
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
   "organization": "Edtech company (name not given)",
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
     "text": "Worked on the admin panel.",
     "sourceFactIds": [
      "f7"
     ]
    },
    {
     "text": "Worked on something related to payments (details not given).",
     "sourceFactIds": [
      "f8"
     ]
    }
   ]
  },
  {
   "organization": "Several startups (names not given)",
   "title": "",
   "startDate": null,
   "endDate": null,
   "isCurrent": false,
   "location": null,
   "sourceFactIds": [
    "f3"
   ],
   "bullets": [
    {
     "text": "Did frontend development for around 4 years, mainly with React and some Vue.",
     "sourceFactIds": [
      "f2",
      "f4",
      "f5"
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
   "institution": "КПІ",
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

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/3-sparse-uk.haiku-single.judge.out.json.

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
