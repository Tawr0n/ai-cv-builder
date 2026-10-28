# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "Full name is Olena Kovalenko"
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
  "text": "Location is Lviv, Ukraine"
 },
 {
  "id": "f5",
  "text": "GitHub profile is github.com/okoval"
 },
 {
  "id": "f6",
  "text": "Is a backend developer"
 },
 {
  "id": "f7",
  "text": "Has 6 years in the industry"
 },
 {
  "id": "f8",
  "text": "Says they like boring reliable systems"
 },
 {
  "id": "f9",
  "text": "Works at SoftServe in Lviv, from 2021 to now"
 },
 {
  "id": "f10",
  "text": "Started at SoftServe as a backend engineer"
 },
 {
  "id": "f11",
  "text": "Became tech lead of a team of 5 at SoftServe from March 2023"
 },
 {
  "id": "f12",
  "text": "Built a payment reconciliation service in Node.js/TypeScript and PostgreSQL for a US fintech client"
 },
 {
  "id": "f13",
  "text": "The payment reconciliation service processes about 2 million transactions a day"
 },
 {
  "id": "f14",
  "text": "Moved the team from a monolith deploy to Kubernetes (EKS)"
 },
 {
  "id": "f15",
  "text": "Deploy time went from ~40 min to 8 min"
 },
 {
  "id": "f16",
  "text": "Interviewed candidates"
 },
 {
  "id": "f17",
  "text": "Mentored 3 juniors"
 },
 {
  "id": "f18",
  "text": "Wrote internal guidelines for code review"
 },
 {
  "id": "f19",
  "text": "Worked at Fudzi, a Lviv IT startup in food delivery, from 2018 to 2021"
 },
 {
  "id": "f20",
  "text": "At Fudzi, went from junior to middle PHP developer"
 },
 {
  "id": "f21",
  "text": "Built the Laravel backend for the courier app at Fudzi"
 },
 {
  "id": "f22",
  "text": "Integrated the Google Maps API for route estimates at Fudzi"
 },
 {
  "id": "f23",
  "text": "Was on call for production incidents once a week at Fudzi"
 },
 {
  "id": "f24",
  "text": "Worked as a barista at Lviv Coffee Manufacture from 2016 to 2018, part-time during university"
 },
 {
  "id": "f25",
  "text": "Trained new baristas"
 },
 {
  "id": "f26",
  "text": "Studied at Ivan Franko National University of Lviv"
 },
 {
  "id": "f27",
  "text": "Degree is BSc in Applied Mathematics"
 },
 {
  "id": "f28",
  "text": "Education dates are 2014 to 2018"
 },
 {
  "id": "f29",
  "text": "Skill: TypeScript"
 },
 {
  "id": "f30",
  "text": "Skill: Node.js"
 },
 {
  "id": "f31",
  "text": "Skill: NestJS"
 },
 {
  "id": "f32",
  "text": "Skill: PostgreSQL"
 },
 {
  "id": "f33",
  "text": "Skill: Redis"
 },
 {
  "id": "f34",
  "text": "Skill: Kafka"
 },
 {
  "id": "f35",
  "text": "Skill: Docker"
 },
 {
  "id": "f36",
  "text": "Skill: Kubernetes"
 },
 {
  "id": "f37",
  "text": "Skill: AWS"
 },
 {
  "id": "f38",
  "text": "Skill: PHP"
 },
 {
  "id": "f39",
  "text": "Skill: Laravel"
 },
 {
  "id": "f40",
  "text": "Speaks English at B2 level"
 },
 {
  "id": "f41",
  "text": "Ukrainian is a native language"
 },
 {
  "id": "f42",
  "text": "Speaks Polish at basic level"
 },
 {
  "id": "f43",
  "text": "Hobby: bouldering"
 },
 {
  "id": "f44",
  "text": "Hobby: board games"
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
  "text": "Backend developer with 6 years in the industry, tech lead of a team of 5 at SoftServe since March 2023. Built a Node.js/TypeScript and PostgreSQL payment reconciliation service for a US fintech client, processing about 2 million transactions a day. Moved a team from monolith deploys to Kubernetes (EKS), with deploy time going from ~40 min to 8 min.",
  "sourceFactIds": [
   "f6",
   "f7",
   "f9",
   "f11",
   "f12",
   "f13",
   "f14",
   "f15"
  ]
 },
 "experience": [
  {
   "organization": "SoftServe",
   "title": "Tech Lead",
   "startDate": "2021",
   "endDate": null,
   "isCurrent": true,
   "location": "Lviv",
   "sourceFactIds": [
    "f9",
    "f10",
    "f11"
   ],
   "bullets": [
    {
     "text": "Built a Node.js/TypeScript and PostgreSQL payment reconciliation service for a US fintech client, processing about 2 million transactions a day.",
     "sourceFactIds": [
      "f12",
      "f13"
     ]
    },
    {
     "text": "Moved the team from a monolith deploy to Kubernetes (EKS); deploy time went from ~40 min to 8 min.",
     "sourceFactIds": [
      "f14",
      "f15"
     ]
    },
    {
     "text": "Served as tech lead of a team of 5 from March 2023.",
     "sourceFactIds": [
      "f11"
     ]
    },
    {
     "text": "Mentored 3 juniors, interviewed candidates and wrote internal guidelines for code review.",
     "sourceFactIds": [
      "f16",
      "f17",
      "f18"
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
    "f19",
    "f20"
   ],
   "bullets": [
    {
     "text": "Developed the Laravel backend for the courier app.",
     "sourceFactIds": [
      "f21"
     ]
    },
    {
     "text": "Integrated the Google Maps API for route estimates.",
     "sourceFactIds": [
      "f22"
     ]
    },
    {
     "text": "Was on call for production incidents once a week.",
     "sourceFactIds": [
      "f23"
     ]
    }
   ]
  },
  {
   "organization": "Lviv Coffee Manufacture",
   "title": "Barista",
   "startDate": "2016",
   "endDate": "2018",
   "isCurrent": false,
   "location": null,
   "sourceFactIds": [
    "f24"
   ],
   "bullets": [
    {
     "text": "Trained new baristas.",
     "sourceFactIds": [
      "f25"
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
    "f26",
    "f27",
    "f28"
   ]
  }
 ],
 "skills": [
  {
   "name": "TypeScript",
   "sourceFactIds": [
    "f29"
   ]
  },
  {
   "name": "Node.js",
   "sourceFactIds": [
    "f30"
   ]
  },
  {
   "name": "NestJS",
   "sourceFactIds": [
    "f31"
   ]
  },
  {
   "name": "PostgreSQL",
   "sourceFactIds": [
    "f32"
   ]
  },
  {
   "name": "Kubernetes",
   "sourceFactIds": [
    "f36"
   ]
  },
  {
   "name": "Kafka",
   "sourceFactIds": [
    "f34"
   ]
  },
  {
   "name": "Redis",
   "sourceFactIds": [
    "f33"
   ]
  },
  {
   "name": "Docker",
   "sourceFactIds": [
    "f35"
   ]
  },
  {
   "name": "AWS",
   "sourceFactIds": [
    "f37"
   ]
  },
  {
   "name": "PHP",
   "sourceFactIds": [
    "f38"
   ]
  },
  {
   "name": "Laravel",
   "sourceFactIds": [
    "f39"
   ]
  },
  {
   "name": "English (B2)",
   "sourceFactIds": [
    "f40"
   ]
  },
  {
   "name": "Ukrainian (native)",
   "sourceFactIds": [
    "f41"
   ]
  },
  {
   "name": "Polish (basic)",
   "sourceFactIds": [
    "f42"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/1-rich-text.haiku-single.judge.out.json.

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
