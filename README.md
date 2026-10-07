# DSH Auto Compact

`@ohmejj/dsh-auto-compact` is a DeepSeek Harness bundle that configures DSH's native automatic context compaction.

It does not reimplement or duplicate the compaction provider. It configures the existing `@deepseek-ai/dsh-compaction-basic` provider in DSH's Agent preset: that provider measures the current context, preserves a recent tail, summarizes an older tool-balanced conversation range, and records the replacement as replayable DSH session events. This keeps the original event log intact and lets DSH recover from a provider-reported context-window overflow.

## Install

```bash
dsh plugin --profile web add @ohmejj/dsh-auto-compact
```

Restart the selected DSH profile after installation. Open **Settings → 自动上下文压缩** to edit the policy.

## Default policy

| Setting | Default | Meaning |
| --- | ---: | --- |
| Automatic compaction | enabled | Checks pressure before the next Agent step. |
| Trigger threshold | 80% | Starts compacting at 80% of the routed model's context window. |
| Recent-context retention | 16% | Keeps the latest 16% of the context verbatim. |
| Extra headroom | 65,536 tokens | Reserves room beyond the model output budget before pressure is evaluated. |
| Summary output cap | 8192 tokens | Maximum generation budget for the summary call. |
| Ordinary / overflow retries | 1 / 1 | Additional attempts after pressure remains or the provider reports overflow. |

Leave the summary provider and model blank to summarize using the current conversation model. Set both fields together to route summary calls to a dedicated model.

## How it works

```text
Agent pre-step / context overflow
  → native token meter measures the current session surface
  → native compaction provider selects an older tool-balanced region
  → an LLM creates a summary checkpoint
  → DSH replaces that region on the derived conversation surface
  → raw session events remain available for replay and diagnostics
```

The plugin persists its own resolved policy in the profile, mirrors that policy into the current Web Agent preset's nested `compaction-basic` row, then requests DSH profile reconciliation. New sessions created with that preset use the new policy; existing sessions retain the preset revision chosen when they were created.

## Development

```bash
npm install
npm test
```

`npm test` builds the host and browser artifacts and runs the policy validation tests.
