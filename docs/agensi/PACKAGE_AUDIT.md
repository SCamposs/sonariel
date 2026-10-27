# Submission ZIP audit

Audited on 2026-10-27. This is a local preparation audit, **not Agensi approval**. Nothing has been uploaded or submitted to the marketplace.

- File: `sonariel-mcp-integration-1.0.0.zip`.
- Skill version: **1.0.0**; target application: **0.4.0**.
- Size: **19,904 bytes** compressed; **40,225 bytes** uncompressed.
- SHA-256: `7a0396cb9884b472327096cf1392405140732cbcb6eb14e4b5d012f81d4d722f`.
- Location: private artifact directory outside Git, reported directly to the owner. No archive is attached to an app release.
- Exact entry count: **10**; one root `SKILL.md`; no outer directory or nested archive.

## File inventory

| Entry | Bytes | SHA-256 |
| --- | ---: | --- |
| `LICENSE` | 4146 | `ec749881ed6560a1fa5ccb1add318e894145f2184af34462f30545b859872230` |
| `README.md` | 2085 | `f1975c19426dda0b510ceff60bb82d9cc14c29277ed692739b5521d65a3173bc` |
| `SKILL.md` | 6209 | `4f21d30104b071182f9b28fe83bc13e3fd73b153092cd08cc48ba532e28fa52d` |
| `references/compatibility.md` | 3966 | `de4e232825496678b842e13c4815550029d1600fd3ca3da5cf14023aaa77ccf9` |
| `references/engine-capabilities.md` | 4613 | `5ea781886dd2d9af37dfb3212a1d20b6db5ef24b64baef179df38199ec83561d` |
| `references/mcp-workflow.md` | 7910 | `f088979da5a758b879fffda59021d473ae158887f6b10cfda83b0efb128c0b2a` |
| `references/safety-and-recovery.md` | 4010 | `6cfa51bf0d1418e03452b95bca7a226cd68ca8fc453572d60ef7d81dfc337ff8` |
| `references/setup.md` | 3740 | `f0e72f87815d528eba3fd6c47aafe36f1de5713bb9f05479953afe6373c256e9` |
| `references/troubleshooting.md` | 3103 | `fb1f932bddd3597df51a723fa8baa40822902ffac362e379e89dad6247603d83` |
| `templates/codex-mcp.toml.example` | 443 | `cdbe263253a8ce643c011e89205c003db7246fbc7b869d26f1b8dbab00edc00f` |

## Checks completed

- Explicit ten-file allowlist exactly matches source and ZIP; every entry round-trips byte-for-byte; ZIP CRC test passes. No traversal, symlink entries, absolute paths or extraneous files.
- Repeated fixed-order/fixed-timestamp ZIP assembly produced identical bytes. This audit describes the hash above; editing any payload requires another audit and hash.
- YAML parses; name/description and metadata version are valid. The skill-creator validator passed. TOML and client JSON examples parse; the native FX example validates against the actual distributed tool schema.
- All named Sonariel tools in the payload exist in the stable server catalog; no unavailable loop tool is referenced as callable. Twenty-two internal payload links resolve.
- UTF-8 text only. No executable, dependency environment, model, audio, database, installer, key, token, personal absolute path or production-project material is included. Defined privacy/secret-pattern checks found no matches; manual content review also completed. This is not a proof that arbitrary secret-scanning heuristics detect every possible secret.
- The license copy is identical to the existing software license. The original bundled skill and functional app source are unchanged.
- No executable scripts are shipped. The TOML is an explicit manual template, with placeholders; it neither downloads content nor installs/changes agent configuration. Setup/generation rights and external terms remain explicit user decisions.
- The package is well below the current documented website limits. Agensi's own scan, AI review, human decision, permissions extraction and name-uniqueness check have **not** run.

## Reproduce and submit

From a reviewed source snapshot, archive exactly the ten entries above relative to `skills/sonariel-mcp-integration/`. Keep the output outside Git or under the repository's ignored `artifacts/` directory. Verify entry names, content hashes and the new ZIP SHA-256 before using it. Different ZIP tools/timestamps may produce different archive bytes even for identical content; compare per-file hashes as well.

See [listing/manual submission](LISTING.md#manual-submission-after-owner-approval), [official packaging rules](https://www.agensi.io/docs/packaging), and [Phase 3 evidence](../PHASE3.md). Owner approval is required before any marketplace submission; the validated archive is not automatically approved listing content.
