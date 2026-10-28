# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

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
<cv>
{
 "contact": {
  "fullName": "Markus Weber",
  "email": "markus.weber@example.de",
  "phone": null,
  "location": "Berlin",
  "links": [],
  "sourceFactIds": [
   "f1",
   "f3",
   "f4"
  ]
 },
 "summary": {
  "text": "Data analyst with an economics background (M.Sc.) and experience at Zalando SE, working with SQL, BigQuery, Python and Looker. Comfortable presenting to stakeholders and supporting category managers and the returns team with analyses and dashboards. Contributed to an A/B test analysis for the checkout page.",
  "sourceFactIds": [
   "f2",
   "f5",
   "f6",
   "f7",
   "f8",
   "f9",
   "f10",
   "f11",
   "f12",
   "f16"
  ]
 },
 "experience": [
  {
   "organization": "Zalando SE",
   "title": "Junior Data Analyst",
   "startDate": "2022-09",
   "endDate": null,
   "isCurrent": true,
   "location": "Berlin",
   "sourceFactIds": [
    "f9"
   ],
   "bullets": [
    {
     "text": "Helped with an A/B test analysis for the checkout page.",
     "sourceFactIds": [
      "f12"
     ]
    },
    {
     "text": "Ran ad-hoc SQL analyses in BigQuery for category managers.",
     "sourceFactIds": [
      "f11"
     ]
    },
    {
     "text": "Built weekly Looker dashboards for the returns team.",
     "sourceFactIds": [
      "f10"
     ]
    }
   ]
  },
  {
   "organization": "Deutsche Bahn",
   "title": "Working student, Controlling",
   "startDate": "2020",
   "endDate": "2022",
   "isCurrent": false,
   "location": "Frankfurt",
   "sourceFactIds": [
    "f13"
   ],
   "bullets": [
    {
     "text": "Cleaned data in Python (pandas) and wrote Excel reports.",
     "sourceFactIds": [
      "f14",
      "f15"
     ]
    }
   ]
  }
 ],
 "education": [
  {
   "institution": "Goethe University Frankfurt",
   "degree": "M.Sc.",
   "field": "Economics",
   "startDate": null,
   "endDate": "2022",
   "sourceFactIds": [
    "f16"
   ]
  },
  {
   "institution": "Goethe University Frankfurt",
   "degree": "B.Sc.",
   "field": "Economics",
   "startDate": null,
   "endDate": "2020",
   "sourceFactIds": [
    "f17"
   ]
  }
 ],
 "skills": [
  {
   "name": "SQL",
   "sourceFactIds": [
    "f18"
   ]
  },
  {
   "name": "BigQuery",
   "sourceFactIds": [
    "f19"
   ]
  },
  {
   "name": "Looker",
   "sourceFactIds": [
    "f21"
   ]
  },
  {
   "name": "Python (pandas)",
   "sourceFactIds": [
    "f20"
   ]
  },
  {
   "name": "Excel",
   "sourceFactIds": [
    "f22"
   ]
  },
  {
   "name": "English (C1)",
   "sourceFactIds": [
    "f24"
   ]
  },
  {
   "name": "German (native)",
   "sourceFactIds": [
    "f23"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/2-pdf.haiku-sonnet.judge.out.json.

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
