import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(new URL("../foundry-tidas-import/", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const version = "0.1.12";
const source = "0733a8c7688f8ad85215fdead19aba99bab3d723";

test("copied Foundry skill runs the public locked runtime and rejects changed installation inputs", {
  timeout: 1_800_000,
}, (t) => {
  const lockPath = path.join(entry, "scripts", "bootstrap-lock.json");
  assert.ok(fs.existsSync(lockPath), "The final independently verified F1 bootstrap lock must be shipped.");
  const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
  assert.equal(lock.schema, "tiangong-lca.runtime-bootstrap-lock.v1");
  assert.equal(lock.manifest_url,
    `https://github.com/tiangong-lca/foundry/releases/download/foundry-runtime-v${version}/runtime-manifest.json`);
  const platform = `${process.platform}-${process.arch}`;
  assert.ok(["linux-x64", "linux-arm64", "darwin-arm64", "win32-x64"].includes(platform));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "foundry-public-skill-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const copy = path.join(root, "copied skill");
  fs.cpSync(entry, copy, { recursive: true, dereference: false });
  const userRoot = path.join(root, "user");
  const temporary = path.join(root, "temp");
  const workspace = path.join(root, "项目 workspace");
  const localAppData = path.join(userRoot, "AppData", "Local");
  const appData = path.join(userRoot, "AppData", "Roaming");
  for (const directory of [userRoot, temporary, workspace, localAppData, appData])
    fs.mkdirSync(directory, { recursive: true });
  const windows = process.platform === "win32";
  const systemRoot = process.env.SystemRoot ?? process.env.SYSTEMROOT;
  if (windows) assert.ok(systemRoot);
  const systemPath = windows
    ? [path.join(systemRoot, "System32"), systemRoot].join(path.delimiter)
    : "/usr/bin:/bin:/usr/sbin:/sbin";
  const env = {
    HOME: userRoot, USERPROFILE: userRoot, LOCALAPPDATA: localAppData, APPDATA: appData,
    XDG_CACHE_HOME: path.join(userRoot, ".cache"), XDG_CONFIG_HOME: path.join(userRoot, ".config"),
    TEMP: temporary, TMP: temporary, TMPDIR: temporary,
    PATH: systemPath, Path: systemPath, LANG: "C", LC_ALL: "C", TZ: "UTC",
  };
  for (const key of ["SystemRoot", "SYSTEMROOT", "WINDIR", "windir", "ComSpec", "COMSPEC",
    "PATHEXT", "PROCESSOR_ARCHITECTURE", "PROCESSOR_ARCHITEW6432"])
    if (process.env[key] !== undefined) env[key] = process.env[key];
  let shell = "/bin/sh";
  if (windows) {
    const found = spawnSync(path.join(systemRoot, "System32", "where.exe"), ["pwsh"], {
      encoding: "utf8", timeout: 30_000, shell: false,
    });
    assert.equal(found.status, 0, "The native Windows qualification host requires PowerShell.");
    shell = found.stdout.trim().split(/\r?\n/u)[0];
    assert.ok(path.isAbsolute(shell) && fs.statSync(shell).isFile());
  }
  const script = path.join(copy, "scripts", `tiangong-runtime-bootstrap.${windows ? "ps1" : "sh"}`);
  const prefix = windows ? ["-NoProfile", "-NonInteractive", "-File", script] : [script];
  const cache = path.join(windows ? localAppData : process.platform === "darwin"
    ? path.join(userRoot, "Library", "Caches") : env.XDG_CACHE_HOME, "tiangong-lca", "runtimes", "v1");
  assert.equal(fs.existsSync(cache), false);
  const checks = [];
  const run = (phase, args, expectedExit = 0, action = null) => {
    const started = Date.now();
    const result = spawnSync(action?.executable ?? shell, action?.argv ?? [...prefix, ...args], {
      cwd: action?.cwd ?? workspace, env, shell: false, encoding: "utf8", timeout: 900_000,
      stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.ok((Array.isArray(expectedExit) ? expectedExit : [expectedExit]).includes(result.status),
      `${phase}: exit ${result.status}; ${result.stderr.slice(0, 4096)} ${result.stdout.slice(0, 4096)}`);
    checks.push({ phase, exit: result.status, milliseconds: Date.now() - started });
    return result;
  };
  const operation = (phase, args, expectedExit = 0) => {
    const result = run(phase, args, expectedExit);
    const value = JSON.parse(result.stdout);
    assert.equal(value.schema, "tiangong-foundry.operation-result.v1");
    return value;
  };
  const writeJson = (name, value) => {
    const file = path.join(workspace, name);
    fs.writeFileSync(file, JSON.stringify(value) + "\n");
    return file;
  };
  const artifact = (result, role) => result.artifacts?.findLast((item) => item.role === role);
  const indexedJson = (result, role) => {
    const item = artifact(result, role);
    assert.ok(item?.path, `${role} must be indexed as a file artifact`);
    assert.equal(hash(fs.readFileSync(item.path)), item.sha256);
    return { item, value: JSON.parse(fs.readFileSync(item.path, "utf8")) };
  };
  const initial = operation("cold-install", ["workspace", "init", "--workspace", workspace, "--json"]);
  assert.equal(initial.status, "ready");
  const manifestFile = path.join(cache, "manifests", `${lock.manifest_sha256}.json`);
  const manifestBytes = fs.readFileSync(manifestFile);
  assert.equal(manifestBytes.length, lock.manifest_bytes);
  assert.equal(hash(manifestBytes), lock.manifest_sha256);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.product.version, version);
  const componentKeys = fs.readdirSync(path.join(cache, "components")).sort();
  const doctor = operation("warm-start", ["doctor", "--workspace", workspace, "--json"]);
  assert.equal(doctor.status, "ready");
  assert.equal(doctor.runtime_identity.foundry.package_version, version);
  const qualification = doctor.runtime_identity.qualification;
  assert.equal(qualification.status, "ready");
  assert.equal(qualification.identity.cli.package_version, "0.1.19");
  assert.equal(qualification.identity.cli.node_version, "24.19.0");
  assert.equal(qualification.identity.tidas.binary_version, "0.3.2");
  assert.deepEqual(fs.readdirSync(path.join(cache, "components")).sort(), componentKeys);
  const application = manifest.components.find((component) => component.id === "foundry" && component.platform === platform);
  assert.ok(application);
  // Receipts locate an installation; the independently shipped manifest owns
  // the content proof and the source expectation is reviewed separately.
  const matches = componentKeys.filter((key) => {
    const receipt = JSON.parse(fs.readFileSync(path.join(cache, "components", key, "receipt.json"), "utf8"));
    return receipt.archive_sha256 === application.archive.sha256 && receipt.content_sha256 === application.content_sha256;
  });
  assert.equal(matches.length, 1);
  const provenancePath = "metadata/runtime-provenance.json";
  const provenanceFact = application.files.find((file) => file.path === provenancePath);
  assert.ok(provenanceFact);
  const provenanceBytes = fs.readFileSync(path.join(cache, "components", matches[0], "root", provenancePath));
  assert.equal(provenanceBytes.length, provenanceFact.bytes);
  assert.equal(hash(provenanceBytes), provenanceFact.sha256);
  const provenance = JSON.parse(provenanceBytes);
  assert.equal(provenance.scope, "published-release");
  assert.equal(provenance.source.commit, source);
  assert.equal(provenance.package.version, version);
  assert.equal(provenance.published_package.source.gitCommit, source);
  // The Foundry owner bundles its own CLI (0.1.19, tag cli-v0.1.19); that is not the wrapper
  // launcher's published pin, and the two owner versions are never conflated.
  assert.equal(provenance.cli.package.version, "0.1.19");
  assert.equal(provenance.cli.source.ref, "refs/tags/cli-v0.1.19");
  assert.equal(provenance.cli.source.gitCommit, "7f7b313cebc30c96154860df30f5d666963bc0b7");

  // The installed 0.1.12 copied entry must prove interaction and adoption.
  {
    const actor = "synthetic-skill-qualifier";
    const id = "66666666-6666-4666-8666-666666666666";
    const rawAnswer = "For this synthetic test, use a schema-valid category after review; this is my test choice.";
    const brief = {
      original_request: "Test-only: resolve one synthetic Process classification ambiguity.",
      goal: "Prove the installed runtime applies an explicit human choice to local semantic work.",
      intended_use: "Credential-free copied-entry qualification fixture.",
      scope: "One synthetic Process row; no scientific or platform claim.",
      deliverables: ["Indexed local semantic result and a partial decision recap."],
      user_constraints: ["Do not request credentials or write to the platform."],
      ai_assumptions: [],
    };
    const seed = writeJson("synthetic-process.json", { rows: [{ id, version: "00.00.001", json: {
      processDataSet: {
        processInformation: {
          dataSetInformation: {
            "common:UUID": id,
            name: { baseName: { "@xml:lang": "en", "#text": "Synthetic heat from natural gas" } },
            classificationInformation: { "common:classification": { "common:class": [
              { "@level": "0", "@classId": "INVALID", "#text": "Synthetic invalid class" },
            ] } },
          },
          geography: { locationOfOperationSupplyOrProduction: { "@location": "Invalid region" } },
        },
        administrativeInformation: { publicationAndOwnership: { "common:dataSetVersion": "00.00.001" } },
      },
    } }] });
    const specFile = writeJson("synthetic-task.json", {
      schema: "tiangong-foundry.task-start.v1", request_id: "copied-skill-human-interaction",
      actor_id: actor, lane: "source-evidence-dataset-development", profile_id: "generic",
      target_entities: ["process"], sources: [{ path: seed }], seed: { path: seed },
      account_intent: null, preparation: null, brief,
    });
    const started = operation("interaction-task-start", ["task", "start", "--workspace", workspace,
      "--spec", specFile, "--json"]);
    assert.equal(started.status, "ready");
    assert.deepEqual(artifact(started, "task_brief")?.value, brief);
    const args = ["--workspace", workspace, "--task", started.task_id, "--actor", actor];
    const interact = (phase, expectedStateSha, events, expectedExit = 0) => {
      const input = writeJson(`${phase}.json`, {
        schema: "tiangong-foundry.interaction-input.v1", task_id: started.task_id,
        actor_id: actor, expected_state_sha256: expectedStateSha, events,
      });
      return operation(phase, ["task", "resume", ...args, "--interaction-input", input, "--json"], expectedExit);
    };
    const asked = interact("interaction-question", null, [{
      kind: "question", id: "classification-choice", dataset_type: "process",
      missing: "This synthetic Process has an invalid category and needs a reviewed choice.",
      impact: "A category patch without the recorded choice could misrepresent this test row.",
      recommendation: "Check the installed controlled classification schema first.",
      ask: "For this test row, should the controlled category be selected after schema review?",
      choices: ["Investigate first", "Use the reviewed category"],
      evidence_sha256: [hash(fs.readFileSync(seed))], supersedes: null,
    }], 2);
    assert.equal(asked.status, "needs_input");
    assert.ok(asked.blockers.some((item) => item.code === "interaction_decision_pending"));
    const question = indexedJson(asked, "current_interaction_state");
    assert.equal(question.value.events[0].ask,
      "For this test row, should the controlled category be selected after schema review?");
    const investigated = interact("interaction-investigate", question.item.sha256, [{
      kind: "answer", question_id: "classification-choice", decision_id: "investigate-category",
      supersedes_decision_id: null, raw_answer: "I need the controlled category checked before deciding.",
      adopted_decision: null, disposition: "investigate", evidence_sha256: [],
    }], 2);
    assert.equal(investigated.status, "needs_input");
    assert.ok(investigated.blockers.some((item) => item.code === "interaction_investigation_pending"));
    const investigation = indexedJson(investigated, "current_interaction_state");
    assert.equal(investigation.value.events[1].disposition, "investigate");
    const decided = interact("interaction-decide", investigation.item.sha256, [{
      kind: "answer", question_id: "classification-choice", decision_id: "use-reviewed-category",
      supersedes_decision_id: "investigate-category", raw_answer: rawAnswer,
      adopted_decision: "Apply a schema-valid controlled category to this synthetic Process only.",
      disposition: "decided", evidence_sha256: [],
    }]);
    assert.equal(decided.status, "ready");
    const decisionState = indexedJson(decided, "current_interaction_state");
    assert.equal(decisionState.value.events[2].raw_answer, rawAnswer);
    assert.equal(decisionState.value.events[2].supersedes_decision_id, "investigate-category");
    const persisted = operation("interaction-fresh-status", ["task", "status", ...args, "--json"]);
    assert.equal(indexedJson(persisted, "current_interaction_state").item.sha256, decisionState.item.sha256);
    assert.equal(persisted.permissions.state, "not_required");
    const recap = artifact(persisted, "decision_recap")?.value;
    assert.equal(recap.completion_proven, false);
    assert.deepEqual(recap.brief, brief);
    assert.equal(recap.user_decisions[0].decision_id, "use-reviewed-category");
    assert.equal(recap.user_decisions[0].raw_answer_sha256, hash(Buffer.from(rawAnswer, "utf8")));
    assert.deepEqual(recap.unresolved_questions, []);

    let assessmentArtifact;
    let assessment;
    for (let step = 1; step <= 4; step += 1) {
      const progressed = operation(`interaction-assess-${step}`, ["task", "resume", ...args, "--json"], [0, 2]);
      const current = artifact(progressed, "foundry-assessment.json");
      if (current) {
        ({ item: assessmentArtifact, value: assessment } = indexedJson(progressed, "foundry-assessment.json"));
        if (assessment.sets.some((set) => set.type === "process"
          && set.decisions.some((item) => item.kind === "classification"))) break;
      }
    }
    assert.ok(assessmentArtifact, "The installed runtime must register a Process assessment.");
    const processSet = assessment.sets.find((set) => set.type === "process");
    assert.ok(processSet);
    assert.deepEqual(processSet.decisions.map((item) => item.kind).sort(), ["classification", "location"]);
    assert.equal(assessment.interaction_sha256, decisionState.item.sha256);
    const classification = processSet.decisions.find((item) => item.kind === "classification");
    const ownerTask = JSON.parse(fs.readFileSync(classification.task, "utf8"));
    const template = path.resolve(assessment.owner_base, ownerTask.files.template);
    const templateRows = fs.readFileSync(template, "utf8").trim().split(/\r?\n/u).map(JSON.parse);
    assert.equal(templateRows.length, 1);
    const controlledSchema = JSON.parse(fs.readFileSync(path.resolve(assessment.owner_base,
      "../cli/assets/tidas-schemas/tidas_processes_category.json"), "utf8"));
    assert.ok(controlledSchema.oneOf.some((item) => item.properties?.["@classId"]?.const === "3530"));
    const authoredRows = templateRows.map((item) => ({
      ...item, code: "3530",
      basis: "Synthetic fixture: test-only user choice after review of installed controlled category 3530.",
      used_context_kinds: item.authoring_context.required_context_kinds,
      evidence: {
        ...item.evidence, source: seed,
        quote_or_trace: "Synthetic Process name and installed category 3530; no real scientific claim.",
      },
    }));
    const decisionFile = path.join(workspace, "synthetic-classification-decisions.jsonl");
    fs.writeFileSync(decisionFile, authoredRows.map((item) => JSON.stringify(item)).join("\n") + "\n");
    const descriptor = {
      schema: "tiangong-foundry.semantic-input.v1", task_id: started.task_id, actor_id: actor,
      assessment_sha256: assessmentArtifact.sha256, interaction_sha256: decisionState.item.sha256,
      submissions: [{ kind: "classification", authoring_task_sha256: hash(fs.readFileSync(classification.task)),
        file: decisionFile, sha256: hash(fs.readFileSync(decisionFile)), decision_ids: ["use-reviewed-category"] }],
    };
    const missingDecision = structuredClone(descriptor);
    delete missingDecision.submissions[0].decision_ids;
    const missingResult = operation("semantic-missing-decision-refused", ["task", "resume", ...args,
      "--semantic-input", writeJson("semantic-missing-decision.json", missingDecision), "--json"], 4);
    assert.equal(missingResult.status, "blocked");
    assert.ok(missingResult.blockers.some((item) => item.code === "semantic_interaction_invalid"));
    const staleState = { ...descriptor, interaction_sha256: "0".repeat(64) };
    const staleResult = operation("semantic-stale-interaction-refused", ["task", "resume", ...args,
      "--semantic-input", writeJson("semantic-stale-interaction.json", staleState), "--json"], 4);
    assert.equal(staleResult.status, "blocked");
    assert.ok(staleResult.blockers.some((item) => item.code === "semantic_interaction_changed"));
    const beforeApply = operation("semantic-before-apply-status", ["task", "status", ...args, "--json"], 2);
    assert.equal(artifact(beforeApply, "semantic-result.json"), undefined);
    const applied = operation("semantic-decision-applied", ["task", "resume", ...args,
      "--semantic-input", writeJson("synthetic-semantic-input.json", descriptor), "--json"]);
    assert.equal(applied.status, "ready");
    const semantic = indexedJson(applied, "semantic-result.json");
    assert.equal(semantic.value.status, "completed");
    assert.equal(semantic.value.assessment_sha256, assessmentArtifact.sha256);
    assert.equal(semantic.value.interaction_sha256, decisionState.item.sha256);
    assert.deepEqual(semantic.value.adopted_decisions.map((item) => ({
      dataset_type: item.dataset_type, decision_ids: item.decision_ids,
    })), [{ dataset_type: "process", decision_ids: ["use-reviewed-category"] }]);
    assert.equal(semantic.value.adopted_decisions[0].work_item_sha256,
      descriptor.submissions[0].authoring_task_sha256);
    const repaired = fs.readFileSync(semantic.value.results[0].repaired_rows, "utf8").trim()
      .split(/\r?\n/u).map(JSON.parse);
    assert.equal(repaired.length, 1);
    const process = repaired[0].processDataSet.processInformation;
    assert.equal(process.dataSetInformation.classificationInformation["common:classification"]
      ["common:class"].at(-1)["@classId"], "3530");
    assert.equal(process.geography.locationOfOperationSupplyOrProduction["@location"], "Invalid region");
    const afterApply = operation("semantic-fresh-status", ["task", "status", ...args, "--json"]);
    assert.equal(indexedJson(afterApply, "semantic-result.json").item.sha256, semantic.item.sha256);
    assert.equal(indexedJson(afterApply, "current_interaction_state").item.sha256,
      decisionState.item.sha256);
    assert.equal(afterApply.permissions.state, "not_required");
    assert.equal(artifact(afterApply, "decision_recap")?.value.completion_proven, false);
    const reassessed = operation("semantic-selective-reassessment", ["task", "resume", ...args, "--json"], 2);
    assert.equal(reassessed.status, "needs_input");
    const newer = indexedJson(reassessed, "foundry-assessment.json");
    assert.notEqual(newer.item.sha256, assessmentArtifact.sha256);
    assert.equal(newer.value.previous_assessment_sha256, assessmentArtifact.sha256);
    assert.equal(newer.value.assessed_type, "process");
    assert.deepEqual(newer.value.sets.find((set) => set.type === "process").decisions
      .map((item) => item.kind), ["location"]);
    assert.equal(artifact(reassessed, "decision_recap")?.value.completion_proven, false);
    assert.equal(reassessed.permissions.state, "not_required");
  }

  // This is a credential-free local cleanup task, not the live RC01–RC06 account case.
  const selected = path.join(workspace, "source.jsonl");
  fs.writeFileSync(selected, '{"flowDataSet":{}}\n');
  const spec = path.join(workspace, "task.json");
  fs.writeFileSync(spec, JSON.stringify({
    schema: "tiangong-foundry.task-start.v1", request_id: "copied-skill-install",
    actor_id: "skill-qualifier", lane: "external-dataset-curated-import", profile_id: "generic",
    target_entities: ["flow"], sources: [{ path: selected }], seed: null, account_intent: null,
    preparation: { operation: "dataset-curation-cleanup", type: "flow", input: selected,
      source_input: null, output_directory: "outputs/cleanup" },
  }, null, 2));
  const task = operation("task-start", ["task", "start", "--workspace", workspace, "--spec", spec, "--json"]);
  assert.equal(task.status, "ready");
  assert.ok(task.task_id);
  const taskArgs = ["--workspace", workspace, "--task", task.task_id, "--actor", "skill-qualifier", "--json"];
  const status = operation("task-status", ["task", "status", ...taskArgs]);
  assert.equal(status.task_id, task.task_id);
  const action = status.next_actions.find((item) => item.kind === "command");
  assert.ok(action);
  assert.equal(action.code, "resume_local_preparation");
  assert.equal(fs.realpathSync(action.cwd), fs.realpathSync(workspace));
  const resumed = JSON.parse(run("returned-task-resume", [], 0, action).stdout);
  assert.equal(resumed.schema, "tiangong-foundry.operation-result.v1");
  assert.equal(resumed.task_id, task.task_id);
  assert.ok(["ready", "completed"].includes(resumed.status));
  assert.equal(resumed.runtime_identity.qualification.status, "ready");
  const manifestIndex = action.argv.indexOf("--manifest");
  assert.ok(manifestIndex > 0);
  const actionManifest = action.argv[manifestIndex + 1];
  assert.ok(path.isAbsolute(actionManifest));
  const manifestRelative = path.relative(fs.realpathSync(root), fs.realpathSync(actionManifest));
  assert.ok(manifestRelative && manifestRelative !== ".."
    && !manifestRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(manifestRelative));
  assert.equal(fs.lstatSync(actionManifest).isSymbolicLink(), false);
  const actionManifestBytes = fs.readFileSync(actionManifest);
  assert.equal(hash(actionManifestBytes), lock.manifest_sha256);
  fs.appendFileSync(actionManifest, "\n");
  try {
    // The public CLI runtime-error contract returns EX_UNAVAILABLE (69).
    assert.match(run("returned-manifest-tamper-refused", [], 69, action).stderr,
      /RUNTIME_MANIFEST_INTEGRITY/u);
  } finally { fs.writeFileSync(actionManifest, actionManifestBytes); }
  assert.equal(operation("developer-command-refused", ["profiles-list", "--workspace", workspace, "--json"], 2).status, "needs_input");

  const mustNotExist = path.join(root, "must-not-exist");
  const originalScript = fs.readFileSync(script);
  fs.appendFileSync(script, "\n");
  try {
    assert.match(run("script-tamper-refused", ["workspace", "init", "--workspace", mustNotExist, "--json"], 1).stderr,
      /bootstrap_script_changed/u);
    assert.equal(fs.existsSync(mustNotExist), false);
  } finally { fs.writeFileSync(script, originalScript); }
  const lockCopy = path.join(copy, "scripts", "bootstrap-lock.json");
  const originalLock = fs.readFileSync(lockCopy);
  fs.unlinkSync(lockCopy);
  try {
    assert.match(run("missing-lock-refused", ["workspace", "init", "--workspace", mustNotExist, "--json"], 1).stderr,
      /missing_adjacent_lock/u);
    assert.equal(fs.existsSync(mustNotExist), false);
  } finally { fs.writeFileSync(lockCopy, originalLock); }
  fs.appendFileSync(manifestFile, "\n");
  try {
    assert.match(run("manifest-tamper-refused", ["doctor", "--workspace", workspace, "--json"], 1).stderr,
      /file_size_mismatch|file_sha256_mismatch/u);
  } finally { fs.writeFileSync(manifestFile, manifestBytes); }
  const keyPrefix = platform.replaceAll("-", "_");
  const integrity = path.join(cache, "components", lock[`${keyPrefix}_component_key`], "root", lock[`${keyPrefix}_integrity_path`]);
  const originalIntegrity = fs.readFileSync(integrity);
  fs.writeFileSync(integrity, "changed\n");
  try {
    assert.match(run("base-index-tamper-refused", ["doctor", "--workspace", workspace, "--json"], 1).stderr,
      /integrity_file_changed/u);
  } finally { fs.writeFileSync(integrity, originalIntegrity); }
  assert.equal(operation("restored-installation", ["doctor", "--workspace", workspace, "--json"]).status, "ready");
  const report = { schema: "tiangong-skills.foundry-public-install.v1", status: "passed", platform,
    version, source: provenance.source.commit, manifest_sha256: lock.manifest_sha256,
    initial_cache: "empty", credential_scope: "none", runtime_identity: doctor.runtime_identity, checks };
  const proofDirectory = process.env.FOUNDRY_INSTALL_PROOF_DIR;
  if (proofDirectory) {
    assert.ok(path.isAbsolute(proofDirectory));
    fs.mkdirSync(proofDirectory, { recursive: true });
    fs.writeFileSync(path.join(proofDirectory, `${platform}.json`), JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  }
  t.diagnostic(JSON.stringify({ platform, version, manifest_sha256: lock.manifest_sha256, checks }));
});
