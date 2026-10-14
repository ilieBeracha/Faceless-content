# drafts/

Brainstormed proposals waiting for a decision. Nothing here is used by the pipeline until it's approved.

- `drafts/niches/` — channel ideas (`./engine brainstorm niches`). Approve one by turning it into a channel:
  `./engine new channel --from-draft drafts/niches/<file>.md`
- `drafts/<channel>/characters|series|ideas/` — proposals for one channel (`./engine brainstorm … --channel <slug>`).
  Approve: `./engine approve draft <path>` · Reject: `./engine reject draft <path> --reason "…"`

Drafts are never deleted: approving or rejecting only changes `draft.status`, so the history stays here and in git.
