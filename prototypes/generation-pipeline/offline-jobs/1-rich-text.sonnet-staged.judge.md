# SYSTEM

You audit a CV draft against the Facts it claims to rest on. For every summary, experience header, bullet, education entry and skill, check that every claim in it (numbers, names, technologies, scope, seniority, outcomes) is stated by its cited Facts. Report only problems; an empty list is a valid answer. Rephrasing is fine.

# USER

<facts>
[
 {
  "id": "f1",
  "text": "The person's name is Olena Kovalenko."
 },
 {
  "id": "f2",
  "text": "Email: olena.kovalenko@example.com"
 },
 {
  "id": "f3",
  "text": "Phone: +380 67 123 4567"
 },
 {
  "id": "f4",
  "text": "Location: Lviv, Ukraine"
 },
 {
  "id": "f5",
  "text": "GitHub: github.com/okoval"
 },
 {
  "id": "f6",
  "text": "Is a backend developer with 6 years in the industry."
 },
 {
  "id": "f7",
  "text": "Likes boring reliable systems."
 },
 {
  "id": "f8",
  "text": "Has worked at SoftServe, Lviv from 2021 to now."
 },
 {
  "id": "f9",
  "text": "At SoftServe, was a backend engineer."
 },
 {
  "id": "f10",
  "text": "At SoftServe, has been tech lead of a team of 5 from March 2023."
 },
 {
  "id": "f11",
  "text": "Built a payment reconciliation service in Node.js/TypeScript + PostgreSQL for a US fintech client."
 },
 {
  "id": "f12",
  "text": "The payment reconciliation service processes about 2 million transactions a day."
 },
 {
  "id": "f13",
  "text": "Moved the team from a monolith deploy to Kubernetes (EKS)."
 },
 {
  "id": "f14",
  "text": "Deploy time went from ~40 min to 8 min after the move to Kubernetes."
 },
 {
  "id": "f15",
  "text": "Interviewed candidates."
 },
 {
  "id": "f16",
  "text": "Mentored 3 juniors."
 },
 {
  "id": "f17",
  "text": "Wrote internal guidelines for code review."
 },
 {
  "id": "f18",
  "text": "Worked from 2018 to 2021 at Lviv IT startup \"Fudzi\" (food delivery)."
 },
 {
  "id": "f19",
  "text": "At Fudzi, was a junior then middle PHP developer."
 },
 {
  "id": "f20",
  "text": "At Fudzi, worked on the Laravel backend for the courier app."
 },
 {
  "id": "f21",
  "text": "At Fudzi, integrated Google Maps API for route estimates."
 },
 {
  "id": "f22",
  "text": "At Fudzi, was on call for production incidents once a week."
 },
 {
  "id": "f23",
  "text": "Worked as a barista at Lviv Coffee Manufacture from 2016 to 2018, part-time during university."
 },
 {
  "id": "f24",
  "text": "Trained new baristas."
 },
 {
  "id": "f25",
  "text": "Holds a BSc in Applied Mathematics from Ivan Franko National University of Lviv, 2014-2018."
 },
 {
  "id": "f26",
  "text": "Skill: TypeScript"
 },
 {
  "id": "f27",
  "text": "Skill: Node.js"
 },
 {
  "id": "f28",
  "text": "Skill: NestJS"
 },
 {
  "id": "f29",
  "text": "Skill: PostgreSQL"
 },
 {
  "id": "f30",
  "text": "Skill: Redis"
 },
 {
  "id": "f31",
  "text": "Skill: Kafka"
 },
 {
  "id": "f32",
  "text": "Skill: Docker"
 },
 {
  "id": "f33",
  "text": "Skill: Kubernetes"
 },
 {
  "id": "f34",
  "text": "Skill: AWS"
 },
 {
  "id": "f35",
  "text": "Skill: PHP"
 },
 {
  "id": "f36",
  "text": "Skill: Laravel"
 },
 {
  "id": "f37",
  "text": "English level B2."
 },
 {
  "id": "f38",
  "text": "Ukrainian is native."
 },
 {
  "id": "f39",
  "text": "Polish level basic."
 },
 {
  "id": "f40",
  "text": "Hobby: bouldering."
 },
 {
  "id": "f41",
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
  "text": "Backend developer with 6 years in the industry, currently tech lead of a team of 5 at SoftServe. Built a Node.js/TypeScript and PostgreSQL payment reconciliation service processing about 2 million transactions a day. Prefers boring, reliable systems.",
  "sourceFactIds": [
   "f6",
   "f10",
   "f11",
   "f12",
   "f7"
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
    "f8",
    "f9",
    "f10"
   ],
   "bullets": [
    {
     "text": "Built a payment reconciliation service in Node.js/TypeScript and PostgreSQL for a US fintech client, processing about 2 million transactions a day.",
     "sourceFactIds": [
      "f11",
      "f12"
     ]
    },
    {
     "text": "Moved the team from a monolith deploy to Kubernetes (EKS), cutting deploy time from ~40 minutes to 8.",
     "sourceFactIds": [
      "f13",
      "f14"
     ]
    },
    {
     "text": "Led a team of 5 as tech lead since March 2023 and mentored 3 juniors.",
     "sourceFactIds": [
      "f10",
      "f16"
     ]
    },
    {
     "text": "Wrote internal guidelines for code review and interviewed candidates.",
     "sourceFactIds": [
      "f17",
      "f15"
     ]
    }
   ]
  },
  {
   "organization": "Fudzi",
   "title": "PHP Developer",
   "startDate": "2018",
   "endDate": "2021",
   "isCurrent": false,
   "location": "Lviv",
   "sourceFactIds": [
    "f18",
    "f19"
   ],
   "bullets": [
    {
     "text": "Worked on the Laravel backend for the courier app at a food delivery startup.",
     "sourceFactIds": [
      "f20",
      "f18"
     ]
    },
    {
     "text": "Integrated Google Maps API for route estimates.",
     "sourceFactIds": [
      "f21"
     ]
    },
    {
     "text": "Was on call for production incidents once a week.",
     "sourceFactIds": [
      "f22"
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
    "f23"
   ],
   "bullets": []
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
    "f25"
   ]
  }
 ],
 "skills": [
  {
   "name": "TypeScript",
   "sourceFactIds": [
    "f26"
   ]
  },
  {
   "name": "Node.js",
   "sourceFactIds": [
    "f27"
   ]
  },
  {
   "name": "NestJS",
   "sourceFactIds": [
    "f28"
   ]
  },
  {
   "name": "PostgreSQL",
   "sourceFactIds": [
    "f29"
   ]
  },
  {
   "name": "Kafka",
   "sourceFactIds": [
    "f31"
   ]
  },
  {
   "name": "Redis",
   "sourceFactIds": [
    "f30"
   ]
  },
  {
   "name": "AWS",
   "sourceFactIds": [
    "f34"
   ]
  },
  {
   "name": "Kubernetes",
   "sourceFactIds": [
    "f33"
   ]
  },
  {
   "name": "Docker",
   "sourceFactIds": [
    "f32"
   ]
  },
  {
   "name": "PHP",
   "sourceFactIds": [
    "f35"
   ]
  },
  {
   "name": "Laravel",
   "sourceFactIds": [
    "f36"
   ]
  },
  {
   "name": "English (B2)",
   "sourceFactIds": [
    "f37"
   ]
  },
  {
   "name": "Ukrainian (native)",
   "sourceFactIds": [
    "f38"
   ]
  },
  {
   "name": "Polish (basic)",
   "sourceFactIds": [
    "f39"
   ]
  }
 ]
}
</cv>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/1-rich-text.sonnet-staged.judge.out.json.

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
