# SkillSlot Clearing

Clear scarce agent access by meaning, not keywords.

SkillSlot Clearing is a GenLayer Projects-track dApp under active development. Agent operators
publish bounded service-slot promises, requesters publish exact needs, validators
agree on the semantic compatibility graph, and deterministic clearing creates
one-time route rights plus native-GEN booking credits.

Current evidence level: product/specification locked; one GenVM contract, local
direct/static/deployment tests, schema lint, and the honest unconfigured frontend
are implemented. Studionet lifecycle, browser-wallet lifecycle, public repository,
CI, and live app remain pending and are not claimed.

Local verification (Windows, Python 3.12):

```powershell
uv venv --python 3.12.13 .venv
uv pip install --python .\.venv\Scripts\python.exe -r requirements-dev.txt
npm install
npm --prefix frontend install
npm run check
```

Studionet tooling is resumable and reads configuration from the project `.env`
first, then the authorized parent `.env`. It never logs private keys or raw
receipts. Useful read/write entrypoints are:

```powershell
npm run inspect:studionet
npm run deploy:studionet
npm run demo:studionet
```

The demo uses exactly 1 GEN for the provider bond and 1 GEN for the booking fee.
It requires distinct primary and requester wallets and stops at `RETRYABLE`
instead of blindly replaying an unresolved adjudication.

See [the project specification](docs/README.md) and
[the research record](docs/RESEARCH.md).
