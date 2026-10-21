# Player Classic result contract

`question:answer` ACK confirms acceptance only. It does not reveal correctness,
points or streak while the question is open. Android starts its 2-second answer
feedback when the result arrives, not when this ACK arrives.

After the question closes and all accepted answers are settled, the server sends
`question:results` to the room, then `question:personal-results` to the sockets
whose authenticated token identifies that player. No client-supplied player id is
used for routing. The public leaderboard contract stays unchanged.

Example of a private result:

```json
{
  "index": 2,
  "question_id": 103,
  "answered": true,
  "isCorrect": true,
  "scoreEarned": 1000,
  "totalScore": 3000,
  "streak": 3,
  "nextQuestionAt": "2026-10-21T08:00:05.000Z",
  "serverTime": "2026-10-21T08:00:00.000Z"
}
```

The event is Classic-only and requires `flow.showCorrectAnswer=true`. When false,
no private event is sent and `game:state.personal_result` is null. The configured
result window is 5 seconds by default; `nextQuestionAt` is authoritative and is
null when advance is manual or the result phase is paused.

## Streak rules

- Correct accepted answer: previous streak + 1, regardless of streak scoring bonus.
- Incorrect accepted answer: 0.
- No accepted answer when the question closes: 0, including timeout,
  disconnection, skipped questions and host-initiated closure.
- A rejected late answer does not count as an accepted answer. If no earlier
  answer exists, closure applies the unanswered rule.
- Unanswered results use `answered=false`, `isCorrect=null`, `scoreEarned=0`.
  The previous score is retained and no synthetic answered-question row is added.

## Reconnect and display

Send `player:sync` after reconnect. During `showing_results`,
`game:state.personal_result` restores the same payload for the same room question,
including when paused. Timestamp `serverTime` reflects the new snapshot; the
running deadline may change after pause/resume. Outside that phase the field is
null, so a result from question N cannot become the summary of question N+1.

Use `(index, question_id)` to reconcile the shared and private events. They are
separate Socket.IO events: wait for the matching private result rather than
assuming it was present in `question:results`. Replace the streak from the server;
do not increment it locally or infer it from score/correct counts. During the
result window, Android can show answer feedback for 2 seconds and the personal
summary for the remaining time, always respecting the current server phase and
`nextQuestionAt`. After a late reconnect, render the available result time rather
than starting a fresh 5-second window.

Open-question snapshots, including paused open questions, mask player grading,
score totals and streak, even when reveal is enabled in the configuration. Player
snapshot leaderboards use the same lean rows as `leaderboard:updated`; private
streak/correctness counts never come from cached full leaderboard rows. Live
player boards require `showCorrectAnswer` and `between_questions`; end-only boards
appear only at finish, and never boards stay hidden. Hosts retain their separate
monitoring board. Live lobby-roster refreshes omit score totals as well.

Shared pause/resume snapshots do not contain any player's private result. A
player needing to rebuild its summary requests `player:sync`.

## Verification

Run `pnpm test` in `backend`. It builds the backend and runs the Node test suite
with in-memory cache, repository and Socket.IO doubles, without external services.
CI runs the same command. Tests cover grading, streak settlement, private routing,
reconnect identity, hidden answers, board visibility, pause/resume and a timeout
racing an in-flight answer.
