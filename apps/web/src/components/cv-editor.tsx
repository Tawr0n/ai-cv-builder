'use client';

import {
  CV_LIMITS,
  type CvContent,
  type CvEducation,
  type CvExperience,
  type Question,
} from '@ai-cv-builder/shared';
import {
  createContext,
  type ReactNode,
  type SubmitEvent,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';
import { anchorItemId } from '@/lib/anchors';
import {
  STRUCTURAL_MESSAGES,
  type SaveState,
  useItemSaver,
  useStructuralEdits,
} from '@/lib/cv-edit';

type Edits = ReturnType<typeof useStructuralEdits>;
type Saver = ReturnType<typeof useItemSaver>;

/** What a card needs to say about the AI: a change to review, or Answers to fold in by hand. */
interface ReviewNotes {
  content: CvContent;
  questions: Question[];
  onReview: (itemId: string) => void;
}

const ReviewNotesContext = createContext<ReviewNotes | null>(null);

/**
 * The Edit tab: every field of the CV as a form of cards, one card per item.
 * A field saves when the User leaves it (one item operation with the item's
 * `rev`); the card says whether it is saving, saved or failed. What the User
 * typed stays on screen until it is saved.
 */
export function CvEditor({
  cvId,
  content,
  version,
  questions,
  onReview,
}: {
  cvId: string;
  content: CvContent;
  /** The CV's `version`: what a move names as the order it saw. */
  version: number;
  questions: Question[];
  /** Opens the review of the AI change to this item. */
  onReview: (itemId: string) => void;
}) {
  const edits = useStructuralEdits(cvId);
  // A card that was just added or moved is scrolled into view (and focused when new).
  const [reveal, setReveal] = useState<{ id: string; focus: boolean }>();
  useEffect(() => {
    if (!reveal) return;
    const card = document.getElementById(cardId(reveal.id));
    card?.scrollIntoView({ block: 'center' });
    if (reveal.focus) {
      card?.querySelector<HTMLElement>('input, textarea')?.focus();
    }
  }, [reveal]);

  function revealLast(list: { id: string }[] | undefined) {
    const last = list?.at(-1);
    if (last) setReveal({ id: last.id, focus: true });
  }

  return (
    <ReviewNotesContext value={{ content, questions, onReview }}>
      <div className="editor">
        {edits.error && (
          <p role="alert" className="editor-alert">
            {STRUCTURAL_MESSAGES[edits.error]}
          </p>
        )}
        <ContactCard cvId={cvId} contact={content.contact} />
        <SummaryCard cvId={cvId} summary={content.summary} />

        <h2>Experience</h2>
        {content.experience.map((item, index) => (
          <ExperienceCard
            key={item.id}
            cvId={cvId}
            item={item}
            index={index}
            count={content.experience.length}
            version={version}
            edits={edits}
            onMoved={() => setReveal({ id: item.id, focus: false })}
          />
        ))}
        <AddButton
          label="Add experience"
          disabled={
            edits.busy || content.experience.length >= CV_LIMITS.experience
          }
          onClick={() =>
            edits.addItem.mutate(
              { section: 'experience' },
              { onSuccess: (next) => revealLast(next.content?.experience) },
            )
          }
        />

        <h2>Education</h2>
        {content.education.map((item, index) => (
          <EducationCard
            key={item.id}
            cvId={cvId}
            item={item}
            index={index}
            count={content.education.length}
            version={version}
            edits={edits}
            onMoved={() => setReveal({ id: item.id, focus: false })}
          />
        ))}
        <AddButton
          label="Add education"
          disabled={
            edits.busy || content.education.length >= CV_LIMITS.education
          }
          onClick={() =>
            edits.addItem.mutate(
              { section: 'education' },
              { onSuccess: (next) => revealLast(next.content?.education) },
            )
          }
        />

        <SkillsCard content={content} edits={edits} />
      </div>
    </ReviewNotesContext>
  );
}

export const cardId = (itemId: string) => `card-${itemId}`;

function ContactCard({
  cvId,
  contact,
}: {
  cvId: string;
  contact: CvContent['contact'];
}) {
  const saver = useItemSaver(cvId, 'contact');
  const field = (name: string) => (next: string) =>
    saver.save({ [name]: next });
  return (
    <Card
      id={cardId('contact')}
      title="Contact"
      itemId="contact"
      edited={contact.edited}
      underReview={Boolean(contact.review)}
      saver={saver}
    >
      <TextField
        label="Full name"
        value={contact.fullName}
        onCommit={field('fullName')}
      />
      <TextField
        label="Email"
        type="email"
        value={contact.email}
        onCommit={field('email')}
      />
      <TextField
        label="Phone"
        type="tel"
        value={contact.phone ?? ''}
        onCommit={field('phone')}
      />
      <TextField
        label="Location"
        value={contact.location ?? ''}
        onCommit={field('location')}
      />
      <LinksField
        links={contact.links}
        onCommit={(links) => saver.save({ links })}
      />
    </Card>
  );
}

function SummaryCard({
  cvId,
  summary,
}: {
  cvId: string;
  summary: CvContent['summary'];
}) {
  const saver = useItemSaver(cvId, 'summary');
  return (
    <Card
      id={cardId('summary')}
      title="Summary"
      itemId="summary"
      edited={summary.edited}
      underReview={Boolean(summary.review)}
      saver={saver}
    >
      <TextField
        label="Summary"
        multiline
        value={summary.text}
        onCommit={(text) => saver.save({ text })}
      />
    </Card>
  );
}

interface EntryProps<Item> {
  cvId: string;
  item: Item;
  index: number;
  count: number;
  version: number;
  edits: Edits;
  onMoved: () => void;
}

function ExperienceCard({
  cvId,
  item,
  index,
  count,
  version,
  edits,
  onMoved,
}: EntryProps<CvExperience>) {
  const saver = useItemSaver(cvId, item.id);
  const [addingBullet, setAddingBullet] = useState(false);
  const field = (name: string) => (next: string) =>
    saver.save({ [name]: next });
  return (
    <Card
      id={cardId(item.id)}
      title={`Experience ${index + 1}`}
      itemId={item.id}
      edited={item.edited}
      underReview={Boolean(item.review)}
      saver={saver}
      actions={
        <EntryActions
          what="experience"
          index={index}
          count={count}
          disabled={edits.busy}
          onMove={(direction) =>
            edits.moveItem.mutate(
              { itemId: item.id, direction, version },
              { onSuccess: onMoved },
            )
          }
          onRemove={() => edits.removeItem.mutate({ itemId: item.id })}
        />
      }
    >
      <TextField
        label="Job title"
        value={item.title ?? ''}
        onCommit={field('title')}
      />
      <TextField
        label="Company"
        value={item.organization ?? ''}
        onCommit={field('organization')}
      />
      <TextField
        label="Location"
        value={item.location ?? ''}
        onCommit={field('location')}
      />
      <div className="field-row">
        <TextField
          label="Start"
          placeholder="YYYY-MM"
          value={item.startDate ?? ''}
          onCommit={(next) => saver.save({ startDate: toDate(next) })}
        />
        <TextField
          label="End"
          placeholder="YYYY-MM or present"
          value={item.endDate ?? ''}
          onCommit={(next) => saver.save({ endDate: toDate(next) })}
        />
      </div>

      <h3>Bullets</h3>
      {item.bullets.map((bullet) => (
        <BulletRow key={bullet.id} cvId={cvId} bullet={bullet} edits={edits} />
      ))}
      {addingBullet ? (
        <NewBulletRow
          onSubmit={(text) =>
            edits.addBullet.mutate(
              { experienceId: item.id, text },
              { onSuccess: () => setAddingBullet(false) },
            )
          }
          onCancel={() => setAddingBullet(false)}
        />
      ) : (
        <AddButton
          label="Add bullet"
          disabled={
            edits.busy || item.bullets.length >= CV_LIMITS.bulletsPerExperience
          }
          onClick={() => setAddingBullet(true)}
        />
      )}
    </Card>
  );
}

function BulletRow({
  cvId,
  bullet,
  edits,
}: {
  cvId: string;
  bullet: CvExperience['bullets'][number];
  edits: Edits;
}) {
  const saver = useItemSaver(cvId, bullet.id);
  return (
    <div className="row">
      <div className="row-main" key={saver.epoch}>
        <TextField
          label="Bullet"
          hideLabel
          multiline
          value={bullet.text}
          onCommit={(text) => saver.save({ text })}
        />
        <SaveStatus saver={saver} />
      </div>
      <button
        type="button"
        aria-label="Remove bullet"
        disabled={edits.busy}
        onClick={() => edits.removeItem.mutate({ itemId: bullet.id })}
      >
        ✕
      </button>
    </div>
  );
}

/** A bullet that does not exist yet: it is created on its first blur with text. */
function NewBulletRow({
  onSubmit,
  onCancel,
}: {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  return (
    <div className="row">
      <textarea
        className="row-main"
        aria-label="New bullet"
        autoFocus
        rows={2}
        maxLength={CV_LIMITS.bullet}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => (text.trim() ? onSubmit(text) : onCancel())}
        onKeyDown={(event) => event.key === 'Escape' && onCancel()}
      />
    </div>
  );
}

function EducationCard({
  cvId,
  item,
  index,
  count,
  version,
  edits,
  onMoved,
}: EntryProps<CvEducation>) {
  const saver = useItemSaver(cvId, item.id);
  const field = (name: string) => (next: string) =>
    saver.save({ [name]: next });
  return (
    <Card
      id={cardId(item.id)}
      title={`Education ${index + 1}`}
      itemId={item.id}
      edited={item.edited}
      underReview={Boolean(item.review)}
      saver={saver}
      actions={
        <EntryActions
          what="education entry"
          index={index}
          count={count}
          disabled={edits.busy}
          onMove={(direction) =>
            edits.moveItem.mutate(
              { itemId: item.id, direction, version },
              { onSuccess: onMoved },
            )
          }
          onRemove={() => edits.removeItem.mutate({ itemId: item.id })}
        />
      }
    >
      <TextField
        label="Institution"
        value={item.institution ?? ''}
        onCommit={field('institution')}
      />
      <TextField
        label="Degree"
        value={item.degree ?? ''}
        onCommit={field('degree')}
      />
      <TextField
        label="Field of study"
        value={item.field ?? ''}
        onCommit={field('field')}
      />
      <div className="field-row">
        <TextField
          label="Start"
          placeholder="YYYY-MM"
          value={item.startDate ?? ''}
          onCommit={(next) => saver.save({ startDate: toDate(next) })}
        />
        <TextField
          label="End"
          placeholder="YYYY-MM"
          value={item.endDate ?? ''}
          onCommit={(next) => saver.save({ endDate: toDate(next) })}
        />
      </div>
    </Card>
  );
}

function SkillsCard({ content, edits }: { content: CvContent; edits: Edits }) {
  const inputId = useId();
  const [name, setName] = useState('');
  const full = content.skills.length >= CV_LIMITS.skills;

  function onSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const skill = name.trim();
    if (!skill) return;
    edits.addItem.mutate(
      { section: 'skills', body: { name: skill } },
      { onSuccess: () => setName('') },
    );
  }

  return (
    <section className="card" id={cardId('skills')}>
      <header className="card-head">
        <h2>Skills</h2>
      </header>
      <ul className="chips">
        {content.skills.map((skill) => (
          <li key={skill.id}>
            {skill.name}
            <button
              type="button"
              aria-label={`Remove ${skill.name}`}
              disabled={edits.busy}
              onClick={() => edits.removeItem.mutate({ itemId: skill.id })}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={onSubmit}>
        <label htmlFor={inputId} className="visually-hidden">
          Add a skill
        </label>
        <input
          id={inputId}
          className="row-main"
          placeholder="Add a skill"
          maxLength={CV_LIMITS.shortField}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button type="submit" disabled={edits.busy || full || !name.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}

/** The links of the contact card: a list of fields, saved as a whole array. */
function LinksField({
  links,
  onCommit,
}: {
  links: string[];
  onCommit: (links: string[]) => Promise<boolean>;
}) {
  // `null`: nothing unsaved, show what is stored.
  const [draft, setDraft] = useState<string[] | null>(null);
  const shown = draft ?? links;

  async function commit(next: string[]) {
    const cleaned = next.map((link) => link.trim()).filter(Boolean);
    if (cleaned.join('\n') === links.join('\n')) {
      setDraft(null);
      return;
    }
    if (await onCommit(cleaned)) setDraft(null);
  }

  return (
    <fieldset className="links">
      <legend>Links</legend>
      {shown.map((link, index) => (
        <div className="row" key={index}>
          <input
            className="row-main"
            aria-label={`Link ${index + 1}`}
            inputMode="url"
            maxLength={CV_LIMITS.shortField}
            value={link}
            onChange={(event) =>
              setDraft(
                shown.map((old, at) =>
                  at === index ? event.target.value : old,
                ),
              )
            }
            onBlur={() => draft && void commit(draft)}
          />
          <button
            type="button"
            aria-label={`Remove link ${index + 1}`}
            onClick={() => void commit(shown.filter((_, at) => at !== index))}
          >
            ✕
          </button>
        </div>
      ))}
      <AddButton
        label="Add link"
        disabled={shown.length >= CV_LIMITS.links}
        onClick={() => setDraft([...shown, ''])}
      />
      <p className="hint">
        Only https:// and http:// links become clickable in the PDF.
      </p>
    </fieldset>
  );
}

function Card({
  id,
  title,
  itemId,
  edited,
  underReview,
  saver,
  actions,
  children,
}: {
  id?: string;
  title: string;
  itemId: string;
  edited: boolean;
  /** Update CV changed it and the User has not accepted or undone that yet. */
  underReview: boolean;
  saver: Saver;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const notes = useContext(ReviewNotesContext);
  // Update CV never rewrites an Edited item: its applied Answers wait for the User.
  const unfolded =
    notes && edited
      ? notes.questions.filter(
          (question) =>
            question.status === 'answered' &&
            question.appliedAt !== null &&
            anchorItemId(question.anchor, notes.content) === itemId,
        )
      : [];
  return (
    <section className="card" id={id}>
      <header className="card-head">
        <h2>{title}</h2>
        {edited && <span className="badge">✎ edited by you</span>}
        {underReview && notes && (
          <button
            type="button"
            className="badge badge-review"
            onClick={() => notes.onReview(itemId)}
          >
            ✨ AI change, review
          </button>
        )}
        {actions}
      </header>
      {unfolded.map((question) => (
        <p key={question.id} className="hint answer-note">
          Your answer: “{question.answer}” — add it to this item yourself if it
          is not here yet.
        </p>
      ))}
      {/* Keyed by the epoch: "load latest" drops whatever the fields had typed. */}
      <div className="card-body" key={saver.epoch}>
        {children}
      </div>
      <SaveStatus saver={saver} />
    </section>
  );
}

/** Saving… / Saved / Couldn't save — Retry / Changed on another device. */
function SaveStatus({ saver }: { saver: Saver }) {
  const { state } = saver;
  return (
    <p className="save-status" role="status" aria-live="polite">
      {statusText(state)}
      {state.status === 'error' && state.retry && (
        <>
          {' — '}
          <button type="button" className="link" onClick={state.retry}>
            Retry
          </button>
        </>
      )}
      {state.status === 'conflict' && (
        <>
          {' '}
          <button type="button" className="link" onClick={saver.loadLatest}>
            Load the latest
          </button>
          <span className="hint">
            {' '}
            Your text: {Object.values(state.mine).flat().join(' / ')}
          </span>
        </>
      )}
    </p>
  );
}

function statusText(state: SaveState): string {
  switch (state.status) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    case 'error':
      return state.message;
    case 'conflict':
      return 'Changed on another device.';
    default:
      return '';
  }
}

function EntryActions({
  what,
  index,
  count,
  disabled,
  onMove,
  onRemove,
}: {
  what: string;
  index: number;
  count: number;
  disabled: boolean;
  onMove: (direction: 'up' | 'down') => void;
  onRemove: () => void;
}) {
  return (
    <div className="card-actions">
      <button
        type="button"
        aria-label={`Move ${what} ${index + 1} up`}
        disabled={disabled || index === 0}
        onClick={() => onMove('up')}
      >
        ↑
      </button>
      <button
        type="button"
        aria-label={`Move ${what} ${index + 1} down`}
        disabled={disabled || index === count - 1}
        onClick={() => onMove('down')}
      >
        ↓
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (window.confirm(`Remove this ${what}? This cannot be undone.`)) {
            onRemove();
          }
        }}
      >
        Remove
      </button>
    </div>
  );
}

function AddButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="add" disabled={disabled} onClick={onClick}>
      + {label}
    </button>
  );
}

/**
 * A text field that saves on blur. `onCommit` resolves `true` once saved;
 * until then (and after a failure) the typed text stays in the field.
 */
function TextField({
  label,
  value,
  onCommit,
  multiline = false,
  hideLabel = false,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => Promise<boolean>;
  multiline?: boolean;
  hideLabel?: boolean;
  type?: 'text' | 'email' | 'tel';
  placeholder?: string;
}) {
  const id = useId();
  // `null`: nothing unsaved, show the stored value.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value;

  async function commit() {
    if (draft === null || draft === value) {
      setDraft(null);
      return;
    }
    const sent = draft;
    // Keep typing that arrived while saving: clear the draft only if it is what was sent.
    if (await onCommit(sent)) setDraft((now) => (now === sent ? null : now));
  }

  const shared = {
    id,
    value: shown,
    placeholder,
    onChange: (event: { target: { value: string } }) =>
      setDraft(event.target.value),
    onBlur: () => void commit(),
  };
  return (
    <div className="field">
      <label htmlFor={id} className={hideLabel ? 'visually-hidden' : undefined}>
        {label}
      </label>
      {multiline ? (
        <textarea rows={3} {...shared} />
      ) : (
        <input type={type} {...shared} />
      )}
    </div>
  );
}

/** A blank date is `null`; `present` may be typed in any case. */
function toDate(text: string): string | null {
  const date = text.trim();
  if (!date) return null;
  return date.toLowerCase() === 'present' ? 'present' : date;
}
