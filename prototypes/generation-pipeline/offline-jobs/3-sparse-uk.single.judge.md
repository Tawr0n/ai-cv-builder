# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "Name is Андрій"
 },
 {
  "id": "f2",
  "text": "Did frontend for about 4 years"
 },
 {
  "id": "f3",
  "text": "Worked in several startups"
 },
 {
  "id": "f4",
  "text": "Mainly used React"
 },
 {
  "id": "f5",
  "text": "Used a little Vue"
 },
 {
  "id": "f6",
  "text": "Last workplace was some edtech company"
 },
 {
  "id": "f7",
  "text": "Built an admin panel at the edtech company"
 },
 {
  "id": "f8",
  "text": "Did something related to payments at the edtech company"
 },
 {
  "id": "f9",
  "text": "Before the edtech company, worked as a freelancer"
 },
 {
  "id": "f10",
  "text": "Studied at KPI"
 },
 {
  "id": "f11",
  "text": "Did not finish studies at KPI"
 },
 {
  "id": "f12",
  "text": "Email is andriy.dev@example.com"
 }
]
</facts>
<cv>
{
 "contact": {
  "fullName": "Andriy",
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
  "text": "Frontend developer with about 4 years of experience in several startups, working mainly with React and a little Vue. Most recently built an admin panel and worked on payments-related features at an edtech company.",
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
     "text": "Built an admin panel for the product.",
     "sourceFactIds": [
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

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/3-sparse-uk.single.judge.out.json.

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
