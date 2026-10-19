from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
EXPECTED_HEADER = '# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }'


def main() -> None:
    files = sorted(CONTRACTS.glob("*.py"))
    if not files:
        raise SystemExit("No contract sources found")

    for path in files:
        source = path.read_bytes().decode("ascii")
        lines = source.splitlines()
        if len(lines) < 3 or lines[0] != "# v0.3.0" or lines[1] != EXPECTED_HEADER:
            raise SystemExit(f"{path.name}: missing locked Depends header")
        if lines[2] != "import genlayer as gl":
            raise SystemExit(f"{path.name}: third line must import genlayer as gl")

    print(f"ASCII/header check passed for {len(files)} contract(s)")


if __name__ == "__main__":
    main()
