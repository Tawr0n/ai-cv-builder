# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "Name is Olena Kovalenko"
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
  "text": "Worked at SoftServe, Lviv, from 2021 to now"
 },
 {
  "id": "f10",
  "text": "Backend engineer at SoftServe"
 },
 {
  "id": "f11",
  "text": "Tech lead of a team of 5 at SoftServe from March 2023"
 },
 {
  "id": "f12",
  "text": "Built a payment reconciliation service in Node.js/TypeScript + PostgreSQL"
 },
 {
  "id": "f13",
  "text": "The payment reconciliation service was built for a US fintech client"
 },
 {
  "id": "f14",
  "text": "The payment reconciliation service processes about 2 million transactions a day"
 },
 {
  "id": "f15",
  "text": "Moved the team from a monolith deploy to Kubernetes (EKS)"
 },
 {
  "id": "f16",
  "text": "Deploy time went from ~40 min to 8 min"
 },
 {
  "id": "f17",
  "text": "Interviewed candidates"
 },
 {
  "id": "f18",
  "text": "Mentored 3 juniors"
 },
 {
  "id": "f19",
  "text": "Wrote internal guidelines for code review"
 },
 {
  "id": "f20",
  "text": "Worked at Lviv IT startup \"Fudzi\" from 2018 to 2021"
 },
 {
  "id": "f21",
  "text": "Fudzi is a food delivery startup"
 },
 {
  "id": "f22",
  "text": "Junior then middle PHP developer at Fudzi"
 },
 {
  "id": "f23",
  "text": "Worked on the Laravel backend for the courier app"
 },
 {
  "id": "f24",
  "text": "Integrated Google Maps API for route estimates"
 },
 {
  "id": "f25",
  "text": "Was on call for production incidents once a week"
 },
 {
  "id": "f26",
  "text": "Barista at Lviv Coffee Manufacture from 2016 to 2018"
 },
 {
  "id": "f27",
  "text": "The barista job was part-time during university"
 },
 {
  "id": "f28",
  "text": "Trained new baristas"
 },
 {
  "id": "f29",
  "text": "BSc Applied Mathematics, Ivan Franko National University of Lviv, 2014-2018"
 },
 {
  "id": "f30",
  "text": "Skill: TypeScript"
 },
 {
  "id": "f31",
  "text": "Skill: Node.js"
 },
 {
  "id": "f32",
  "text": "Skill: NestJS"
 },
 {
  "id": "f33",
  "text": "Skill: PostgreSQL"
 },
 {
  "id": "f34",
  "text": "Skill: Redis"
 },
 {
  "id": "f35",
  "text": "Skill: Kafka"
 },
 {
  "id": "f36",
  "text": "Skill: Docker"
 },
 {
  "id": "f37",
  "text": "Skill: Kubernetes"
 },
 {
  "id": "f38",
  "text": "Skill: AWS"
 },
 {
  "id": "f39",
  "text": "Skill: PHP"
 },
 {
  "id": "f40",
  "text": "Skill: Laravel"
 },
 {
  "id": "f41",
  "text": "English B2"
 },
 {
  "id": "f42",
  "text": "Ukrainian native"
 },
 {
  "id": "f43",
  "text": "Polish basic"
 },
 {
  "id": "f44",
  "text": "Hobby: bouldering"
 },
 {
  "id": "f45",
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
  "text": "Backend developer with 6 years in the industry, currently tech lead of a team of 5 at SoftServe. Built a Node.js/TypeScript and PostgreSQL payment reconciliation service for a US fintech client that processes about 2 million transactions a day. Likes boring, reliable systems.",
  "sourceFactIds": [
   "f6",
   "f7",
   "f9",
   "f11",
   "f12",
   "f13",
   "f14",
   "f8"
  ]
 },
 "experience": [
  {
   "organization": "SoftServe",
   "title": "Backend Engineer / Tech Lead",
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
     "text": "Built a payment reconciliation service in Node.js/TypeScript and PostgreSQL for a US fintech client, processing ~2M transactions/day",
     "sourceFactIds": [
      "f12",
      "f13",
      "f14"
     ]
    },
    {
     "text": "Moved the team from monolith deploys to Kubernetes (EKS); deploy time went from ~40 to 8 minutes",
     "sourceFactIds": [
      "f15",
      "f16"
     ]
    },
    {
     "text": "Led a team of 5 as tech lead since March 2023",
     "sourceFactIds": [
      "f11"
     ]
    },
    {
     "text": "Mentored 3 juniors, interviewed candidates and wrote internal code review guidelines",
     "sourceFactIds": [
      "f17",
      "f18",
      "f19"
     ]
    }
   ]
  },
  {
   "organization": "Fudzi",
   "title": "Junior then Middle PHP Developer",
   "startDate": "2018",
   "endDate": "2021",
   "isCurrent": false,
   "location": "Lviv",
   "sourceFactIds": [
    "f20",
    "f21",
    "f22"
   ],
   "bullets": [
    {
     "text": "Worked on the Laravel backend for the courier app of a food delivery startup",
     "sourceFactIds": [
      "f21",
      "f23"
     ]
    },
    {
     "text": "Integrated Google Maps API for route estimates",
     "sourceFactIds": [
      "f24"
     ]
    },
    {
     "text": "Served on call for production incidents once a week",
     "sourceFactIds": [
      "f25"
     ]
    }
   ]
  },
  {
   "organization": "Lviv Coffee Manufacture",
   "title": "Barista (part-time, during university)",
   "startDate": "2016",
   "endDate": "2018",
   "isCurrent": false,
   "location": null,
   "sourceFactIds": [
    "f26",
    "f27"
   ],
   "bullets": [
    {
     "text": "Trained new baristas",
     "sourceFactIds": [
      "f28"
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
    "f29"
   ]
  }
 ],
 "skills": [
  {
   "name": "TypeScript",
   "sourceFactIds": [
    "f30"
   ]
  },
  {
   "name": "Node.js",
   "sourceFactIds": [
    "f31"
   ]
  },
  {
   "name": "NestJS",
   "sourceFactIds": [
    "f32"
   ]
  },
  {
   "name": "PostgreSQL",
   "sourceFactIds": [
    "f33"
   ]
  },
  {
   "name": "Kafka",
   "sourceFactIds": [
    "f35"
   ]
  },
  {
   "name": "Redis",
   "sourceFactIds": [
    "f34"
   ]
  },
  {
   "name": "AWS",
   "sourceFactIds": [
    "f38"
   ]
  },
  {
   "name": "Kubernetes",
   "sourceFactIds": [
    "f37"
   ]
  },
  {
   "name": "Docker",
   "sourceFactIds": [
    "f36"
   ]
  },
  {
   "name": "PHP",
   "sourceFactIds": [
    "f39"
   ]
  },
  {
   "name": "Laravel",
   "sourceFactIds": [
    "f40"
   ]
  },
  {
   "name": "English (B2)",
   "sourceFactIds": [
    "f41"
   ]
  },
  {
   "name": "Ukrainian (native)",
   "sourceFactIds": [
    "f42"
   ]
  },
  {
   "name": "Polish (basic)",
   "sourceFactIds": [
    "f43"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/1-rich-text.staged.judge.out.json.

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
