# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "First name is Andrii (Андрій)."
 },
 {
  "id": "f2",
  "text": "Email is andriy.dev@example.com."
 },
 {
  "id": "f3",
  "text": "Did frontend work for about 4 years."
 },
 {
  "id": "f4",
  "text": "Frontend work was done in several startups."
 },
 {
  "id": "f5",
  "text": "Mainly worked with React."
 },
 {
  "id": "f6",
  "text": "Some experience with Vue."
 },
 {
  "id": "f7",
  "text": "Last workplace was an edtech company (name not given)."
 },
 {
  "id": "f8",
  "text": "At the last workplace built an admin panel."
 },
 {
  "id": "f9",
  "text": "At the last workplace worked on something with payments."
 },
 {
  "id": "f10",
  "text": "Did freelance work before the last workplace."
 },
 {
  "id": "f11",
  "text": "Studied at KPI."
 },
 {
  "id": "f12",
  "text": "Did not finish studies at KPI."
 }
]
</facts>
<cv>
{
 "contact": {
  "fullName": "Andrii",
  "email": "andriy.dev@example.com",
  "phone": null,
  "location": null,
  "links": [],
  "sourceFactIds": [
   "f1",
   "f2"
  ]
 },
 "summary": {
  "text": "Frontend developer with about 4 years of experience across several startups, working mainly with React and with some Vue experience. Most recently built an admin panel at an edtech company.",
  "sourceFactIds": [
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
   "organization": "Edtech company",
   "title": "",
   "startDate": null,
   "endDate": null,
   "isCurrent": false,
   "location": null,
   "sourceFactIds": [
    "f7"
   ],
   "bullets": [
    {
     "text": "Built an admin panel.",
     "sourceFactIds": [
      "f8"
     ]
    },
    {
     "text": "Worked on payment-related functionality.",
     "sourceFactIds": [
      "f9"
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
    "f10"
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
    "f11",
    "f12"
   ]
  }
 ],
 "skills": [
  {
   "name": "React",
   "sourceFactIds": [
    "f5"
   ]
  },
  {
   "name": "Vue",
   "sourceFactIds": [
    "f6"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/3-sparse-uk.haiku-opus.judge.out.json.

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
