# Limitations

- This checks **requirements you wrote down**. It does not establish correctness, factuality or safety, and passing assertions are not a guarantee of safe behaviour.
- `refusal()` and `restrictFormat()` are phrase and regex heuristics and will produce false positives and negatives. `similarTo()` and `compare`'s overlap are lexical.
- Replay tests recorded outputs, not today's model. A green replay says your *assertions and parsing* still hold on the recorded output. To detect model drift, re-record or run `--live`.
- Live model output is non-deterministic. Record one sample per case, or run `--live` several times. There is no built-in repeat or flakiness statistic.
- Case ids and assertion names are identity for baseline matching. Renaming one shows as removed plus added.
- Single-turn input and output only. No built-in multi-turn or trace support, and no UI.
- Redaction patterns are US and English biased.
- No evaluation-accuracy claims are made, and there is no benchmark dataset in the repository.
- `.ts` suites need Node 22.18 or newer, or a loader such as `tsx`.
