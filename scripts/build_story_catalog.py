#!/usr/bin/env python3
"""Validate human-reviewed annotations and build the runtime story catalog."""

from __future__ import annotations

import hashlib
import json
import re
import shutil
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ANNOTATION_DIR = ROOT / "knowledge_base" / "annotations"
SOURCE_IMAGE_DIR = ROOT / "图片"
ASSET_DIR = ROOT / "assets" / "stories"
RUNTIME_DIR = ROOT / "knowledge_base" / "generated_stories"
CATALOG_PATH = ROOT / "knowledge_base" / "catalog.json"

AGE_BY_CATEGORY = {
    "1张图的故事": ["small"],
    "2张图的故事": ["small", "middle"],
    "3张图的故事": ["middle"],
    "4张图的故事": ["large"],
}

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def numeric_key(path: Path) -> tuple[int, str]:
    match = re.match(r"(\d+)", path.stem)
    return (int(match.group(1)) if match else 10_000, path.name)


def clean_name(value: str) -> str:
    return unicodedata.normalize("NFC", value.replace("\u206e", "").strip())


def normalize_cues(cues: list[str]) -> list[str]:
    normalized: list[str] = []
    for cue in cues:
        parts = [part.strip() for part in re.findall(r"[^？?]+[？?]?", cue) if part.strip()]
        normalized.extend(parts)
    return normalized


def stable_id(category: str, title: str) -> str:
    digest = hashlib.sha1(f"{category}/{title}".encode("utf-8")).hexdigest()[:10]
    return f"story_{digest}"


def load_annotations() -> list[dict]:
    stories: list[dict] = []
    for annotation_path in sorted(ANNOTATION_DIR.glob("*.json"), key=numeric_key):
        payload = json.loads(annotation_path.read_text(encoding="utf-8"))
        category = payload["category"]
        if category not in AGE_BY_CATEGORY:
            raise ValueError(f"Unknown category: {category}")
        for story in payload["stories"]:
            stories.append({"category": category, **story})
    return stories


def prepare_assets() -> None:
    """Normalize the supplied image tree without modifying the source folder."""
    if not SOURCE_IMAGE_DIR.is_dir():
        raise FileNotFoundError(f"Missing source image folder: {SOURCE_IMAGE_DIR}")
    for category_dir in SOURCE_IMAGE_DIR.iterdir():
        if not category_dir.is_dir() or category_dir.name not in AGE_BY_CATEGORY:
            continue
        target_category = ASSET_DIR / category_dir.name
        target_category.mkdir(parents=True, exist_ok=True)
        for item in category_dir.iterdir():
            if item.is_file() and item.suffix.lower() in IMAGE_SUFFIXES:
                target = target_category / clean_name(item.stem) / f"1{item.suffix.lower()}"
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(item, target)
            elif item.is_dir():
                target_story = target_category / clean_name(item.name)
                target_story.mkdir(parents=True, exist_ok=True)
                for image_path in item.iterdir():
                    if image_path.is_file() and image_path.suffix.lower() in IMAGE_SUFFIXES:
                        shutil.copy2(image_path, target_story / image_path.name)


def build_story(source: dict) -> dict:
    category = source["category"]
    title = source["title"]
    folder = ASSET_DIR / category / title
    if not folder.is_dir():
        raise FileNotFoundError(f"Missing story folder: {folder}")

    image_paths = sorted(
        (item for item in folder.iterdir() if item.suffix.lower() in IMAGE_SUFFIXES),
        key=numeric_key,
    )
    frames = source["frames"]
    if len(image_paths) != len(frames):
        raise ValueError(
            f"Frame mismatch for {category}/{title}: "
            f"{len(image_paths)} images vs {len(frames)} annotations"
        )

    quality_flags = source.get("qualityFlags", [])
    images: list[dict] = []
    for order, (image_path, frame) in enumerate(zip(image_paths, frames), start=1):
        if not frame.get("summary") or not frame.get("tags") or not frame.get("cueQuestions"):
            raise ValueError(f"Incomplete annotation: {category}/{title}/{image_path.name}")
        rel = f"{category}/{title}/{image_path.name}"
        cues = normalize_cues(frame["cueQuestions"])
        images.append(
            {
                "image_id": f"{stable_id(category, title)}_frame_{order}",
                "order": order,
                "file": image_path.name,
                "image_url": f"/story-assets/{rel}",
                "private_annotations": {
                    "visible_summary": frame["summary"],
                    "tags": frame["tags"],
                    "uncertainties": frame.get("uncertainties", []),
                    "sensitivity": frame.get("sensitivity", []),
                },
                "visual_clues": cues,
            }
        )

    story_id = stable_id(category, title)
    review_required = "teacher_review_required" in quality_flags
    return {
        "schema_version": "2.0",
        "story_id": story_id,
        "title": title,
        "category": category,
        "suitable_age": AGE_BY_CATEGORY[category],
        "scene_theme": " / ".join(source.get("themes", ["看图讲述"])),
        "themes": source.get("themes", []),
        "quality": {
            "status": "teacher_review_required" if review_required else "ready",
            "flags": quality_flags,
            "notes": source.get("qualityNotes", []),
        },
        "sequence_policy": {
            "use_image_order": True,
            "allow_inference": True,
            "must_mark_uncertain": True,
            "do_not_override_visible_facts_with_title": True,
        },
        "images": images,
    }


def main() -> None:
    prepare_assets()
    source_stories = load_annotations()
    actual_folders = {
        (category_dir.name, clean_name(story_dir.name))
        for category_dir in ASSET_DIR.iterdir()
        if category_dir.is_dir()
        for story_dir in category_dir.iterdir()
        if story_dir.is_dir()
    }
    annotated_folders = {(item["category"], item["title"]) for item in source_stories}
    if actual_folders != annotated_folders:
        missing = sorted(actual_folders - annotated_folders)
        extra = sorted(annotated_folders - actual_folders)
        raise ValueError(f"Folder coverage mismatch; missing={missing}, extra={extra}")

    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    catalog: list[dict] = []
    total_frames = 0
    for source in source_stories:
        story = build_story(source)
        folder_path = ASSET_DIR / story["category"] / story["title"] / "story.json"
        payload = json.dumps(story, ensure_ascii=False, indent=2) + "\n"
        folder_path.write_text(payload, encoding="utf-8")
        (RUNTIME_DIR / f"{story['story_id']}.json").write_text(payload, encoding="utf-8")
        catalog.append(
            {
                "story_id": story["story_id"],
                "title": story["title"],
                "category": story["category"],
                "suitable_age": story["suitable_age"],
                "themes": story["themes"],
                "image_count": len(story["images"]),
                "cover_url": story["images"][0]["image_url"],
                "quality": story["quality"],
            }
        )
        total_frames += len(story["images"])

    catalog_payload = {
        "schema_version": "2.0",
        "story_count": len(catalog),
        "image_count": total_frames,
        "stories": catalog,
    }
    CATALOG_PATH.write_text(
        json.dumps(catalog_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Built {len(catalog)} stories / {total_frames} labeled frames")


if __name__ == "__main__":
    main()
