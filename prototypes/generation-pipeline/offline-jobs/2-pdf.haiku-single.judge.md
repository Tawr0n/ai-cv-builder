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
  "text": "Headline title is Data Analyst"
 },
 {
  "id": "f3",
  "text": "Email is markus.weber@example.de"
 },
 {
  "id": "f4",
  "text": "Location is Berlin"
 },
 {
  "id": "f5",
  "text": "Is an analyst with a background in economics"
 },
 {
  "id": "f6",
  "text": "Is comfortable with SQL and Python"
 },
 {
  "id": "f7",
  "text": "Presents to stakeholders"
 },
 {
  "id": "f8",
  "text": "Works at Zalando SE in Berlin"
 },
 {
  "id": "f9",
  "text": "Job title at Zalando is Junior Data Analyst"
 },
 {
  "id": "f10",
  "text": "Zalando role runs from 09/2022 to present"
 },
 {
  "id": "f11",
  "text": "Works with weekly dashboards in Looker for the returns team at Zalando"
 },
 {
  "id": "f12",
  "text": "Does ad-hoc SQL analyses (BigQuery) for category managers at Zalando"
 },
 {
  "id": "f13",
  "text": "Helped with an A/B test analysis for the checkout page at Zalando"
 },
 {
  "id": "f14",
  "text": "Worked at Deutsche Bahn in Frankfurt"
 },
 {
  "id": "f15",
  "text": "Role at Deutsche Bahn was working student in Controlling"
 },
 {
  "id": "f16",
  "text": "Deutsche Bahn role ran from 2020 to 2022"
 },
 {
  "id": "f17",
  "text": "Produced Excel reports at Deutsche Bahn"
 },
 {
  "id": "f18",
  "text": "Did data cleaning in Python (pandas) at Deutsche Bahn"
 },
 {
  "id": "f19",
  "text": "Holds an M.Sc. in Economics from Goethe University Frankfurt, 2022"
 },
 {
  "id": "f20",
  "text": "Holds a B.Sc. in Economics from Goethe University Frankfurt, 2020"
 },
 {
  "id": "f21",
  "text": "Skill: SQL"
 },
 {
  "id": "f22",
  "text": "Skill: BigQuery"
 },
 {
  "id": "f23",
  "text": "Skill: Python (pandas)"
 },
 {
  "id": "f24",
  "text": "Skill: Looker"
 },
 {
  "id": "f25",
  "text": "Skill: Excel"
 },
 {
  "id": "f26",
  "text": "German is a native language"
 },
 {
  "id": "f27",
  "text": "English at C1 level"
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
  "text": "Data Analyst with a background in economics, comfortable with SQL and Python and presenting to stakeholders. At Zalando SE in Berlin since 09/2022 as Junior Data Analyst, with ad-hoc SQL analyses for category managers and an A/B test analysis for the checkout page.",
  "sourceFactIds": [
   "f2",
   "f5",
   "f6",
   "f7",
   "f8",
   "f9",
   "f10",
   "f12",
   "f13"
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
    "f8",
    "f9",
    "f10"
   ],
   "bullets": [
    {
     "text": "Helped with an A/B test analysis for the checkout page.",
     "sourceFactIds": [
      "f13"
     ]
    },
    {
     "text": "Performed ad-hoc SQL analyses in BigQuery for category managers.",
     "sourceFactIds": [
      "f12"
     ]
    },
    {
     "text": "Worked on weekly Looker dashboards for the returns team.",
     "sourceFactIds": [
      "f11"
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
    "f14",
    "f15",
    "f16"
   ],
   "bullets": [
    {
     "text": "Worked on Excel reports and data cleaning in Python (pandas).",
     "sourceFactIds": [
      "f17",
      "f18"
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
    "f19"
   ]
  },
  {
   "institution": "Goethe University Frankfurt",
   "degree": "B.Sc.",
   "field": "Economics",
   "startDate": null,
   "endDate": "2020",
   "sourceFactIds": [
    "f20"
   ]
  }
 ],
 "skills": [
  {
   "name": "SQL",
   "sourceFactIds": [
    "f21"
   ]
  },
  {
   "name": "Python (pandas)",
   "sourceFactIds": [
    "f23"
   ]
  },
  {
   "name": "BigQuery",
   "sourceFactIds": [
    "f22"
   ]
  },
  {
   "name": "Looker",
   "sourceFactIds": [
    "f24"
   ]
  },
  {
   "name": "Excel",
   "sourceFactIds": [
    "f25"
   ]
  },
  {
   "name": "English (C1)",
   "sourceFactIds": [
    "f27"
   ]
  },
  {
   "name": "German (native)",
   "sourceFactIds": [
    "f26"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/2-pdf.haiku-single.judge.out.json.

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
