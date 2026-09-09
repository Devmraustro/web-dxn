# Telegram Human Escalation — DXN Store

Phase 19M/19W. When the AI assistant cannot handle a conversation safely, it
notifies the store owner via Telegram so a human can take over.

## When escalation happens

- Medical / health-treatment questions (e.g. "does this cure X?") — the AI
  must never give medical advice.
- Prompt-injection or unsafe input attempts.
- Complaints.
- Explicit human request ("talk to a person").
- Unknown intent or LLM unavailable, where no safe deterministic answer exists.
- Output validation blocking a fabricated answer.

## Behavior guarantees

- **Best-effort, never throws.** `notifyHumanHandoff` retries internally with
  exponential backoff + jitter, then returns `{ delivered, error? }`. A failing
  Telegram sink **never** breaks or rolls back the customer-facing flow
  (verified in `tests/order-notifier.test.ts`).
- **Fire-and-forget.** Escalation is a side effect independent of the order
  commit.

## Privacy (Phase 19AG)

Escalation messages are **privacy-minimized**:
- Platform, conversation id, reason, and a trimmed recent-conversation excerpt.
- Customer identifiers are masked (`AB***12`) — the full PSID/phone is never
  sent through the notification channel.

Message template:

```
⚠️ *AI HUMAN HANDOFF*
Platform: instagram
Conversation: c-123
Customer: AB***12
Reason: medical claim question

Recent conversation:
...
```

## Configuration

```
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

- Create a bot with [@BotFather](https://t.me/BotFather) → copy the token.
- `chat_id` is where the bot posts (your personal chat id, a group, or channel).
- These are **external credentials** you must obtain; see
  `docs/EXTERNAL-CONFIGURATION.md`.

## Testing

`tests/order-notifier.test.ts` and the escalation helpers in the AI suite cover
the "Telegram failure does not roll back the order path" requirement.
