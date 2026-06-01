# Branch Protection — main

Settings to enable in GitHub → Settings → Branches → main:

## Required status checks (must pass before merge)

- Lint & Type Check
- Unit & Integration Tests
- Production Build
- Security Audit

## Additional rules

- Require branches to be up to date before merging
- Require pull request reviews (1 approval minimum)
- Dismiss stale reviews on new commits
- Do not allow bypassing the above settings
- Restrict force pushes to main
