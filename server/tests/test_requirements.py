from pathlib import Path

SERVER = Path(__file__).resolve().parent.parent


def test_requirements_files_are_ascii():
    """Windows pip은 requirements를 cp949로 읽어서 한글 주석이 있으면 설치가 깨진다"""
    for f in SERVER.glob("requirements*.txt"):
        f.read_bytes().decode("ascii")  # UnicodeDecodeError면 실패
