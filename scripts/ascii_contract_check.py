from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACTS = ROOT / "contracts"
EXPECTED_HEADER = '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'


def main() -> None:
    files = sorted(CONTRACTS.glob("*.py"))
    if not files:
        raise SystemExit("No contract sources found")

    for path in files:
        source = path.read_bytes().decode("ascii")
        lines = source.splitlines()
        if not lines or lines[0] != EXPECTED_HEADER:
            raise SystemExit(f"{path.name}: missing locked Depends header")
        if len(lines) < 2 or lines[1] != "from genlayer import *":
            raise SystemExit(f"{path.name}: second line must import genlayer wildcard")

    print(f"ASCII/header check passed for {len(files)} contract(s)")


if __name__ == "__main__":
    main()
