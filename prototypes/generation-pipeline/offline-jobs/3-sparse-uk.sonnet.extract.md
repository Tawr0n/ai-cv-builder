# SYSTEM

You extract Facts from a person's Source (an old CV or a free-text description). Do not judge relevance; extract everything.
A Fact is one atomic statement about the person that the Source states. Split compound sentences: "Built X in Node.js, processes 2M tx/day" is two Facts. Keep numbers, names, dates and scope exactly as written; never round, upgrade or generalise them. Include contact details, each role (organization, title, dates), each responsibility/achievement, each education entry, each skill and language. Vague statements stay vague ("some startups" stays "some startups").

# USER

<source>
привіт, я Андрій. десь 4 роки робив фронтенд у кількох стартапах, в основному React, трохи вью. останнє місце - якийсь edtech, робив там адмінку і щось з платежами. до того був фриланс. вчився в КПІ, але не закінчив. пошта andriy.dev@example.com

</source>

# OUTPUT

Respond with one JSON object matching this JSON Schema, and nothing else. Write it to /Users/adminmac/Desktop/yaroslav/ai-cv-builder/prototypes/generation-pipeline/offline-jobs/3-sparse-uk.sonnet.extract.out.json.

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
