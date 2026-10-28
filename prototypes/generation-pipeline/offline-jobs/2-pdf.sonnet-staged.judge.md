# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

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
  "text": "Data analyst with a background in economics, comfortable with SQL and Python and with presenting to stakeholders. Junior Data Analyst at Zalando SE since 09/2022, running ad-hoc BigQuery analyses and building Looker dashboards.",
  "sourceFactIds": [
   "f2",
   "f5",
   "f6",
   "f7",
   "f8",
   "f9",
   "f10"
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
    "f8"
   ],
   "bullets": [
    {
     "text": "Helped with an A/B test analysis for the checkout page.",
     "sourceFactIds": [
      "f11"
     ]
    },
    {
     "text": "Run ad-hoc SQL analyses in BigQuery for category managers.",
     "sourceFactIds": [
      "f10"
     ]
    },
    {
     "text": "Build weekly Looker dashboards for the returns team.",
     "sourceFactIds": [
      "f9"
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
    "f12"
   ],
   "bullets": [
    {
     "text": "Cleaned data in Python (pandas) and produced Excel reports.",
     "sourceFactIds": [
      "f13",
      "f14"
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
    "f15"
   ]
  },
  {
   "institution": "Goethe University Frankfurt",
   "degree": "B.Sc.",
   "field": "Economics",
   "startDate": null,
   "endDate": "2020",
   "sourceFactIds": [
    "f16"
   ]
  }
 ],
 "skills": [
  {
   "name": "SQL",
   "sourceFactIds": [
    "f17"
   ]
  },
  {
   "name": "BigQuery",
   "sourceFactIds": [
    "f18"
   ]
  },
  {
   "name": "Python (pandas)",
   "sourceFactIds": [
    "f19"
   ]
  },
  {
   "name": "Looker",
   "sourceFactIds": [
    "f20"
   ]
  },
  {
   "name": "Excel",
   "sourceFactIds": [
    "f21"
   ]
  },
  {
   "name": "German (native)",
   "sourceFactIds": [
    "f22"
   ]
  },
  {
   "name": "English (C1)",
   "sourceFactIds": [
    "f23"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/2-pdf.sonnet-staged.judge.out.json.

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
