"""앱 이름 글자만 담은 작은 글꼴 조각(woff2)을 만든다.

앱 이름이 바뀌면 다시 돌린다. 원본 글꼴 파일은 이 저장소에 없으므로 경로를 넘겨 준다.

  uv run --with fonttools --with brotli python tool/wordmarks.py \
      --bold <Pretendard 계열 Bold.otf> --extrabold <Pretendard 계열 ExtraBold.otf> \
      --blackhan <BlackHanSans-Regular.ttf>
"""
import argparse
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

OUT = Path(__file__).resolve().parent.parent / "assets" / "fonts"
MARKS = {
    "mark-pocketpet.woff2": ("bold", "포켓펫"),
    "mark-mylittlecloset.woff2": ("extrabold", "마이리틀클로젯"),
    "mark-moacam.woff2": ("blackhan", "모아캠"),
}


def main():
    parser = argparse.ArgumentParser()
    for key in ("bold", "extrabold", "blackhan"):
        parser.add_argument(f"--{key}", required=True)
    args = parser.parse_args()
    for name, (key, text) in MARKS.items():
        options = subset.Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        font = TTFont(getattr(args, key))
        subsetter = subset.Subsetter(options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        font.flavor = "woff2"
        font.save(OUT / name)
        print(name, (OUT / name).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
