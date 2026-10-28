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
  "text": "Has about 4 years of frontend work across several startups, mainly with React and some Vue. Most recently at an edtech company, building an admin panel and working on payments.",
  "sourceFactIds": [
   "f3",
   "f4",
   "f5",
   "f6",
   "f7",
   "f8",
   "f9"
  ]
 },
 "experience": [
  {
   "organization": "Edtech company (name not provided)",
   "title": "",
   "startDate": null,
   "endDate": null,
   "isCurrent": false,
   "location": null,
   "sourceFactIds": [
    "f7",
    "f8",
    "f9"
   ],
   "bullets": [
    {
     "text": "Built an admin panel",
     "sourceFactIds": [
      "f8"
     ]
    },
    {
     "text": "Worked on payments-related work",
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
   "degree": "Studies not completed",
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

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/3-sparse-uk.haiku-staged.judge.out.json.

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
