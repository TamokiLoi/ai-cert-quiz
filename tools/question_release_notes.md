# Question Release Notes workflow

The quiz reads `questionReleaseNotes` from the top level of `data.json`. Each record is scoped by the composite identity `examSetId + questionId`; question codes alone are not globally unique. The app shows all records grouped by exam set and offers an exam-set filter.

There is no in-app question editor. Question data is maintained in `data.json` (and the applicable source JSON when one is used); record notes in the same top-level array. `tools/validate-data.js` checks that each note has its required metadata and that its question belongs to the stated set. Incomplete or unlinked history is retained and reported rather than silently discarded.

## Record future changes

1. Make and commit the question-data change first. The extractor reads committed Git snapshots, not uncommitted working-tree edits.
2. Extract the changes since the relevant release or baseline:

   ```sh
   node tools/extract-question-release-notes.js <base-ref> HEAD > tools/question-release-notes.pending.json
   ```

3. Review each generated old/new value against the source diff. The record date, commit version, and reason come from Git (the reason is the commit subject). Do not add a reason or old value that the source history does not support.
4. Merge reviewed records into `data.questionReleaseNotes` in `data.json`, preserving existing entries. Keep `examSetId` and `questionId` from the same exam snapshot; this prevents collisions when two sets reuse a question number. If an old value or reason cannot be established, leave that field absent rather than guessing; the app and validator will identify it as unverified.
5. Run:

   ```sh
   node tools/validate-data.js
   node --test tools/question-release-notes.test.js
   ```

The current retrospective coverage starts at the first commit containing `data.json` (`cd893b4`). Earlier values are not reconstructed from the current dataset. The extractor only detects changes made to question records in `data.json` between the selected Git refs; review other data sources and sync them into `data.json` before relying on its output.
