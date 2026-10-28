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
  "text": "Located in Lviv, Ukraine"
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
  "text": "Likes boring reliable systems"
 },
 {
  "id": "f9",
  "text": "Has worked at SoftServe from 2021 to now"
 },
 {
  "id": "f10",
  "text": "SoftServe role is in Lviv"
 },
 {
  "id": "f11",
  "text": "Was a backend engineer at SoftServe"
 },
 {
  "id": "f12",
  "text": "Has been tech lead of a team of 5 at SoftServe from March 2023"
 },
 {
  "id": "f13",
  "text": "Built a payment reconciliation service in Node.js/TypeScript + PostgreSQL"
 },
 {
  "id": "f14",
  "text": "The payment reconciliation service was for a US fintech client"
 },
 {
  "id": "f15",
  "text": "The payment reconciliation service processes about 2 million transactions a day"
 },
 {
  "id": "f16",
  "text": "Moved the team from a monolith deploy to Kubernetes (EKS)"
 },
 {
  "id": "f17",
  "text": "Deploy time went from ~40 min to 8 min"
 },
 {
  "id": "f18",
  "text": "Interviewed candidates"
 },
 {
  "id": "f19",
  "text": "Mentored 3 juniors"
 },
 {
  "id": "f20",
  "text": "Wrote internal guidelines for code review"
 },
 {
  "id": "f21",
  "text": "Worked at Lviv IT startup \"Fudzi\" from 2018 to 2021"
 },
 {
  "id": "f22",
  "text": "Fudzi is a food delivery startup"
 },
 {
  "id": "f23",
  "text": "Was a junior then middle PHP developer at Fudzi"
 },
 {
  "id": "f24",
  "text": "Worked on the Laravel backend for the courier app"
 },
 {
  "id": "f25",
  "text": "Integrated Google Maps API for route estimates"
 },
 {
  "id": "f26",
  "text": "Was on call for production incidents once a week"
 },
 {
  "id": "f27",
  "text": "Was a barista at Lviv Coffee Manufacture from 2016 to 2018"
 },
 {
  "id": "f28",
  "text": "The barista job was part-time during university"
 },
 {
  "id": "f29",
  "text": "Trained new baristas"
 },
 {
  "id": "f30",
  "text": "Studied BSc Applied Mathematics at Ivan Franko National University of Lviv"
 },
 {
  "id": "f31",
  "text": "University studies were 2014-2018"
 },
 {
  "id": "f32",
  "text": "Skill: TypeScript"
 },
 {
  "id": "f33",
  "text": "Skill: Node.js"
 },
 {
  "id": "f34",
  "text": "Skill: NestJS"
 },
 {
  "id": "f35",
  "text": "Skill: PostgreSQL"
 },
 {
  "id": "f36",
  "text": "Skill: Redis"
 },
 {
  "id": "f37",
  "text": "Skill: Kafka"
 },
 {
  "id": "f38",
  "text": "Skill: Docker"
 },
 {
  "id": "f39",
  "text": "Skill: Kubernetes"
 },
 {
  "id": "f40",
  "text": "Skill: AWS"
 },
 {
  "id": "f41",
  "text": "Skill: PHP"
 },
 {
  "id": "f42",
  "text": "Skill: Laravel"
 },
 {
  "id": "f43",
  "text": "Speaks English at B2 level"
 },
 {
  "id": "f44",
  "text": "Ukrainian is native language"
 },
 {
  "id": "f45",
  "text": "Speaks basic Polish"
 },
 {
  "id": "f46",
  "text": "Hobby: bouldering"
 },
 {
  "id": "f47",
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
  "text": "Backend developer with 6 years in the industry, tech lead of a team of 5 at SoftServe since March 2023. Built a Node.js/TypeScript and PostgreSQL payment reconciliation service processing about 2 million transactions a day, and moved the team's deploys to Kubernetes (EKS). Likes boring, reliable systems.",
  "sourceFactIds": [
   "f6",
   "f7",
   "f9",
   "f12",
   "f13",
   "f15",
   "f16",
   "f8"
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
    "f9",
    "f10",
    "f11",
    "f12"
   ],
   "bullets": [
    {
     "text": "Built a Node.js/TypeScript and PostgreSQL payment reconciliation service processing about 2 million transactions a day for a US fintech client",
     "sourceFactIds": [
      "f13",
      "f14",
      "f15"
     ]
    },
    {
     "text": "Moved the team from monolith deploys to Kubernetes (EKS), cutting deploy time from ~40 min to 8 min",
     "sourceFactIds": [
      "f16",
      "f17"
     ]
    },
    {
     "text": "Lead a team of 5 since March 2023; mentored 3 juniors and interviewed candidates",
     "sourceFactIds": [
      "f12",
      "f19",
      "f18"
     ]
    },
    {
     "text": "Wrote internal code review guidelines",
     "sourceFactIds": [
      "f20"
     ]
    }
   ]
  },
  {
   "organization": "Fudzi (food delivery startup)",
   "title": "Middle PHP Developer (previously Junior)",
   "startDate": "2018",
   "endDate": "2021",
   "isCurrent": false,
   "location": "Lviv",
   "sourceFactIds": [
    "f21",
    "f22",
    "f23"
   ],
   "bullets": [
    {
     "text": "Worked on the Laravel backend for the courier app",
     "sourceFactIds": [
      "f24"
     ]
    },
    {
     "text": "Integrated Google Maps API for route estimates",
     "sourceFactIds": [
      "f25"
     ]
    },
    {
     "text": "Was on call for production incidents once a week",
     "sourceFactIds": [
      "f26"
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
    "f27",
    "f28"
   ],
   "bullets": [
    {
     "text": "Trained new baristas",
     "sourceFactIds": [
      "f29"
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
    "f30",
    "f31"
   ]
  }
 ],
 "skills": [
  {
   "name": "Node.js",
   "sourceFactIds": [
    "f33"
   ]
  },
  {
   "name": "TypeScript",
   "sourceFactIds": [
    "f32"
   ]
  },
  {
   "name": "PostgreSQL",
   "sourceFactIds": [
    "f35"
   ]
  },
  {
   "name": "NestJS",
   "sourceFactIds": [
    "f34"
   ]
  },
  {
   "name": "Kafka",
   "sourceFactIds": [
    "f37"
   ]
  },
  {
   "name": "Redis",
   "sourceFactIds": [
    "f36"
   ]
  },
  {
   "name": "Kubernetes",
   "sourceFactIds": [
    "f39"
   ]
  },
  {
   "name": "AWS",
   "sourceFactIds": [
    "f40"
   ]
  },
  {
   "name": "Docker",
   "sourceFactIds": [
    "f38"
   ]
  },
  {
   "name": "PHP",
   "sourceFactIds": [
    "f41"
   ]
  },
  {
   "name": "Laravel",
   "sourceFactIds": [
    "f42"
   ]
  },
  {
   "name": "English (B2)",
   "sourceFactIds": [
    "f43"
   ]
  },
  {
   "name": "Ukrainian (native)",
   "sourceFactIds": [
    "f44"
   ]
  },
  {
   "name": "Polish (basic)",
   "sourceFactIds": [
    "f45"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/1-rich-text.single.judge.out.json.

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
