# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "Full name is Olena Kovalenko."
 },
 {
  "id": "f2",
  "text": "Email is olena.kovalenko@example.com."
 },
 {
  "id": "f3",
  "text": "Phone is +380 67 123 4567."
 },
 {
  "id": "f4",
  "text": "Location is Lviv, Ukraine."
 },
 {
  "id": "f5",
  "text": "GitHub is github.com/okoval."
 },
 {
  "id": "f6",
  "text": "Is a backend developer."
 },
 {
  "id": "f7",
  "text": "Has 6 years in the industry."
 },
 {
  "id": "f8",
  "text": "Likes boring reliable systems."
 },
 {
  "id": "f9",
  "text": "Role at SoftServe in Lviv, 2021 - now."
 },
 {
  "id": "f10",
  "text": "Was a backend engineer at SoftServe."
 },
 {
  "id": "f11",
  "text": "Was tech lead of a team of 5 at SoftServe from March 2023."
 },
 {
  "id": "f12",
  "text": "Built a payment reconciliation service in Node.js/TypeScript + PostgreSQL."
 },
 {
  "id": "f13",
  "text": "The payment reconciliation service was built for a US fintech client."
 },
 {
  "id": "f14",
  "text": "The payment reconciliation service processes about 2 million transactions a day."
 },
 {
  "id": "f15",
  "text": "Moved the team from a monolith deploy to Kubernetes (EKS)."
 },
 {
  "id": "f16",
  "text": "Deploy time went from ~40 min to 8 min."
 },
 {
  "id": "f17",
  "text": "Interviewed candidates."
 },
 {
  "id": "f18",
  "text": "Mentored 3 juniors."
 },
 {
  "id": "f19",
  "text": "Wrote internal guidelines for code review."
 },
 {
  "id": "f20",
  "text": "Worked at Lviv IT startup \"Fudzi\" (food delivery), 2018 - 2021."
 },
 {
  "id": "f21",
  "text": "Was a junior PHP developer at Fudzi."
 },
 {
  "id": "f22",
  "text": "Was a middle PHP developer at Fudzi."
 },
 {
  "id": "f23",
  "text": "Built the Laravel backend for the courier app."
 },
 {
  "id": "f24",
  "text": "Integrated Google Maps API for route estimates."
 },
 {
  "id": "f25",
  "text": "Was on call for production incidents once a week."
 },
 {
  "id": "f26",
  "text": "Worked as a barista at Lviv Coffee Manufacture, 2016 - 2018."
 },
 {
  "id": "f27",
  "text": "Worked part-time during university."
 },
 {
  "id": "f28",
  "text": "Trained new baristas."
 },
 {
  "id": "f29",
  "text": "Studied at Ivan Franko National University of Lviv."
 },
 {
  "id": "f30",
  "text": "Education is BSc Applied Mathematics."
 },
 {
  "id": "f31",
  "text": "Education dates are 2014-2018."
 },
 {
  "id": "f32",
  "text": "Skill: TypeScript."
 },
 {
  "id": "f33",
  "text": "Skill: Node.js."
 },
 {
  "id": "f34",
  "text": "Skill: NestJS."
 },
 {
  "id": "f35",
  "text": "Skill: PostgreSQL."
 },
 {
  "id": "f36",
  "text": "Skill: Redis."
 },
 {
  "id": "f37",
  "text": "Skill: Kafka."
 },
 {
  "id": "f38",
  "text": "Skill: Docker."
 },
 {
  "id": "f39",
  "text": "Skill: Kubernetes."
 },
 {
  "id": "f40",
  "text": "Skill: AWS."
 },
 {
  "id": "f41",
  "text": "Skill: PHP."
 },
 {
  "id": "f42",
  "text": "Skill: Laravel."
 },
 {
  "id": "f43",
  "text": "English language at B2 level."
 },
 {
  "id": "f44",
  "text": "Ukrainian language, native."
 },
 {
  "id": "f45",
  "text": "Polish language, basic."
 },
 {
  "id": "f46",
  "text": "Hobby: bouldering."
 },
 {
  "id": "f47",
  "text": "Hobby: board games."
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
  "text": "Backend developer with 6 years in the industry, currently tech lead of a team of 5 at SoftServe. Built a Node.js/TypeScript and PostgreSQL payment reconciliation service processing about 2 million transactions a day, and moved the team to Kubernetes (EKS), cutting deploy time from ~40 to 8 minutes. Likes boring, reliable systems.",
  "sourceFactIds": [
   "f6",
   "f7",
   "f9",
   "f11",
   "f12",
   "f14",
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
    "f11"
   ],
   "bullets": [
    {
     "text": "Built a payment reconciliation service in Node.js/TypeScript and PostgreSQL processing ~2M transactions a day for a US fintech client.",
     "sourceFactIds": [
      "f12",
      "f13",
      "f14"
     ]
    },
    {
     "text": "Moved the team from a monolith deploy to Kubernetes (EKS), cutting deploy time from ~40 to 8 minutes.",
     "sourceFactIds": [
      "f15",
      "f16"
     ]
    },
    {
     "text": "Led a team of 5 as tech lead since March 2023.",
     "sourceFactIds": [
      "f11"
     ]
    },
    {
     "text": "Mentored 3 juniors, interviewed candidates and wrote internal code review guidelines.",
     "sourceFactIds": [
      "f18",
      "f17",
      "f19"
     ]
    }
   ]
  },
  {
   "organization": "Fudzi (food delivery startup)",
   "title": "Middle PHP Developer (previously Junior PHP Developer)",
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
     "text": "Built the Laravel backend for the courier app.",
     "sourceFactIds": [
      "f23"
     ]
    },
    {
     "text": "Integrated Google Maps API for route estimates.",
     "sourceFactIds": [
      "f24"
     ]
    },
    {
     "text": "Was on call for production incidents once a week.",
     "sourceFactIds": [
      "f25"
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
    "f26",
    "f27"
   ],
   "bullets": [
    {
     "text": "Trained new baristas.",
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
    "f29",
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
   "name": "AWS",
   "sourceFactIds": [
    "f40"
   ]
  },
  {
   "name": "Kubernetes",
   "sourceFactIds": [
    "f39"
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

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/1-rich-text.haiku-opus.judge.out.json.

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
