# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "Full name is Markus Weber"
 },
 {
  "id": "f2",
  "text": "Headline: Data Analyst"
 },
 {
  "id": "f3",
  "text": "Email is markus.weber@example.de"
 },
 {
  "id": "f4",
  "text": "Based in Berlin"
 },
 {
  "id": "f5",
  "text": "Analyst with a background in economics"
 },
 {
  "id": "f6",
  "text": "Comfortable with SQL"
 },
 {
  "id": "f7",
  "text": "Comfortable with Python"
 },
 {
  "id": "f8",
  "text": "Comfortable presenting to stakeholders"
 },
 {
  "id": "f9",
  "text": "Junior Data Analyst at Zalando SE, Berlin, from 09/2022 to present"
 },
 {
  "id": "f10",
  "text": "Weekly dashboards in Looker for the returns team (at Zalando SE)"
 },
 {
  "id": "f11",
  "text": "Ad-hoc SQL analyses (BigQuery) for category managers (at Zalando SE)"
 },
 {
  "id": "f12",
  "text": "Helped with an A/B test analysis for the checkout page (at Zalando SE)"
 },
 {
  "id": "f13",
  "text": "Working student, Controlling at Deutsche Bahn, Frankfurt, 2020 - 2022"
 },
 {
  "id": "f14",
  "text": "Excel reports (at Deutsche Bahn)"
 },
 {
  "id": "f15",
  "text": "Data cleaning in Python (pandas) (at Deutsche Bahn)"
 },
 {
  "id": "f16",
  "text": "M.Sc. Economics, Goethe University Frankfurt, 2022"
 },
 {
  "id": "f17",
  "text": "B.Sc. Economics, Goethe University Frankfurt, 2020"
 },
 {
  "id": "f18",
  "text": "Skill: SQL"
 },
 {
  "id": "f19",
  "text": "Skill: BigQuery"
 },
 {
  "id": "f20",
  "text": "Skill: Python (pandas)"
 },
 {
  "id": "f21",
  "text": "Skill: Looker"
 },
 {
  "id": "f22",
  "text": "Skill: Excel"
 },
 {
  "id": "f23",
  "text": "Language: German (native)"
 },
 {
  "id": "f24",
  "text": "Language: English (C1)"
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
  "text": "Junior Data Analyst at Zalando SE with an M.Sc. in Economics, comfortable with SQL and Python and with presenting to stakeholders. Runs ad-hoc BigQuery analyses for category managers, builds weekly Looker dashboards and helped with an A/B test analysis for the checkout page.",
  "sourceFactIds": [
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
     "text": "Produced weekly Looker dashboards for the returns team.",
     "sourceFactIds": [
      "f10"
     ]
    }
   ]
  },
  {
   "organization": "Deutsche Bahn",
   "title": "Working Student, Controlling",
   "startDate": "2020",
   "endDate": "2022",
   "isCurrent": false,
   "location": "Frankfurt",
   "sourceFactIds": [
    "f13"
   ],
   "bullets": [
    {
     "text": "Cleaned data in Python (pandas).",
     "sourceFactIds": [
      "f15"
     ]
    },
    {
     "text": "Prepared Excel reports.",
     "sourceFactIds": [
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
    "f18",
    "f6"
   ]
  },
  {
   "name": "BigQuery",
   "sourceFactIds": [
    "f19"
   ]
  },
  {
   "name": "Python (pandas)",
   "sourceFactIds": [
    "f20",
    "f7"
   ]
  },
  {
   "name": "Looker",
   "sourceFactIds": [
    "f21"
   ]
  },
  {
   "name": "Excel",
   "sourceFactIds": [
    "f22"
   ]
  },
  {
   "name": "German (native)",
   "sourceFactIds": [
    "f23"
   ]
  },
  {
   "name": "English (C1)",
   "sourceFactIds": [
    "f24"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/2-pdf.single.judge.out.json.

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
