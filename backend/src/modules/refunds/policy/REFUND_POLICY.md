# Refund Policy

Policy version: **2026-02-01** (exposed by the engine as `POLICY_VERSION`).

This document is the human-readable contract for the deterministic engine in
`policy.ts`. The engine is the only component allowed to approve or deny a
refund. Gemini may classify a request, draft customer-facing wording, and
summarise reasoning for a reviewer, but its output can never change a decision.

## Core parameters

| Parameter | Value | Constant |
| --- | --- | --- |
| Return window | 30 days from delivery (or order date if undelivered) | `RETURN_WINDOW_DAYS` |
| Automatic approval limit | $500.00 | `HUMAN_REVIEW_THRESHOLD_CENTS` |
| New-account age | 2 days | `NEW_ACCOUNT_DAYS` |
| New-account review floor | $200.00 | `NEW_ACCOUNT_REVIEW_CENTS` |
| Repeat refund limit | 3 prior refunds | `REPEAT_REFUND_LIMIT` |
| Duplicate request limit | 1 prior request on the same order | `MAX_DUPLICATE_REQUESTS` |

Money is always handled as integer cents. A refund is never larger than the
refundable value of the claimed line items, and shipping and taxes are never
refunded.

## Evaluation order

Rules run in a fixed order. The first terminal rule (deny or escalate) ends
evaluation, and every rule that ran is recorded in the request's `ruleTrace`
with a `ruleId`, `title`, `outcome`, human-readable `detail`, and a
`policyRef` pointing back to a section of this document. The admin review
screen renders that trace directly, so a reviewer never has to guess why a
decision was made.

## Rules

| Rule | Outcome | Condition | Ref |
| --- | --- | --- | --- |
| R0 | INFO | Records the order summary, order age, and requested amount before any check runs. | `policy/v1` |
| R1 | DENY | The order has already been refunded in full. | `policy/2.1` |
| R2 | DENY | The order is `CANCELLED` or `RETURNED`. | `policy/2.2` |
| R3 | DENY | The order is older than the 30-day return window. | `policy/2.3` |
| R4 | DENY | The requested amount is not greater than zero. | `policy/2.4` |
| R5 | ESCALATE | The customer claims items that do not exist on the order. | `policy/3.2` |
| R6 | DENY | Every claimed line item is marked final sale. | `policy/2.5` |
| R7 | ADJUST | Some claimed items are final sale; their value is removed from the refundable amount and flagged `FINAL_SALE_EXCLUDED`. | `policy/2.5` |
| R8 | ADJUST | The requested amount is reduced to the eligible item value and flagged `AMOUNT_REDUCED`. | `policy/2.6` |
| R9 | INFO | The customer named no specific items, so the whole order is evaluated. | `policy/2.2` |
| R10 | ESCALATE | More than one prior refund request already exists for the same order. Flag: `DUPLICATE_REQUEST`. | `policy/4.1` |
| R11 | ESCALATE | The message contains policy-bypass or prompt-injection language. Flag: `INJECTION_ATTEMPT`. | `policy/5.1` |
| R12 | ESCALATE | The capped refund is above $500.00. Flag: `HIGH_VALUE`. | `policy/3.1` |
| R13 | ESCALATE | The account has 3 or more prior refunds. Flag: `REPEAT_REFUNDER`. | `policy/4.2` |
| R14 | ESCALATE | The account is 2 days old or newer and the amount is $200.00 or more. Flag: `NEW_ACCOUNT`. | `policy/4.3` |
| R15 | PASS | Approves `min(requested, eligible)` and records the approval reason. | `policy/2.2` |

## Items

A request may name specific line items. Item names are matched
case-insensitively against the order; if a customer names items, only those
items are considered, otherwise the whole order is evaluated. Claimed items
that are not on the order are never silently ignored: they escalate under R5
so a human can reconcile the mismatch.

Final-sale items are excluded from the refundable amount. If every claimed item
is final sale, the request is denied under R6 rather than approved for zero.

## Prompt injection

Customer text is untrusted input. Before any text reaches Gemini it is
sanitized, length-capped, and fenced inside explicit untrusted-data delimiters,
and the system prompt instructs the model to treat it as data only. Independently
of the AI path, R11 scans the raw message for policy-bypass patterns and
escalates the request. A prompt injection attempt therefore cannot influence a
decision even if the model is fooled into complying.

## Human review

An `ESCALATED` request stays open for a customer until a staff member records a
final outcome (`APPROVED` or `DENIED`) with a note. The final outcome, note,
reviewer, and timestamp are stored on the request, so the audit trail covers
both the automated decision and the human override.
