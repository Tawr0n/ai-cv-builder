# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "The person's name is Olena Kovalenko"
 },
 {
  "id": "f2",
  "text": "Email is olena.kovalenko@example.com"
 },
 {
  "id": "f3",
  "text": "Phone is +380 67 123 4567"
 },
 {
  "id": "f4",
  "text": "Based in Lviv, Ukraine"
 },
 {
  "id": "f5",
  "text": "GitHub profile is github.com/okoval"
 },
 {
  "id": "f6",
  "text": "Backend developer with 6 years in the industry"
 },
 {
  "id": "f7",
  "text": "Likes boring reliable systems"
 },
 {
  "id": "f8",
  "text": "Works at SoftServe, Lviv, from 2021 until now"
 },
 {
  "id": "f9",
  "text": "At SoftServe was a backend engineer, then tech lead of a team of 5 from March 2023"
 },
 {
  "id": "f10",
  "text": "Built a payment reconciliation service in Node.js/TypeScript + PostgreSQL for a US fintech client"
 },
 {
  "id": "f11",
  "text": "The payment reconciliation service processes about 2 million transactions a day"
 },
 {
  "id": "f12",
  "text": "Moved the team from a monolith deploy to Kubernetes (EKS)"
 },
 {
  "id": "f13",
  "text": "Deploy time went from ~40 min to 8 min"
 },
 {
  "id": "f14",
  "text": "Interviewed candidates"
 },
 {
  "id": "f15",
  "text": "Mentored 3 juniors"
 },
 {
  "id": "f16",
  "text": "Wrote internal guidelines for code review"
 },
 {
  "id": "f17",
  "text": "Worked at Fudzi, a Lviv IT startup (food delivery), 2018 - 2021"
 },
 {
  "id": "f18",
  "text": "At Fudzi was a junior then middle PHP developer"
 },
 {
  "id": "f19",
  "text": "Built the Laravel backend for the courier app"
 },
 {
  "id": "f20",
  "text": "Integrated Google Maps API for route estimates"
 },
 {
  "id": "f21",
  "text": "Was on call for production incidents once a week"
 },
 {
  "id": "f22",
  "text": "Worked as a barista at Lviv Coffee Manufacture, part-time during university, 2016 - 2018"
 },
 {
  "id": "f23",
  "text": "Trained new baristas"
 },
 {
  "id": "f24",
  "text": "Studied at Ivan Franko National University of Lviv, BSc Applied Mathematics, 2014-2018"
 },
 {
  "id": "f25",
  "text": "Skill: TypeScript"
 },
 {
  "id": "f26",
  "text": "Skill: Node.js"
 },
 {
  "id": "f27",
  "text": "Skill: NestJS"
 },
 {
  "id": "f28",
  "text": "Skill: PostgreSQL"
 },
 {
  "id": "f29",
  "text": "Skill: Redis"
 },
 {
  "id": "f30",
  "text": "Skill: Kafka"
 },
 {
  "id": "f31",
  "text": "Skill: Docker"
 },
 {
  "id": "f32",
  "text": "Skill: Kubernetes"
 },
 {
  "id": "f33",
  "text": "Skill: AWS"
 },
 {
  "id": "f34",
  "text": "Skill: PHP"
 },
 {
  "id": "f35",
  "text": "Skill: Laravel"
 },
 {
  "id": "f36",
  "text": "English level B2"
 },
 {
  "id": "f37",
  "text": "Ukrainian is native"
 },
 {
  "id": "f38",
  "text": "Polish level basic"
 }
]
</facts>
<cv>
{
 "contact": {
  "fullName": "Olena Kovalenko",
  "email": "olena.kovalenko@example.com",
  "phone": "+380 67 123 4567",
  "location": "Lviv, Ukraine",
  "links": [
   "github.com/okoval"
  ],
  "sourceFactIds": [
   "f1",
   "f2",
   "f3",
   "f4",
   "f5"
  ]
 },
 "summary": {
  "text": "Backend engineer with 6 years in the industry, currently tech lead of a team of 5 at SoftServe. Built a Node.js/TypeScript and PostgreSQL payment reconciliation service processing about 2 million transactions a day, and moved the team to Kubernetes (EKS). Prefers boring, reliable systems.",
  "sourceFactIds": [
   "f6",
   "f8",
   "f9",
   "f10",
   "f11",
   "f12",
   "f7"
  ]
 },
 "experience": [
  {
   "organization": "SoftServe",
   "title": "Tech Lead (previously Backend Engineer)",
   "startDate": "2021",
   "endDate": null,
   "isCurrent": true,
   "location": "Lviv",
   "sourceFactIds": [
    "f8",
    "f9"
   ],
   "bullets": [
    {
     "text": "Built a payment reconciliation service in Node.js/TypeScript and PostgreSQL for a US fintech client, processing about 2 million transactions a day.",
     "sourceFactIds": [
      "f10",
      "f11"
     ]
    },
    {
     "text": "Moved the team from a monolith deploy to Kubernetes (EKS), cutting deploy time from ~40 min to 8 min.",
     "sourceFactIds": [
      "f12",
      "f13"
     ]
    },
    {
     "text": "Mentored 3 juniors and interviewed candidates.",
     "sourceFactIds": [
      "f14",
      "f15"
     ]
    },
    {
     "text": "Wrote internal guidelines for code review.",
     "sourceFactIds": [
      "f16"
     ]
    }
   ]
  },
  {
   "organization": "Fudzi",
   "title": "Junior, then Middle PHP Developer",
   "startDate": "2018",
   "endDate": "2021",
   "isCurrent": false,
   "location": "Lviv",
   "sourceFactIds": [
    "f17",
    "f18"
   ],
   "bullets": [
    {
     "text": "Built the Laravel backend for the courier app.",
     "sourceFactIds": [
      "f19"
     ]
    },
    {
     "text": "Integrated Google Maps API for route estimates.",
     "sourceFactIds": [
      "f20"
     ]
    },
    {
     "text": "Handled production incidents on a weekly on-call rotation.",
     "sourceFactIds": [
      "f21"
     ]
    }
   ]
  },
  {
   "organization": "Lviv Coffee Manufacture",
   "title": "Barista (part-time)",
   "startDate": "2016",
   "endDate": "2018",
   "isCurrent": false,
   "location": null,
   "sourceFactIds": [
    "f22"
   ],
   "bullets": [
    {
     "text": "Trained new baristas.",
     "sourceFactIds": [
      "f23"
     ]
    }
   ]
  }
 ],
 "education": [
  {
   "institution": "Ivan Franko National University of Lviv",
   "degree": "BSc",
   "field": "Applied Mathematics",
   "startDate": "2014",
   "endDate": "2018",
   "sourceFactIds": [
    "f24"
   ]
  }
 ],
 "skills": [
  {
   "name": "TypeScript",
   "sourceFactIds": [
    "f25"
   ]
  },
  {
   "name": "Node.js",
   "sourceFactIds": [
    "f26"
   ]
  },
  {
   "name": "NestJS",
   "sourceFactIds": [
    "f27"
   ]
  },
  {
   "name": "PostgreSQL",
   "sourceFactIds": [
    "f28"
   ]
  },
  {
   "name": "Kafka",
   "sourceFactIds": [
    "f30"
   ]
  },
  {
   "name": "Redis",
   "sourceFactIds": [
    "f29"
   ]
  },
  {
   "name": "AWS",
   "sourceFactIds": [
    "f33"
   ]
  },
  {
   "name": "Kubernetes",
   "sourceFactIds": [
    "f32"
   ]
  },
  {
   "name": "Docker",
   "sourceFactIds": [
    "f31"
   ]
  },
  {
   "name": "PHP",
   "sourceFactIds": [
    "f34"
   ]
  },
  {
   "name": "Laravel",
   "sourceFactIds": [
    "f35"
   ]
  },
  {
   "name": "English (B2)",
   "sourceFactIds": [
    "f36"
   ]
  },
  {
   "name": "Ukrainian (native)",
   "sourceFactIds": [
    "f37"
   ]
  },
  {
   "name": "Polish (basic)",
   "sourceFactIds": [
    "f38"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/1-rich-text.sonnet-single.judge.out.json.

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
