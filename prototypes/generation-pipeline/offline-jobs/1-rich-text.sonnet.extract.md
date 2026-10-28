# SYSTEM

You extract Facts from a person's Source (an old CV or a free-text description). Do not judge relevance; extract everything.
A Fact is one atomic statement about the person that the Source states. Split compound sentences: "Built X in Node.js, processes 2M tx/day" is two Facts. Keep numbers, names, dates and scope exactly as written; never round, upgrade or generalise them. Include contact details, each role (organization, title, dates), each responsibility/achievement, each education entry, each skill and language. Vague statements stay vague ("some startups" stays "some startups").

# USER

<source>
Olena Kovalenko
olena.kovalenko@example.com | +380 67 123 4567 | Lviv, Ukraine | github.com/okoval

About me: backend developer, 6 years in the industry. I like boring reliable systems.

2021 - now: SoftServe, Lviv. Backend engineer, then tech lead of a team of 5 from March 2023.
- Built payment reconciliation service in Node.js/TypeScript + PostgreSQL for a US fintech client, it processes about 2 million transactions a day.
- Moved the team from a monolith deploy to Kubernetes (EKS), deploy time went from ~40 min to 8 min.
- Interviewed candidates, mentored 3 juniors.
- Wrote internal guidelines for code review.

2018 - 2021: Lviv IT startup "Fudzi" (food delivery), junior then middle PHP developer.
- Laravel backend for the courier app.
- Integrated Google Maps API for route estimates.
- Was on call for production incidents once a week.

2016 - 2018: barista at Lviv Coffee Manufacture (part-time during university). Trained new baristas.

Education: Ivan Franko National University of Lviv, BSc Applied Mathematics, 2014-2018.

Skills: TypeScript, Node.js, NestJS, PostgreSQL, Redis, Kafka, Docker, Kubernetes, AWS, PHP, Laravel. English B2, Ukrainian native, Polish basic.
Hobbies: bouldering, board games.

</source>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/1-rich-text.sonnet.extract.out.json.

{
 "$schema": "https://json-schema.org/draft/2020-12/schema",
 "type": "object",
 "properties": {
  "facts": {
   "type": "array",
   "items": {
    "type": "object",
    "properties": {
     "id": {
      "type": "string",
      "description": "f1, f2, ..."
     },
     "text": {
      "type": "string",
      "description": "one atomic statement about the person, in the Source's own terms"
     },
     "quote": {
      "type": "string",
      "description": "the shortest verbatim span of the Source this fact comes from"
     }
    },
    "required": [
     "id",
     "text",
     "quote"
    ],
    "additionalProperties": false
   }
  }
 },
 "required": [
  "facts"
 ],
 "additionalProperties": false
}
