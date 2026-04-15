# /integrity — File Integrity Hashing

This directory provides SHA-256 file integrity tooling for the MajixAI repository. It generates and verifies hashes for every tracked file so that any accidental or unauthorised modification is immediately detectable.

## Files

| File | Purpose |
|------|---------|
| `generate_hashes.py` | Walk the repository and write `integrity/hashes.json` |
| `verify_hashes.py` | Compare current files against `integrity/hashes.json` and report new / modified / deleted files |
| `hashes.json` | Auto-generated snapshot — **do not edit by hand** |

---

## Generating hashes

Run from the repository root:

```bash
python integrity/generate_hashes.py
```

This produces (or overwrites) `integrity/hashes.json` with a sorted, SHA-256 keyed JSON map of every non-ignored file relative to the repository root.

---

## Verifying integrity

Run from the repository root:

```bash
python integrity/verify_hashes.py
```

Exit output:
- **"Verification successful: All files are intact."** — nothing has changed since the last `generate_hashes.py` run.
- A report of **New Files**, **Modified Files**, and/or **Deleted Files** if differences are detected.

---

## Automation

A GitHub Actions workflow (`.github/workflows/integrity_hashes.yml`) re-generates `hashes.json` on every push to `main` and on a daily schedule, then commits the updated file back to the branch. This ensures the snapshot stays current and any drift is surfaced in CI.

---

## Ignore rules

The following are excluded from hashing by default (see `generate_hashes.py`):

- `.git/`
- `integrity/hashes.json` (the output file itself — avoids a circular hash)
- `jules-scratch/`
- Everything listed in `.gitignore`
