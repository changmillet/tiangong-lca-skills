import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Active authoring, import and remote-operation contracts. Any of these instructing an agent to
// conflate annual volume with a reference amount, inflate versions, author immutable identities,
// convert properties implicitly or discover a private runtime is a contract violation (Issue #104).
const scannedSkillDirs = [
  'process-automated-builder',
  'foundry-tidas-authoring',
  'foundry-tidas-import',
  'tiangong-lca-remote-ops',
  'external-dataset-curated-import',
  'source-evidence-dataset-development',
];

function listMarkdown(dir) {
  const files = [];
  const walk = (relative) => {
    for (const entry of readdirSync(path.join(repoRoot, relative), { withFileTypes: true })) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith('.md') || entry.name.endsWith('.yaml')) files.push(next);
    }
  };
  walk(dir);
  return files;
}

const scannedDocs = scannedSkillDirs.flatMap(listMarkdown).sort();

function read(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

// Guidance that forbids a behavior is the contract working; only an imperative instruction is a
// violation. A match is therefore skipped when a negation directly governs it, judged from the short
// window around the match itself rather than from the whole sentence, so a sentence that both denies
// one thing and asserts another is still reviewed on its assertion.
const NEGATION_WINDOW = 40;
const NEGATED = /\b(never|not|no|nor|without|avoid|must not|cannot|does not|do not|don't)\b/iu;

function scanSentences(text, patterns) {
  // Line wraps inside a bullet must not hide the negation that governs the clause, so the whole
  // document is normalized first and only the match window decides.
  const normalized = text.replace(/\s+/gu, ' ');
  const found = [];
  for (const pattern of patterns) {
    const regex = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let match;
    while ((match = regex.exec(normalized)) !== null) {
      const window = normalized.slice(
        Math.max(0, match.index - NEGATION_WINDOW),
        match.index + match[0].length,
      );
      if (NEGATED.test(window)) continue;
      found.push(normalized.slice(Math.max(0, match.index - 80), match.index + match[0].length + 80));
      break;
    }
  }
  return found;
}

const detectors = {
  'annual-reference-conflation': (text) =>
    scanSentences(text, [
      /\bderive[ds]?\b[^.]{0,80}annual[^.]{0,80}(meanAmount|resultingAmount)/iu,
      /annual[^.]{0,120}(from|use|using|equals?)[^.]{0,60}(meanAmount|resultingAmount)/iu,
      /(meanAmount|resultingAmount)[^.]{0,80}(per year|annual)/iu,
      /reference (flow'?s? )?(meanAmount|resultingAmount)[^.]{0,40}(first|then|as the annual)/iu,
      /reference (flow )?(amount|quantity)[^.]{0,40}(per year|as the annual|annual production)/iu,
      /9999[^.]{0,80}(sentinel|missing-data)[^.]{0,60}(policy|write|use)/iu,
      /(write|uses?|assign)[^.]{0,60}(sentinel|9999 missing-data-sentinel)/iu,
    ]),
  'automatic-version-inflation': (text) =>
    scanSentences(text, [
      /\bincrement\b[^.]{0,40}`?version`?[^.]{0,80}(every|each|per)[^.]{0,40}(resume|run|edit|retry|attempt)/iu,
      /\b(create|mint|bump|advance)\b[^.]{0,50}new (dataset )?version[^.]{0,60}(every|each|per)/iu,
      /next version[^.]{0,60}(every|each)[^.]{0,40}(resume|run|edit|retry)/iu,
      /new version (per|for each|on every) (draft )?(edit|resume|run|retry)/iu,
    ]),
  'elementary-identity-authoring': (text) =>
    scanSentences(text, [
      /\b(create|author|mint|re-?version|rename|reclassify)\b[^.]{0,60}elementary flow/iu,
      /\b(create|author|modify|re-?version|rename)\b[^.]{0,60}LCIA (method|identity)/iu,
      /elementary flow[^.]{0,40}(when missing|if missing|as needed)/iu,
    ]),
  'implicit-property-conversion': (text) =>
    scanSentences(text, [
      /\bconvert[^.]{0,50}(implicitly|automatically|by default)/iu,
      /(assume|apply|treat)[^.]{0,60}(implicit|by default)[^.]{0,40}(conversion|unit|scaling)/iu,
      /\b(use|write|substitute|fall back to)\b[^.]{0,50}(reference )?(internal )?id[^.]{0,15}(0|zero)\b/iu,
      /(first|array-first)[^.]{0,40}(property|flow property)[^.]{0,40}(default|assume|use)/iu,
      /equate[^.]{0,50}(unit label|literal unit)[^.]{0,40}(relation|conversion)/iu,
    ]),
  'private-runtime-discovery': (text) =>
    scanSentences(text, [
      /\b(discover|search for|locate|scan for)\b[^.]{0,60}(sibling|private)[^.]{0,40}(checkout|runtime|repo|skill)/iu,
      /(import|require|load)[^.]{0,50}from[^.]{0,40}(a )?sibling (skill|checkout|repo)/iu,
      /\b(read|collect|parse|extract)\b[^.]{0,50}(credentials?|passwords?|access tokens?|api keys?)[^.]{0,80}(from|in)[^.]{0,40}(skill|workspace|\.env)/iu,
    ]),
  'fabricated-unknown-or-bypass': (text) =>
    scanSentences(text, [
      /\b(hand-?(write|edit|fabricate)|manually (write|set|edit|patch)|write|set|replace|overwrite|change)\b[^.]{0,50}\ban empty array/iu,
      /\b(hand-?(write|edit|fabricate)|fabricate)\b[^.]{0,40}\bempty array/iu,
      /\b(bypass|ignore|skip|work around)\b[^.]{0,40}\b(and|then|to)\s+(continue|proceed|write|save|submit|dispatch)/iu,
      /\b(patch|edit|rewrite|discard|drop)\b[^.]{0,25}\b(runtime |validation |apply )?report\b[^.]{0,25}\bto (pass|make|satisfy|look|proceed|continue)/iu,
    ]),
};

// Fixture corpus: guidance that MUST be rejected. The first entries are the pre-#104 instructions
// that shipped in this repository, so the detectors stay load-bearing for the real regression they
// were written for rather than for a paraphrase.
const violationFixtures = [
  {
    class: 'annual-reference-conflation',
    source: 'pre-#104 process-automated-builder/SKILL.md',
    text: 'If there is no evidence value, derive the value from the quantitative reference flow\'s `meanAmount` first, then `resultingAmount`, and write the field with the reference unit per year.',
  },
  {
    class: 'annual-reference-conflation',
    source: 'pre-#104 process-automated-builder/references/operations-playbook.md',
    text: 'For annual supply or production volume, the CLI must use explicit evidence first, then reference-flow `meanAmount`, then reference-flow `resultingAmount`; the skill should only supply evidence and context.',
  },
  {
    class: 'annual-reference-conflation',
    source: 'pre-#104 foundry-tidas-authoring/references/semantic-work.md',
    text: 'Missing annual supply is not a fabricated volume or arbitrary deferral: Foundry owns the deterministic `9999 missing-data-sentinel/year` policy where applicable.',
  },
  {
    class: 'annual-reference-conflation',
    source: 'paraphrase',
    text: 'Use the reference amount per year as the annual production volume.',
  },
  {
    class: 'automatic-version-inflation',
    source: 'paraphrase',
    text: 'Increment the version on every resume.',
  },
  {
    class: 'automatic-version-inflation',
    source: 'paraphrase',
    text: 'Create a new version for each retry of the write.',
  },
  {
    class: 'elementary-identity-authoring',
    source: 'paraphrase',
    text: 'Create the missing elementary flow row before continuing.',
  },
  {
    class: 'elementary-identity-authoring',
    source: 'paraphrase',
    text: 'Re-version the LCIA method when its name changes.',
  },
  {
    class: 'implicit-property-conversion',
    source: 'paraphrase',
    text: 'Convert the amount implicitly when the units differ.',
  },
  {
    class: 'implicit-property-conversion',
    source: 'paraphrase',
    text: 'Write the reference property with internal id 0.',
  },
  {
    class: 'private-runtime-discovery',
    source: 'paraphrase',
    text: 'Search for a sibling runtime checkout and execute it.',
  },
  {
    class: 'private-runtime-discovery',
    source: 'paraphrase',
    text: 'Read the credentials from the workspace .env and reuse them.',
  },
  {
    class: 'fabricated-unknown-or-bypass',
    source: 'pinned-runtime gap paraphrase',
    text: 'If the pinned Foundry runtime writes 9999 for a missing annual volume, manually set the field to an empty array before saving.',
  },
  {
    class: 'fabricated-unknown-or-bypass',
    source: 'pinned-runtime gap paraphrase',
    text: 'When the installed CLI is too old, hand-edit the row to write an empty array and continue.',
  },
  {
    class: 'fabricated-unknown-or-bypass',
    source: 'pinned-runtime gap paraphrase',
    text: 'If the runtime rejects the payload, bypass the gate and continue the write.',
  },
  {
    class: 'fabricated-unknown-or-bypass',
    source: 'pinned-runtime gap paraphrase',
    text: 'When the report is missing the new validation layers, patch the report to pass and proceed.',
  },
];

// Corrective or neutral guidance that must NOT be flagged, so the detectors cannot pass by
// rejecting every sentence that mentions the topic.
const benignFixtures = [
  'Never derive annual supply from the quantitative reference flow\'s `meanAmount` or `resultingAmount`.',
  'When the source does not prove an annual volume, keep it unknown with the supported empty array and the reported evidence gap.',
  'Do not increment the version when a run resumes; keep the same draft id and version.',
  'Routine authoring keeps Elementary Flow and LCIA Method identities immutable; never create or re-version them outside the dedicated owner gates.',
  'Do not convert units implicitly; require the explicit relation and complete conditions.',
  'Do not discover a sibling checkout, parse credentials or keep a duplicate ledger.',
  'The historical `9999 missing-data-sentinel/year` text is only a read-only recognition marker for rows written by earlier rounds.',
  'If the installed runtime still emits a numeric sentinel such as `9999`, or its report carries no validation-layer fields, stop and report that qualified adoption is incomplete.',
  'Never hand-fabricate, overwrite or delete the empty array in the dataset.',
  'Never edit or discard the runtime report. Never bypass its gate.',
  'The pinned published CLI `0.1.20` and the qualified Foundry `0.1.12` lock are separate owner versions; the installed runtime is still the authority to observe.',
];

test('negative fixtures: the detectors reject the pre-#104 guidance and its paraphrases', () => {
  for (const fixture of violationFixtures) {
    const detected = Object.entries(detectors)
      .filter(([, detect]) => detect(fixture.text).length > 0)
      .map(([id]) => id);
    assert.deepEqual(
      detected,
      [fixture.class],
      `${fixture.class} fixture from ${fixture.source} must be detected exactly once`,
    );
  }
});

test('negative fixtures: corrective guidance is never rejected', () => {
  for (const text of benignFixtures) {
    for (const [id, detect] of Object.entries(detectors)) {
      assert.deepEqual(detect(text), [], `${id} must not flag corrective guidance`);
    }
  }
});

test('no scanned skill document instructs a forbidden authoring behavior', () => {
  for (const relativePath of scannedDocs) {
    const text = read(relativePath);
    for (const [id, detect] of Object.entries(detectors)) {
      assert.deepEqual(detect(text), [], `${relativePath} violates ${id}`);
    }
  }
});

test('the annual contract is evidence-based, keeps unknown unknown and consumes CLI reports', () => {
  const skill = read('process-automated-builder/SKILL.md');
  assert.match(skill, /annualSupplyOrProductionVolume[\s\S]{0,400}explicit annual source evidence/iu);
  assert.match(skill, /keep it unknown[\s\S]{0,200}(empty array|\[\])/iu);
  assert.match(skill, /validation_layers/iu);
  assert.match(skill, /not .{0,40}publication-ready|neither publication-ready/iu);

  const playbook = read('process-automated-builder/references/operations-playbook.md');
  assert.match(playbook, /no reference-flow[\s\S]{0,120}fallback/iu);

  const semantic = read('foundry-tidas-authoring/references/semantic-work.md');
  assert.match(semantic, /unknown volume stays unknown/iu);
  assert.match(semantic, /annual_supply_evidence_gaps|row-level evidence gap/iu);
  assert.match(semantic, /do not re-implement the validator/iu);

  const importSkill = read('foundry-tidas-import/SKILL.md');
  assert.match(importSkill, /Unknown values stay unknown/iu);
  assert.match(importSkill, /never derived from a reference[\s\S]{0,80}meanAmount/iu);
});

test('the draft and version contract keeps one stable draft and demands evidence for new versions', () => {
  const routing = read('tiangong-lca-remote-ops/references/process-write-routing.md');
  assert.match(routing, /same `id`[\s\S]{0,80}same `version`/iu);
  assert.match(routing, /resuming[\s\S]{0,120}never increments the version/iu);
  assert.match(routing, /prefer reusing a semantically suitable existing row/iu);
  assert.match(routing, /next `version` only when the published content must genuinely change/iu);
  assert.match(routing, /reference\/provider-impact\s+evidence/iu);
});

test('immutable identities, property conversion and private runtime boundaries stay explicit', () => {
  const semantic = read('foundry-tidas-authoring/references/semantic-work.md');
  assert.match(semantic, /Elementary Flow and LCIA Method identities immutable/iu);

  const guardrails = read('process-automated-builder/references/ilcd_method_guardrails.md');
  assert.match(guardrails, /Secondary properties on an existing Product\/Waste Flow/iu);
  assert.match(guardrails, /reference property and its identity stay unchanged/iu);
  assert.match(guardrails, /CLI #318/iu);

  const importSkill = read('foundry-tidas-import/SKILL.md');
  assert.match(importSkill, /Do not discover a sibling checkout/iu);
  assert.match(importSkill, /bounded existing-owner-draft repair lane/iu);
  assert.match(importSkill, /next_actions/iu);

  const skill = read('process-automated-builder/SKILL.md');
  assert.match(skill, /Names, descriptions and comments state domain facts only/iu);
});

test('the pinned-runtime gap is an explicit stop condition, never a hand-fabrication instruction', () => {
  const skill = read('process-automated-builder/SKILL.md');
  assert.match(skill, /pinned published CLI `0\.1\.20`/iu);
  assert.match(skill, /qualified adoption is incomplete/iu);
  assert.match(skill, /merged source behavior and published support separate/iu);

  const semantic = read('foundry-tidas-authoring/references/semantic-work.md');
  assert.match(semantic, /qualified adoption incomplete/iu);
  assert.match(semantic, /Never hand-fabricate, overwrite or delete the empty array/iu);

  const routing = read('tiangong-lca-remote-ops/references/process-write-routing.md');
  assert.match(routing, /qualified adoption as incomplete/iu);
  assert.match(routing, /Do not hand-fabricate, overwrite or delete the empty array/iu);
  assert.match(routing, /reviewed source behavior and the pinned published support separate/iu);

  const importSkill = read('foundry-tidas-import/SKILL.md');
  assert.match(importSkill, /qualified adoption (as )?incomplete/iu);
  assert.match(importSkill, /pinned published CLI `0\.1\.20`/iu);

  const playbook = read('process-automated-builder/references/operations-playbook.md');
  assert.match(playbook, /qualified adoption as incomplete/iu);
  assert.match(playbook, /never hand-edit an empty array or bypass the runtime/iu);

  // The paired agent prompts must carry the same hold, because they gate invocation semantics.
  const builderPrompt = read('process-automated-builder/agents/openai.yaml');
  assert.match(builderPrompt, /qualified adoption as incomplete/iu);
  assert.match(builderPrompt, /never hand-fabricate the empty array or bypass the runtime/iu);

  const opsPrompt = read('tiangong-lca-remote-ops/agents/openai.yaml');
  assert.match(opsPrompt, /qualified adoption as incomplete/iu);
  assert.match(opsPrompt, /never hand-fabricate the empty array or bypass its gate/iu);

  // The bounded repair lane is a released owner fact; the CLI #318 conversion path stays a hold
  // rather than claimed support.
  assert.match(skill, /existing-owner-draft metadata repair lane is released/iu);
  assert.match(skill, /CLI #283/iu);
  assert.match(skill, /next_actions/iu);
  assert.match(read('process-automated-builder/references/ilcd_method_guardrails.md'), /CLI #318/u);
});
