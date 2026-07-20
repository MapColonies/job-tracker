# Delete_Layer — The Simple Explanation

This is the plain-language version. For the full technical deep-dive (code, config
wiring, tests), see [delete-layer-tasks-flow.md](delete-layer-tasks-flow.md) — but you
shouldn't need it just to understand what we built and why.

## What does job-tracker actually do?

Think of a **job** as a to-do list, and job-tracker as the person checking items off that
list.

Example — "ingest a new layer" is not one action, it's a sequence:

```
1. validate the input
2. merge the tiles
3. finalize (send callbacks, update the catalog, etc.)
```

Other services do the _actual work_ of each step (validating, merging, etc.). When a
service finishes a step, it tells job-tracker: **"hey, step X is done."** job-tracker's
entire job is to answer one question every time that happens:

> **"Given that this step just finished, what's the next step — and is the whole list done?"**

That's it. job-tracker doesn't validate anything, doesn't merge anything, doesn't delete
anything itself. It's the checklist-keeper, not a worker.

## So what is a "handler"?

Different jobs have different checklists:

| Job type                 | Checklist                                           |
| ------------------------ | --------------------------------------------------- |
| Ingest a new layer       | validate → merge tiles → finalize                   |
| Export a layer           | init → export tiles → split into parts → finalize   |
| Seed tiles               | (one step, nothing after)                           |
| **Delete a layer (new)** | delete → delete tiles → delete artifacts → finalize |

A **handler** is just: _the piece of code that knows one of these checklists._ When
job-tracker gets a "step X is done" notification, it looks at which job that step belongs
to, grabs the matching handler for that job's checklist, and asks it "what's next?"

There's one handler class per row in that table. We added the last one.

## What we actually built

We added a **new checklist** (`Delete_Layer`) and a **new handler** that knows it:

```
   delete   →   delete tiles   →   delete artifacts   →   finalize   →   done!
     ↑                ↑                    ↑
  created by     someone else       someone else
 ingestion-      creates this        creates this
   trigger       task directly       task directly
```

Two important details baked into the handler:

- **"delete tiles" and "delete artifacts" are not created by job-tracker.** Those two
  steps need real, specific information (which exact files to delete) that job-tracker
  doesn't have and shouldn't need to know. Some other service creates those steps
  directly, with the real data. job-tracker just knows to expect them, skip past them
  when deciding "what's next," and wait for them to finish before moving to `finalize`.
- **`finalize` is the only step job-tracker creates itself**, and it's the step that,
  once done, marks the whole job as complete.

## Why does this matter across multiple repos?

This deletion feature isn't finished everywhere yet — think of it as a relay race where
not every runner is in position:

- `ingestion-trigger` already knows how to _start_ a deletion job (creates the `delete`
  step).
- `cleaner` (the service that would actually delete tiles) isn't wired up yet to do this
  for deletion jobs specifically.
- `job-tracker` (this repo) now knows the full checklist and will correctly sequence
  through it — that's what this change adds.

So right now, if someone kicks off a deletion job, job-tracker will correctly track it
and know what should happen next at each point — but a couple of the other services still
need their own follow-up work before the whole thing runs start-to-finish. That's
expected and outside this repo's scope.

## One more thing: the version pin

We had to point job-tracker at a slightly newer version of a shared library
(`raster-shared`) to get the new `Delete_Layer` definitions. That version is currently a
**pre-release ("alpha")** build, not a final stable one — because the stable release
with this feature hasn't been published yet. We're using the exact same pre-release
version that `ingestion-trigger` already uses, so at least the two repos agree. Once a
real stable release comes out, both repos should switch to it together.
