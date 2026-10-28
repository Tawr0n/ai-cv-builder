# AI CV Builder

Turns a person's existing CV or free-text background into a role-targeted CV draft, without inventing facts, and lets them refine it.

## Language

**CV**:
One user's document targeted at one Target role, created from exactly one Source. A user may have many.
_Avoid_: Resume, profile

**Source**:
What the user provided to create a CV: an uploaded PDF or a free-text description of their background. Never changes once the CV exists.
_Avoid_: Input, upload, original

**Target role**:
The job title the CV is aimed at, e.g. "Senior Backend Engineer". Fixed for the life of the CV.
_Avoid_: Position, job, vacancy

**CV content**:
The CV document itself: contact details, summary, experience, education and skills.
_Avoid_: Draft (as a noun for the data), body

**Experience**:
A period of activity at an organization: a job, internship, volunteering or a personal project.
_Avoid_: Job, employment, work history

**Bullet**:
One concise line describing an achievement or responsibility within an Experience.
_Avoid_: Point, description, line item

**Fact**:
A single statement about the user, taken from the Source or from an Answer, that CV content may rest on. Anything in the CV content that no Fact supports is invented.
_Avoid_: Claim, data point, evidence

**Question**:
A request to the user about something missing or vague in the CV content.
_Avoid_: Prompt, gap, clarification

**Anchor**:
The place in the CV content a Question is about: a section, optionally an item within it, optionally a field.
_Avoid_: Path, target, location

**Answer**:
The user's reply to a Question. It becomes a new Fact.
_Avoid_: Response, reply

**Edited item**:
An item of CV content the user changed by hand; generation never overwrites it.
_Avoid_: Locked, manual, user-owned
